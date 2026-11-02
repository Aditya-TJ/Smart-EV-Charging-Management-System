import { NextResponse } from 'next/server';
import { query, withTransaction } from '@/lib/db';
import { handleApiError } from '@/lib/api-helpers';
import { requireAdminAuth } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/**
 * GET /api/payments
 * Lists payments joined with session, user, vehicle, station, and tariff plan.
 * Also supports:
 *  - ?eligible_sessions=true : fetches completed sessions awaiting payment.
 *  - ?calculate_cost=true&session_id=... : evaluates fn_session_cost(session_id).
 */
export async function GET(request) {
  const auth = await requireAdminAuth(request);
  if (!auth.authenticated) return auth.response;

  try {
    const { searchParams } = new URL(request.url);
    const eligibleSessions = searchParams.get('eligible_sessions') === 'true';
    const calculateCost = searchParams.get('calculate_cost') === 'true';
    const sessionId = searchParams.get('session_id');

    // 1. Cost calculation via stored function fn_session_cost
    if (calculateCost) {
      const sessIdNum = Number(sessionId);
      if (!sessIdNum || isNaN(sessIdNum)) {
        return NextResponse.json({ error: 'A valid session_id is required.' }, { status: 400 });
      }
      const [result] = await query(
        `SELECT fn_session_cost(?) AS cost`,
        [sessIdNum]
      );
      return NextResponse.json({
        session_id: sessIdNum,
        cost: result?.cost !== null ? Number(result.cost) : null,
      });
    }

    // 2. Fetch completed sessions with no payment (unpaid sessions for payment modal)
    if (eligibleSessions) {
      const sql = `
        SELECT 
          csess.session_id,
          csess.start_time,
          csess.end_time,
          csess.energy_consumed_kwh,
          csess.status,
          TIMESTAMPDIFF(MINUTE, csess.start_time, csess.end_time) AS duration_minutes,
          fn_session_cost(csess.session_id) AS computed_cost,
          csess.user_id,
          u.name AS user_name,
          u.email AS user_email,
          v.vehicle_number,
          v.model AS vehicle_model,
          cp.point_id,
          cp.connector_type,
          cs.station_id,
          cs.name AS station_name,
          tp.plan_name,
          tp.rate_per_kwh
        FROM charging_session csess
        INNER JOIN \`user\` u ON csess.user_id = u.user_id
        INNER JOIN vehicle v ON csess.vehicle_id = v.vehicle_id
        INNER JOIN charging_point cp ON csess.point_id = cp.point_id
        INNER JOIN charging_station cs ON cp.station_id = cs.station_id
        INNER JOIN tariff_plan tp ON csess.plan_id = tp.plan_id
        WHERE csess.status = 'completed'
          AND NOT EXISTS (
            SELECT 1 FROM payment p WHERE p.session_id = csess.session_id
          )
        ORDER BY csess.session_id DESC
      `;
      const eligible = await query(sql);
      return NextResponse.json({ data: eligible });
    }

    // 3. Standard payments list joined with all related entities
    let sql = `
      SELECT 
        p.payment_id,
        p.amount,
        p.payment_date,
        p.payment_method,
        p.session_id,
        csess.start_time AS session_start_time,
        csess.end_time AS session_end_time,
        csess.energy_consumed_kwh,
        csess.status AS session_status,
        TIMESTAMPDIFF(MINUTE, csess.start_time, csess.end_time) AS duration_minutes,
        fn_session_cost(csess.session_id) AS formula_cost,
        u.user_id,
        u.name AS user_name,
        u.email AS user_email,
        u.phone AS user_phone,
        v.vehicle_number,
        v.model AS vehicle_model,
        cp.point_id,
        cp.connector_type,
        cs.station_id,
        cs.name AS station_name,
        cs.location AS station_location,
        tp.plan_name,
        tp.rate_per_kwh
      FROM payment p
      INNER JOIN charging_session csess ON p.session_id = csess.session_id
      INNER JOIN \`user\` u ON csess.user_id = u.user_id
      INNER JOIN vehicle v ON csess.vehicle_id = v.vehicle_id
      INNER JOIN charging_point cp ON csess.point_id = cp.point_id
      INNER JOIN charging_station cs ON cp.station_id = cs.station_id
      INNER JOIN tariff_plan tp ON csess.plan_id = tp.plan_id
    `;
    const params = [];

    if (sessionId && !isNaN(Number(sessionId))) {
      sql += ` WHERE p.session_id = ?`;
      params.push(Number(sessionId));
    }

    sql += ` ORDER BY p.payment_id DESC`;

    const payments = await query(sql, params);
    return NextResponse.json({ data: payments });
  } catch (error) {
    return handleApiError(error, 'GET /api/payments');
  }
}

/**
 * POST /api/payments
 * Records a payment for a completed charging session.
 * Enforces 1:1 payment-to-session relationship, stored function fn_session_cost calculation,
 * and non-negative amount within an ACID transaction.
 */
