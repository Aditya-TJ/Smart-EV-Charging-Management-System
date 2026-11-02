import { NextResponse } from 'next/server';
import { query, withTransaction } from '@/lib/db';
import { handleApiError } from '@/lib/api-helpers';
import { requireAdminAuth } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/**
 * Format a Date or date string to MySQL DATETIME 'YYYY-MM-DD HH:mm:ss'
 * @param {string|Date} val 
 * @returns {string}
 */
function toMysqlDatetime(val) {
  if (!val) {
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
  }
  const s = String(val).trim();
  if (s.includes('T')) {
    const parts = s.split('T');
    const time = parts[1].length === 5 ? `${parts[1]}:00` : parts[1].slice(0, 8);
    return `${parts[0]} ${time}`;
  }
  return s;
}

/**
 * GET /api/sessions
 * Lists charging sessions with complete joins (user, vehicle, station, point, plan, payment).
 * Computes live duration, calls fn_session_cost, and computes derived payment status.
 */
export async function GET(request) {
  const auth = await requireAdminAuth(request);
  if (!auth.authenticated) return auth.response;

  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const userId = searchParams.get('user_id');
    const stationId = searchParams.get('station_id');
    const pointId = searchParams.get('point_id');
    const unpaidOnly = searchParams.get('unpaid_only') === 'true';

    let sql = `
      SELECT 
        csess.session_id,
        csess.start_time,
        csess.end_time,
        csess.energy_consumed_kwh,
        csess.status,
        TIMESTAMPDIFF(MINUTE, csess.start_time, COALESCE(csess.end_time, NOW())) AS duration_minutes,
        fn_session_cost(csess.session_id) AS computed_cost,
        csess.user_id,
        u.name AS user_name,
        u.email AS user_email,
        u.phone AS user_phone,
        csess.vehicle_id,
        v.vehicle_number,
        v.model AS vehicle_model,
        csess.point_id,
        cp.connector_type,
        cp.power_rating_kw,
        cp.status AS point_current_status,
        cp.station_id,
        cs.name AS station_name,
        cs.location AS station_location,
        cs.status AS station_status,
        csess.plan_id,
        tp.plan_name,
        tp.rate_per_kwh,
        p.payment_id,
        p.amount AS payment_amount,
        p.payment_date,
        p.payment_method,
        CASE 
          WHEN p.payment_id IS NOT NULL THEN 'Paid'
          WHEN csess.status = 'completed' THEN 'Pending'
          ELSE 'In Progress'
        END AS payment_status
      FROM charging_session csess
      INNER JOIN \`user\` u ON csess.user_id = u.user_id
      INNER JOIN vehicle v ON csess.vehicle_id = v.vehicle_id
      INNER JOIN charging_point cp ON csess.point_id = cp.point_id
      INNER JOIN charging_station cs ON cp.station_id = cs.station_id
      INNER JOIN tariff_plan tp ON csess.plan_id = tp.plan_id
      LEFT JOIN payment p ON csess.session_id = p.session_id
    `;

    const conditions = [];
    const params = [];

    if (status && ['ongoing', 'completed'].includes(status.toLowerCase())) {
      conditions.push('csess.status = ?');
      params.push(status.toLowerCase());
    }

    if (userId && !isNaN(Number(userId))) {
      conditions.push('csess.user_id = ?');
      params.push(Number(userId));
    }

    if (stationId && !isNaN(Number(stationId))) {
      conditions.push('cp.station_id = ?');
      params.push(Number(stationId));
    }

    if (pointId && !isNaN(Number(pointId))) {
      conditions.push('csess.point_id = ?');
      params.push(Number(pointId));
    }

    if (unpaidOnly) {
      conditions.push("csess.status = 'completed' AND p.payment_id IS NULL");
    }

    if (conditions.length > 0) {
      sql += ' WHERE ' + conditions.join(' AND ');
    }

    sql += ' ORDER BY csess.session_id DESC';

    const sessions = await query(sql, params);
    return NextResponse.json({ data: sessions });
  } catch (error) {
    return handleApiError(error, 'GET /api/sessions');
  }
}

