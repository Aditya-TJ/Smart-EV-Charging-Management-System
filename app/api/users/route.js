import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { handleApiError } from '@/lib/api-helpers';
import { requireAdminAuth } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/**
 * GET /api/users
 * Lists users with optional search filter by name, email, or phone.
 * Calculates vehicle count per user via LEFT JOIN + GROUP BY.
 */
export async function GET(request) {
  const auth = await requireAdminAuth(request);
  if (!auth.authenticated) return auth.response;

  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search')?.trim() || '';

    let sql = `
      SELECT 
        u.user_id,
        u.name,
        u.email,
        u.phone,
        u.address,
        COUNT(v.vehicle_id) AS vehicle_count
      FROM \`user\` u
      LEFT JOIN vehicle v ON u.user_id = v.user_id
    `;
    const params = [];

    if (search) {
      sql += ` WHERE u.name LIKE ? OR u.email LIKE ? OR u.phone LIKE ?`;
      const searchPattern = `%${search}%`;
      params.push(searchPattern, searchPattern, searchPattern);
    }

    sql += ` GROUP BY u.user_id, u.name, u.email, u.phone, u.address ORDER BY u.user_id ASC`;

    const users = await query(sql, params);
    return NextResponse.json({ data: users });
  } catch (error) {
    return handleApiError(error, 'GET /api/users');
  }
}

/**
 * POST /api/users
 * Creates a new user record.
 * Validates name and email strictly on server.
 */
export async function POST(request) {
  const auth = await requireAdminAuth(request);
  if (!auth.authenticated) return auth.response;

  try {
    const body = await request.json();
    const { name, email, phone, address } = body;

    // Server-side validation
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json({ error: 'Name is required.' }, { status: 400 });
    }
    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return NextResponse.json({ error: 'A valid email address is required.' }, { status: 400 });
    }

    const insertSql = `
      INSERT INTO \`user\` (name, email, phone, address)
      VALUES (?, ?, ?, ?)
    `;
    const result = await query(insertSql, [
      name.trim(),
      email.trim().toLowerCase(),
      phone ? phone.trim() : null,
      address ? address.trim() : null,
    ]);

    return NextResponse.json(
      {
        message: 'User created successfully',
        data: {
          user_id: result.insertId,
          name: name.trim(),
          email: email.trim().toLowerCase(),
          phone: phone ? phone.trim() : null,
          address: address ? address.trim() : null,
          vehicle_count: 0,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    return handleApiError(error, 'POST /api/users');
  }
}

/**
 * PUT /api/users
 * Updates an existing user record by user_id.
 */
export async function PUT(request) {
  const auth = await requireAdminAuth(request);
  if (!auth.authenticated) return auth.response;

  try {
    const body = await request.json();
    const { user_id, name, email, phone, address } = body;

    if (!user_id || isNaN(Number(user_id))) {
      return NextResponse.json({ error: 'Valid user_id is required for update.' }, { status: 400 });
    }
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json({ error: 'Name is required.' }, { status: 400 });
    }
    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return NextResponse.json({ error: 'A valid email address is required.' }, { status: 400 });
    }

    const updateSql = `
      UPDATE \`user\`
      SET name = ?, email = ?, phone = ?, address = ?
      WHERE user_id = ?
    `;
    const result = await query(updateSql, [
      name.trim(),
      email.trim().toLowerCase(),
      phone ? phone.trim() : null,
      address ? address.trim() : null,
      Number(user_id),
    ]);

    if (result.affectedRows === 0) {
      return NextResponse.json({ error: 'User not found.' }, { status: 404 });
    }

    return NextResponse.json({ message: 'User updated successfully' });
  } catch (error) {
    return handleApiError(error, 'PUT /api/users');
  }
}

/**
 * DELETE /api/users
 * Deletes a user by ?id=...
 * Blocks deletion if the user owns vehicles or has sessions.
 */
export async function DELETE(request) {
  const auth = await requireAdminAuth(request);
  if (!auth.authenticated) return auth.response;

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id || isNaN(Number(id))) {
      return NextResponse.json({ error: 'Valid user ID is required.' }, { status: 400 });
    }
    const userId = Number(id);

    // Guard: Check if user owns vehicles
    const [vehicles] = await query(
      `SELECT COUNT(*) AS v_count FROM vehicle WHERE user_id = ?`,
      [userId]
    );
    if (vehicles && vehicles.v_count > 0) {
      return NextResponse.json(
        {
          error: `Cannot delete user: This user owns ${vehicles.v_count} registered vehicle(s). Please remove or reassign their vehicles first.`,
        },
        { status: 409 }
      );
    }

    // Guard: Check if user initiated sessions
    const [sessions] = await query(
      `SELECT COUNT(*) AS s_count FROM charging_session WHERE user_id = ?`,
      [userId]
    );
    if (sessions && sessions.s_count > 0) {
      return NextResponse.json(
        {
          error: `Cannot delete user: This user has ${sessions.s_count} active or historical charging session(s).`,
        },
        { status: 409 }
      );
    }

    const deleteSql = `DELETE FROM \`user\` WHERE user_id = ?`;
    const result = await query(deleteSql, [userId]);

    if (result.affectedRows === 0) {
      return NextResponse.json({ error: 'User not found.' }, { status: 404 });
    }

    return NextResponse.json({ message: 'User deleted successfully' });
  } catch (error) {
    return handleApiError(error, 'DELETE /api/users');
  }
}