export async function POST(request) {
  const auth = await requireAdminAuth(request);
  if (!auth.authenticated) return auth.response;

  try {
    const body = await request.json();
    const { session_id, amount, payment_method, payment_date } = body;

    const sessionIdNum = Number(session_id);
    if (!sessionIdNum || isNaN(sessionIdNum)) {
      return NextResponse.json({ error: 'A valid session_id is required.' }, { status: 400 });
    }

    const validMethods = ['UPI', 'Card', 'Cash', 'Net Banking'];
    const selectedMethod = payment_method ? String(payment_method).trim() : '';
    if (!selectedMethod || !validMethods.includes(selectedMethod)) {
      return NextResponse.json(
        { error: `Payment method must be one of: ${validMethods.join(', ')}.` },
        { status: 400 }
      );
    }

    // Format payment date (default to today YYYY-MM-DD)
    let pDate = null;
    if (payment_date) {
      pDate = String(payment_date).trim().slice(0, 10);
    }

    // Execute in transaction
    const newPayment = await withTransaction(async (conn) => {
      // 1. Lock the session row
      const [sessions] = await conn.query(
        `SELECT session_id, status, energy_consumed_kwh, plan_id FROM charging_session WHERE session_id = ? FOR UPDATE`,
        [sessionIdNum]
      );

      if (sessions.length === 0) {
        const err = new Error('Referenced charging session does not exist.');
        err.statusCode = 404;
        throw err;
      }

      const session = sessions[0];

      // 2. State machine rule: only completed sessions can be paid
      if (session.status !== 'completed') {
        const err = new Error('Business Rule Violation: Payment can only be recorded for completed sessions.');
        err.statusCode = 400;
        throw err;
      }

      // 3. 1:1 Relationship check (complemented by trg_payment_bi and UNIQUE key)
      const [existingPayments] = await conn.query(
        `SELECT payment_id FROM payment WHERE session_id = ?`,
        [sessionIdNum]
      );

      if (existingPayments.length > 0) {
        const err = new Error('Integrity Violation: A payment record already exists for this session (1:1 constraint).');
        err.statusCode = 409;
        throw err;
      }

      // 4. Calculate or validate amount via fn_session_cost
      const [costRows] = await conn.query(
        `SELECT fn_session_cost(?) AS cost`,
        [sessionIdNum]
      );
      const computedCost = costRows[0]?.cost !== null ? Number(costRows[0].cost) : null;

      let finalAmount = null;
      if (amount !== undefined && amount !== null && amount !== '') {
        finalAmount = parseFloat(amount);
      } else {
        finalAmount = computedCost !== null ? computedCost : 0.00;
      }

      if (isNaN(finalAmount) || finalAmount < 0) {
        const err = new Error('Validation Error: Payment amount cannot be negative.');
        err.statusCode = 400;
        throw err;
      }

      // 5. Insert payment row (trg_payment_bi will also fire as secondary guard)
      const insertSql = pDate
        ? `INSERT INTO payment (amount, payment_date, payment_method, session_id) VALUES (?, ?, ?, ?)`
        : `INSERT INTO payment (amount, payment_date, payment_method, session_id) VALUES (?, CURRENT_DATE, ?, ?)`;

      const insertParams = pDate
        ? [finalAmount, pDate, selectedMethod, sessionIdNum]
        : [finalAmount, selectedMethod, sessionIdNum];

      const [insertRes] = await conn.query(insertSql, insertParams);

      return {
        payment_id: insertRes.insertId,
        session_id: sessionIdNum,
        amount: finalAmount,
        payment_method: selectedMethod,
        payment_date: pDate || new Date().toISOString().slice(0, 10),
      };
    });

    return NextResponse.json(
      {
        message: 'Payment recorded successfully.',
        data: newPayment,
      },
      { status: 201 }
    );
  } catch (error) {
    if (error.statusCode) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    return handleApiError(error, 'POST /api/payments');
  }
}

/**
 * DELETE /api/payments
 * Deletes a payment by ?id=...
 * Reverts the session's derived payment status back to 'Pending'.
 */
export async function DELETE(request) {
  const auth = await requireAdminAuth(request);
  if (!auth.authenticated) return auth.response;

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    const paymentIdNum = Number(id);
    if (!paymentIdNum || isNaN(paymentIdNum)) {
      return NextResponse.json({ error: 'A valid payment ID is required.' }, { status: 400 });
    }

    // Protect original sample records from deletion
    if ([3, 4].includes(paymentIdNum)) {
      return NextResponse.json(
        { error: 'Integrity Protection: Original sample database records (Payments #3, #4) cannot be deleted.' },
        { status: 403 }
      );
    }

    const deleteSql = `DELETE FROM payment WHERE payment_id = ?`;
    const result = await query(deleteSql, [paymentIdNum]);

    if (result.affectedRows === 0) {
      return NextResponse.json({ error: 'Payment record not found.' }, { status: 404 });
    }

    return NextResponse.json({
      message: 'Payment deleted successfully. Associated session payment status is now Pending.',
    });
  } catch (error) {
    return handleApiError(error, 'DELETE /api/payments');
  }
}