/**
 * POST /api/sessions
 * Starts or records a new charging session.
 * Enforces transaction management, vehicle ownership validation, and row-locking on charging_point.
 */
export async function POST(request) {
  const auth = await requireAdminAuth(request);
  if (!auth.authenticated) return auth.response;

  try {
    const body = await request.json();
    const {
      user_id,
      vehicle_id,
      point_id,
      plan_id,
      status = 'ongoing',
      start_time,
      end_time,
      energy_consumed_kwh,
    } = body;

    // 1. Basic type and existence validations
    const userIdNum = Number(user_id);
    const vehicleIdNum = Number(vehicle_id);
    const pointIdNum = Number(point_id);
    const planIdNum = Number(plan_id);

    if (!userIdNum || isNaN(userIdNum)) {
      return NextResponse.json({ error: 'A valid user must be selected.' }, { status: 400 });
    }
    if (!vehicleIdNum || isNaN(vehicleIdNum)) {
      return NextResponse.json({ error: 'A valid vehicle must be selected.' }, { status: 400 });
    }
    if (!pointIdNum || isNaN(pointIdNum)) {
      return NextResponse.json({ error: 'A valid charging point must be selected.' }, { status: 400 });
    }
    if (!planIdNum || isNaN(planIdNum)) {
      return NextResponse.json({ error: 'A valid tariff plan must be selected.' }, { status: 400 });
    }

    const sessionStatus = String(status).toLowerCase() === 'completed' ? 'completed' : 'ongoing';

    // 2. Validate Vehicle Ownership (3NF transitive dependency: session -> vehicle -> user)
    const [vehicleRow] = await query(
      `SELECT vehicle_id, user_id, vehicle_number FROM vehicle WHERE vehicle_id = ?`,
      [vehicleIdNum]
    );
    if (!vehicleRow) {
      return NextResponse.json({ error: 'Selected vehicle does not exist.' }, { status: 400 });
    }
    if (vehicleRow.user_id !== userIdNum) {
      return NextResponse.json(
        { error: 'Integrity Violation: The specified vehicle does not belong to this user.' },
        { status: 400 }
      );
    }

    // 3. Validate Tariff Plan
    const [planRow] = await query(
      `SELECT plan_id, rate_per_kwh FROM tariff_plan WHERE plan_id = ?`,
      [planIdNum]
    );
    if (!planRow) {
      return NextResponse.json({ error: 'Selected tariff plan does not exist.' }, { status: 400 });
    }

    // 4. Validate Timestamps and Energy Consumption
    const formattedStartTime = toMysqlDatetime(start_time);
    let formattedEndTime = null;
    let finalKwh = 0.00;

    if (sessionStatus === 'completed') {
      if (!end_time) {
        return NextResponse.json(
          { error: 'Session end time is required when creating a completed session.' },
          { status: 400 }
        );
      }
      formattedEndTime = toMysqlDatetime(end_time);
      if (formattedEndTime < formattedStartTime) {
        return NextResponse.json(
          { error: 'Validation Error: Session end_time cannot be earlier than start_time.' },
          { status: 400 }
        );
      }
      finalKwh = parseFloat(energy_consumed_kwh);
      if (isNaN(finalKwh) || finalKwh < 0) {
        return NextResponse.json(
          { error: 'Validation Error: Energy consumed (kWh) cannot be negative.' },
          { status: 400 }
        );
      }
    } else {
      // Ongoing session
      if (energy_consumed_kwh !== undefined && energy_consumed_kwh !== null && energy_consumed_kwh !== '') {
        finalKwh = parseFloat(energy_consumed_kwh);
        if (isNaN(finalKwh) || finalKwh < 0) {
          return NextResponse.json(
            { error: 'Validation Error: Energy consumed (kWh) cannot be negative.' },
            { status: 400 }
          );
        }
      }
    }

    // 5. ACID Transaction with Row-Level Locking
    const newSession = await withTransaction(async (conn) => {
      // Row lock the target charging point to prevent race condition / double-booking
      const [lockedPoints] = await conn.query(
        `SELECT point_id, status, station_id FROM charging_point WHERE point_id = ? FOR UPDATE`,
        [pointIdNum]
      );

      if (lockedPoints.length === 0) {
        throw new Error('Selected charging point does not exist.');
      }

      const point = lockedPoints[0];

      if (sessionStatus === 'ongoing') {
        if (point.status !== 'available') {
          const err = new Error(
            `Conflict: Charging point #${pointIdNum} is currently '${point.status}'. Only 'available' points can start an ongoing session.`
          );
          err.statusCode = 409;
          throw err;
        }

        // Insert ongoing session
        const [insertRes] = await conn.query(
          `INSERT INTO charging_session 
            (start_time, end_time, energy_consumed_kwh, status, user_id, vehicle_id, point_id, plan_id)
           VALUES (?, NULL, ?, 'ongoing', ?, ?, ?, ?)`,
          [formattedStartTime, finalKwh, userIdNum, vehicleIdNum, pointIdNum, planIdNum]
        );

        // Transition charging point status to 'in-use'
        await conn.query(
          `UPDATE charging_point SET status = 'in-use' WHERE point_id = ?`,
          [pointIdNum]
        );

        return { session_id: insertRes.insertId, status: 'ongoing' };
      } else {
        // Direct completed session
        const [insertRes] = await conn.query(
          `INSERT INTO charging_session 
            (start_time, end_time, energy_consumed_kwh, status, user_id, vehicle_id, point_id, plan_id)
           VALUES (?, ?, ?, 'completed', ?, ?, ?, ?)`,
          [formattedStartTime, formattedEndTime, finalKwh, userIdNum, vehicleIdNum, pointIdNum, planIdNum]
        );

        return { session_id: insertRes.insertId, status: 'completed' };
      }
    });

    return NextResponse.json(
      {
        message:
          newSession.status === 'ongoing'
            ? 'Charging session started successfully (Charger set to in-use)'
            : 'Completed charging session recorded successfully',
        data: newSession,
      },
      { status: 201 }
    );
  } catch (error) {
    if (error.statusCode === 409) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    return handleApiError(error, 'POST /api/sessions');
  }
}

