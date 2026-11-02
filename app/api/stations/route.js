import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { handleApiError } from '@/lib/api-helpers';
import { requireAdminAuth } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/**
 * GET /api/stations
 * Lists stations with total slots, status, contact_number,
 * and actual point counts (LEFT JOIN + GROUP BY).
 */
export async function GET(request) {
  const auth = await requireAdminAuth(request);
  if (!auth.authenticated) return auth.response;

  try {
    const sql = `
      SELECT 
        cs.station_id,
        cs.name,
        cs.location,
        cs.total_slots,
        cs.status,
        cs.contact_number,
        COUNT(cp.point_id) AS point_count
      FROM charging_station cs
      LEFT JOIN charging_point cp ON cs.station_id = cp.station_id
      GROUP BY cs.station_id, cs.name, cs.location, cs.total_slots, cs.status, cs.contact_number
      ORDER BY cs.station_id ASC
    `;
    const stations = await query(sql);
    return NextResponse.json({ data: stations });
  } catch (error) {
    return handleApiError(error, 'GET /api/stations');
  }
}

/**
 * POST /api/stations
 * Creates a new charging station.
 */
export async function POST(request) {
  const auth = await requireAdminAuth(request);
  if (!auth.authenticated) return auth.response;

  try {
    const body = await request.json();
    const { name, location, total_slots, status, contact_number } = body;

    // Validation
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json({ error: 'Station name is required.' }, { status: 400 });
    }
    if (!location || typeof location !== 'string' || location.trim().length === 0) {
      return NextResponse.json({ error: 'Station location is required.' }, { status: 400 });
    }
    const slots = parseInt(total_slots, 10);
    if (isNaN(slots) || slots < 1) {
      return NextResponse.json({ error: 'Total slots must be an integer >= 1.' }, { status: 400 });
    }
    const stationStatus = status === 'maintenance' ? 'maintenance' : 'active';

    const insertSql = `
      INSERT INTO charging_station (name, location, total_slots, status, contact_number)
      VALUES (?, ?, ?, ?, ?)
    `;
    const result = await query(insertSql, [
      name.trim(),
      location.trim(),
      slots,
      stationStatus,
      contact_number ? contact_number.trim() : null,
    ]);

    return NextResponse.json(
      {
        message: 'Station created successfully',
        data: {
          station_id: result.insertId,
          name: name.trim(),
          location: location.trim(),
          total_slots: slots,
          status: stationStatus,
          contact_number: contact_number ? contact_number.trim() : null,
          point_count: 0,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    return handleApiError(error, 'POST /api/stations');
  }
}

/**
 * PUT /api/stations
 * Updates an existing charging station.
 */
export async function PUT(request) {
  const auth = await requireAdminAuth(request);
  if (!auth.authenticated) return auth.response;

  try {
    const body = await request.json();
    const { station_id, name, location, total_slots, status, contact_number } = body;

    if (!station_id || isNaN(Number(station_id))) {
      return NextResponse.json({ error: 'Valid station_id is required.' }, { status: 400 });
    }
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json({ error: 'Station name is required.' }, { status: 400 });
    }
    if (!location || typeof location !== 'string' || location.trim().length === 0) {
      return NextResponse.json({ error: 'Station location is required.' }, { status: 400 });
    }
    const slots = parseInt(total_slots, 10);
    if (isNaN(slots) || slots < 1) {
      return NextResponse.json({ error: 'Total slots must be an integer >= 1.' }, { status: 400 });
    }
    const stationStatus = status === 'maintenance' ? 'maintenance' : 'active';

    const updateSql = `
      UPDATE charging_station
      SET name = ?, location = ?, total_slots = ?, status = ?, contact_number = ?
      WHERE station_id = ?
    `;
    const result = await query(updateSql, [
      name.trim(),
      location.trim(),
      slots,
      stationStatus,
      contact_number ? contact_number.trim() : null,
      Number(station_id),
    ]);

    if (result.affectedRows === 0) {
      return NextResponse.json({ error: 'Station not found.' }, { status: 404 });
    }

    return NextResponse.json({ message: 'Station updated successfully' });
  } catch (error) {
    return handleApiError(error, 'PUT /api/stations');
  }
}

/**
 * DELETE /api/stations
 * Deletes a station by ?id=...
 * Blocks deletion if the station has associated charging points.
 */
export async function DELETE(request) {
  const auth = await requireAdminAuth(request);
  if (!auth.authenticated) return auth.response;

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id || isNaN(Number(id))) {
      return NextResponse.json({ error: 'Valid station ID is required.' }, { status: 400 });
    }
    const stationId = Number(id);

    // Block deletion if station has points installed
    const [points] = await query(
      `SELECT COUNT(*) AS count FROM charging_point WHERE station_id = ?`,
      [stationId]
    );
    if (points && points.count > 0) {
      return NextResponse.json(
        {
          error: `Cannot delete station: This station currently contains ${points.count} charging point(s). Remove points first.`,
        },
        { status: 409 }
      );
    }

    const deleteSql = `DELETE FROM charging_station WHERE station_id = ?`;
    const result = await query(deleteSql, [stationId]);

    if (result.affectedRows === 0) {
      return NextResponse.json({ error: 'Station not found.' }, { status: 404 });
    }

    return NextResponse.json({ message: 'Station deleted successfully' });
  } catch (error) {
    return handleApiError(error, 'DELETE /api/stations');
  }
}
