import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { handleApiError } from '@/lib/api-helpers';
import { requireAdminAuth } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/**
 * GET /api/vehicles
 * Lists vehicles joined with user details. Supports filtering by ?user_id=...
 */
export async function GET(request) {
  const auth = await requireAdminAuth(request);
  if (!auth.authenticated) return auth.response;

  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('user_id');

    let sql = `
      SELECT 
        v.vehicle_id,
        v.vehicle_number,
        v.model,
        v.battery_capacity,
        v.user_id,
        u.name AS owner_name,
        u.email AS owner_email,
        (SELECT COUNT(*) FROM charging_session cs WHERE cs.vehicle_id = v.vehicle_id) AS session_count
      FROM vehicle v
      INNER JOIN \`user\` u ON v.user_id = u.user_id
    `;
    const params = [];

    if (userId && !isNaN(Number(userId))) {
      sql += ` WHERE v.user_id = ?`;
      params.push(Number(userId));
    }

    sql += ` ORDER BY v.vehicle_id ASC`;

    const vehicles = await query(sql, params);
    return NextResponse.json({ data: vehicles });
  } catch (error) {
    return handleApiError(error, 'GET /api/vehicles');
  }
}

/**
 * POST /api/vehicles
 * Creates a new vehicle record.
 * Validates vehicle_number, model, battery_capacity (>0), user_id.
 */
export async function POST(request) {
  const auth = await requireAdminAuth(request);
  if (!auth.authenticated) return auth.response;

  try {
    const body = await request.json();
    const { vehicle_number, model, battery_capacity, user_id } = body;

    // Server-side validation
    if (!vehicle_number || typeof vehicle_number !== 'string' || vehicle_number.trim().length === 0) {
      return NextResponse.json({ error: 'Vehicle registration number is required.' }, { status: 400 });
    }
    if (!model || typeof model !== 'string' || model.trim().length === 0) {
      return NextResponse.json({ error: 'Vehicle model is required.' }, { status: 400 });
    }
    const capacity = Number(battery_capacity);
    if (isNaN(capacity) || capacity <= 0) {
      return NextResponse.json({ error: 'Battery capacity must be a positive decimal number.' }, { status: 400 });
    }
    const ownerId = Number(user_id);
    if (!ownerId || isNaN(ownerId)) {
      return NextResponse.json({ error: 'A valid owner must be selected.' }, { status: 400 });
    }

    // Verify owner exists in user table
    const [owner] = await query('SELECT user_id FROM `user` WHERE user_id = ?', [ownerId]);
    if (!owner) {
      return NextResponse.json({ error: 'The selected user does not exist in the database.' }, { status: 400 });
    }

    const insertSql = `
      INSERT INTO vehicle (vehicle_number, model, battery_capacity, user_id)
      VALUES (?, ?, ?, ?)
    `;
    const result = await query(insertSql, [
      vehicle_number.trim().toUpperCase(),
      model.trim(),
      capacity,
      ownerId,
    ]);

    return NextResponse.json(
      {
        message: 'Vehicle registered successfully',
        data: {
          vehicle_id: result.insertId,
          vehicle_number: vehicle_number.trim().toUpperCase(),
          model: model.trim(),
          battery_capacity: capacity,
          user_id: ownerId,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    return handleApiError(error, 'POST /api/vehicles');
  }
}

/**
 * PUT /api/vehicles
 * Updates an existing vehicle record.
 */
export async function PUT(request) {
  const auth = await requireAdminAuth(request);
  if (!auth.authenticated) return auth.response;

  try {
    const body = await request.json();
    const { vehicle_id, vehicle_number, model, battery_capacity, user_id } = body;

    if (!vehicle_id || isNaN(Number(vehicle_id))) {
      return NextResponse.json({ error: 'Valid vehicle_id is required.' }, { status: 400 });
    }
    if (!vehicle_number || typeof vehicle_number !== 'string' || vehicle_number.trim().length === 0) {
      return NextResponse.json({ error: 'Vehicle registration number is required.' }, { status: 400 });
    }
    if (!model || typeof model !== 'string' || model.trim().length === 0) {
      return NextResponse.json({ error: 'Vehicle model is required.' }, { status: 400 });
    }
    const capacity = Number(battery_capacity);
    if (isNaN(capacity) || capacity <= 0) {
      return NextResponse.json({ error: 'Battery capacity must be a positive decimal number.' }, { status: 400 });
    }
    const ownerId = Number(user_id);
    if (!ownerId || isNaN(ownerId)) {
      return NextResponse.json({ error: 'A valid owner must be selected.' }, { status: 400 });
    }

    const updateSql = `
      UPDATE vehicle
      SET vehicle_number = ?, model = ?, battery_capacity = ?, user_id = ?
      WHERE vehicle_id = ?
    `;
    const result = await query(updateSql, [
      vehicle_number.trim().toUpperCase(),
      model.trim(),
      capacity,
      ownerId,
      Number(vehicle_id),
    ]);

    if (result.affectedRows === 0) {
      return NextResponse.json({ error: 'Vehicle not found.' }, { status: 404 });
    }

    return NextResponse.json({ message: 'Vehicle updated successfully' });
  } catch (error) {
    return handleApiError(error, 'PUT /api/vehicles');
  }
}

/**
 * DELETE /api/vehicles
 * Deletes a vehicle by ?id=...
 * Enforces requirement: Delete blocked if vehicle has charging sessions.
 */
export async function DELETE(request) {
  const auth = await requireAdminAuth(request);
  if (!auth.authenticated) return auth.response;

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id || isNaN(Number(id))) {
      return NextResponse.json({ error: 'Valid vehicle ID is required.' }, { status: 400 });
    }
    const vehicleId = Number(id);

    // Block deletion if vehicle has recorded charging sessions
    const [sessions] = await query(
      `SELECT COUNT(*) AS count FROM charging_session WHERE vehicle_id = ?`,
      [vehicleId]
    );
    if (sessions && sessions.count > 0) {
      return NextResponse.json(
        {
          error: `Cannot delete vehicle: This vehicle is linked to ${sessions.count} charging session(s).`,
        },
        { status: 409 }
      );
    }

    const deleteSql = `DELETE FROM vehicle WHERE vehicle_id = ?`;
    const result = await query(deleteSql, [vehicleId]);

    if (result.affectedRows === 0) {
      return NextResponse.json({ error: 'Vehicle not found.' }, { status: 404 });
    }

    return NextResponse.json({ message: 'Vehicle deleted successfully' });
  } catch (error) {
    return handleApiError(error, 'DELETE /api/vehicles');
  }
}