/**
 * PUT /api/sessions
 * Handles session state transitions:
 *  - action = 'complete': Stops an ongoing session, records energy consumed and end_time,
 *    and releases the charging point back to 'available' within an ACID transaction.
 *  - general update: Updates energy consumed or plan for existing session.
 */
export async function PUT(request) {
  const auth = await requireAdminAuth(request);
  if (!auth.authenticated) return auth.response;

  try {
    const body = await request.json();
    const { session_id, action, energy_consumed_kwh, end_time, plan_id } = body;

    const sessionIdNum = Number(session_id);
    if (!sessionIdNum || isNaN(sessionIdNum)) {
      return NextResponse.json({ error: 'A valid session_id is required.' }, { status: 400 });
    }

    if (action === 'complete') {
      const kwh = parseFloat(energy_consumed_kwh);
      if (isNaN(kwh) || kwh < 0) {
        return NextResponse.json(
          { error: 'Energy consumed (kWh) is required and must be a non-negative number.' },
          { status: 400 }
        );
      }

      const formattedEndTime = toMysqlDatetime(end_time);

      await withTransaction(async (conn) => {
        // Lock the session row
        const [sessions] = await conn.query(
          `SELECT session_id, point_id, status, start_time FROM charging_session WHERE session_id = ? FOR UPDATE`,
          [sessionIdNum]
        );

        if (sessions.length === 0) {
          const err = new Error('Charging session not found.');
          err.statusCode = 404;
          throw err;
        }

        const session = sessions[0];
        if (session.status !== 'ongoing') {
          const err = new Error(`Session #${sessionIdNum} is already marked as ${session.status}.`);
          err.statusCode = 400;
          throw err;
        }

        if (formattedEndTime < session.start_time) {
          const err = new Error('Validation Error: Session end_time cannot be earlier than start_time.');
          err.statusCode = 400;
          throw err;
        }

        // 1. Update session to completed
        await conn.query(
          `UPDATE charging_session 
           SET status = 'completed', end_time = ?, energy_consumed_kwh = ? 
           WHERE session_id = ?`,
          [formattedEndTime, kwh, sessionIdNum]
        );

        // 2. Release point status back to 'available'
        await conn.query(
          `UPDATE charging_point SET status = 'available' WHERE point_id = ?`,
          [session.point_id]
        );
      });

      return NextResponse.json({
        message: `Session #${sessionIdNum} completed successfully. Charging point is now available.`,
      });
    }

    // Standard update: energy or plan update
    const updates = [];
    const params = [];

    if (energy_consumed_kwh !== undefined) {
      const kwh = parseFloat(energy_consumed_kwh);
      if (isNaN(kwh) || kwh < 0) {
        return NextResponse.json({ error: 'Energy consumed must be non-negative.' }, { status: 400 });
      }
      updates.push('energy_consumed_kwh = ?');
      params.push(kwh);
    }

    if (plan_id !== undefined) {
      const planIdNum = Number(plan_id);
      if (isNaN(planIdNum)) {
        return NextResponse.json({ error: 'Invalid tariff plan.' }, { status: 400 });
      }
      updates.push('plan_id = ?');
      params.push(planIdNum);
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: 'No fields provided to update.' }, { status: 400 });
    }

    params.push(sessionIdNum);
    const updateSql = `UPDATE charging_session SET ${updates.join(', ')} WHERE session_id = ?`;
    const result = await query(updateSql, params);

    if (result.affectedRows === 0) {
      return NextResponse.json({ error: 'Charging session not found.' }, { status: 404 });
    }

    return NextResponse.json({ message: 'Charging session updated successfully.' });
  } catch (error) {
    if (error.statusCode) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    return handleApiError(error, 'PUT /api/sessions');
  }
}

/**
 * DELETE /api/sessions
 * Deletes a session by ?id=...
 * If deleting an ongoing session, releases the charging point back to 'available'.
 */
export async function DELETE(request) {
  const auth = await requireAdminAuth(request);
  if (!auth.authenticated) return auth.response;

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    const sessionIdNum = Number(id);
    if (!sessionIdNum || isNaN(sessionIdNum)) {
      return NextResponse.json({ error: 'A valid session ID is required.' }, { status: 400 });
    }

    // Protect original sample records from deletion
    if ([7, 8, 9].includes(sessionIdNum)) {
      return NextResponse.json(
        { error: 'Integrity Protection: Original sample database records (Sessions #7, #8, #9) cannot be deleted.' },
        { status: 403 }
      );
    }

    await withTransaction(async (conn) => {
      const [sessions] = await conn.query(
        `SELECT session_id, point_id, status FROM charging_session WHERE session_id = ? FOR UPDATE`,
        [sessionIdNum]
      );

      if (sessions.length === 0) {
        const err = new Error('Charging session not found.');
        err.statusCode = 404;
        throw err;
      }

      const session = sessions[0];

      // Protect payment foreign-key integrity: block deletion if payment exists
      const [payments] = await conn.query(
        `SELECT payment_id FROM payment WHERE session_id = ?`,
        [sessionIdNum]
      );
      if (payments.length > 0) {
        const err = new Error(
          `Cannot delete session #${sessionIdNum}: An active payment record (Payment #${payments[0].payment_id}) is linked to this session. To preserve payment foreign-key integrity, sessions with payment records cannot be deleted.`
        );
        err.statusCode = 409;
        throw err;
      }

      // If ongoing session is cancelled/deleted, release the charger
      if (session.status === 'ongoing') {
        await conn.query(
          `UPDATE charging_point SET status = 'available' WHERE point_id = ?`,
          [session.point_id]
        );
      }

      await conn.query(`DELETE FROM charging_session WHERE session_id = ?`, [sessionIdNum]);
    });

    return NextResponse.json({ message: 'Charging session deleted successfully.' });
  } catch (error) {
    if (error.statusCode) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    return handleApiError(error, 'DELETE /api/sessions');
  }
}
