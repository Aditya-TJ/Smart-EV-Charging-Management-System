import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { handleApiError } from '@/lib/api-helpers';
import { requireAdminAuth } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/**
 * GET /api/points
 * Lists charging points joined with station name.
 * Supports filters: ?station_id=..., ?status=..., ?available_only=true, ?distinct_connectors=true
 */
export async function GET(request) {
  const auth = await requireAdminAuth(request);
  if (!auth.authenticated) return auth.response;

  try {
    const { searchParams } = new URL(request.url);
    const stationId = searchParams.get('station_id');
    const status = searchParams.get('status');
    const availableOnly = searchParams.get('available_only') === 'true';
    const distinctConnectors = searchParams.get('distinct_connectors') === 'true';

    // 1. Return distinct connector types for dropdown suggestions
    if (distinctConnectors) {
      const rows = await query(
        `SELECT DISTINCT connector_type FROM charging_point ORDER BY connector_type ASC`
      );
      return NextResponse.json({ data: rows.map((r) => r.connector_type) });
    }

    // 2. Query view v_available_points for Project PDF required output
    if (availableOnly) {
      let viewSql = `
        SELECT 
          point_id,
          connector_type,
          power_rating_kw,
          point_status AS status,
          station_id,
          station_name,
          station_location,
          station_status,
          contact_number
        FROM v_available_points
      `;
      const viewParams = [];
      if (stationId && !isNaN(Number(stationId))) {
        viewSql += ` WHERE station_id = ?`;
        viewParams.push(Number(stationId));
      }
      viewSql += ` ORDER BY point_id ASC`;

      const availablePoints = await query(viewSql, viewParams);
      return NextResponse.json({ data: availablePoints });
    }

    // 3. Standard points list joined with station
    let sql = `
      SELECT 
        cp.point_id,
        cp.connector_type,
        cp.power_rating_kw,
        cp.status,
        cp.station_id,
        cs.name AS station_name,
        cs.location AS station_location,
        cs.status AS station_status,
        (SELECT COUNT(*) FROM charging_session csess WHERE csess.point_id = cp.point_id) AS session_count
      FROM charging_point cp
      INNER JOIN charging_station cs ON cp.station_id = cs.station_id
    `;
    const params = [];
    const conditions = [];

    if (stationId && !isNaN(Number(stationId))) {
      conditions.push('cp.station_id = ?');
      params.push(Number(stationId));
    }

    if (status && ['available', 'in-use', 'offline'].includes(status.toLowerCase())) {
      conditions.push('cp.status = ?');
      params.push(status.toLowerCase());
    }

    if (conditions.length > 0) {
      sql += ' WHERE ' + conditions.join(' AND ');
    }

    sql += ' ORDER BY cp.point_id ASC';

    const points = await query(sql, params);
    return NextResponse.json({ data: points });
  } catch (error) {
    return handleApiError(error, 'GET /api/points');
  }
}

/**
 * POST /api/points
 * Creates a new charging point (defaults to status = 'available').
 * Warns if total points will exceed total_slots of the station (Issue I6).
 */
export async function POST(request) {
  const auth = await requireAdminAuth(request);
  if (!auth.authenticated) return auth.response;

  try {
    const body = await request.json();
    const { connector_type, power_rating_kw, station_id } = body;

    // Validation
    if (!connector_type || typeof connector_type !== 'string' || connector_type.trim().length === 0) {
      return NextResponse.json({ error: 'Connector type is required.' }, { status: 400 });
    }
    const kw = parseFloat(power_rating_kw);
    if (isNaN(kw) || kw <= 0) {
      return NextResponse.json({ error: 'Power rating (kW) must be a positive decimal number.' }, { status: 400 });
    }
    const stationIdNum = Number(station_id);
    if (!stationIdNum || isNaN(stationIdNum)) {
      return NextResponse.json({ error: 'A valid station must be selected.' }, { status: 400 });
    }

    // Check station existence and slot capacity
    const [station] = await query(
      `SELECT station_id, name, total_slots FROM charging_station WHERE station_id = ?`,
      [stationIdNum]
    );
    if (!station) {
      return NextResponse.json({ error: 'The selected station does not exist.' }, { status: 400 });
    }

    const [currentPoints] = await query(
      `SELECT COUNT(*) AS count FROM charging_point WHERE station_id = ?`,
      [stationIdNum]
    );
    const pointCountAfter = (currentPoints?.count || 0) + 1;
    let slotWarning = null;
    if (pointCountAfter > station.total_slots) {
      slotWarning = `Note: Station "${station.name}" has ${station.total_slots} planned slots, but now hosts ${pointCountAfter} points.`;
    }

    const insertSql = `
      INSERT INTO charging_point (connector_type, power_rating_kw, status, station_id)
      VALUES (?, ?, 'available', ?)
    `;
    const result = await query(insertSql, [
      connector_type.trim(),
      kw,
      stationIdNum,
    ]);

    return NextResponse.json(
      {
        message: 'Charging point installed successfully',
        warning: slotWarning,
        data: {
          point_id: result.insertId,
          connector_type: connector_type.trim(),
          power_rating_kw: kw,
          status: 'available',
          station_id: stationIdNum,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    return handleApiError(error, 'POST /api/points');
  }
}

/**
 * PUT /api/points
 * Updates point details (connector_type, power_rating_kw, station_id).
 * Status remains system-managed by session lifecycle.
 */
export async function PUT(request) {
  const auth = await requireAdminAuth(request);
  if (!auth.authenticated) return auth.response;

  try {
    const body = await request.json();
    const { point_id, connector_type, power_rating_kw, station_id } = body;

    if (!point_id || isNaN(Number(point_id))) {
      return NextResponse.json({ error: 'Valid point_id is required.' }, { status: 400 });
    }
    if (!connector_type || typeof connector_type !== 'string' || connector_type.trim().length === 0) {
      return NextResponse.json({ error: 'Connector type is required.' }, { status: 400 });
    }
    const kw = parseFloat(power_rating_kw);
    if (isNaN(kw) || kw <= 0) {
      return NextResponse.json({ error: 'Power rating (kW) must be a positive decimal number.' }, { status: 400 });
    }
    const stationIdNum = Number(station_id);
    if (!stationIdNum || isNaN(stationIdNum)) {
      return NextResponse.json({ error: 'A valid station must be selected.' }, { status: 400 });
    }

    const updateSql = `
      UPDATE charging_point
      SET connector_type = ?, power_rating_kw = ?, station_id = ?
      WHERE point_id = ?
    `;
    const result = await query(updateSql, [
      connector_type.trim(),
      kw,
      stationIdNum,
      Number(point_id),
    ]);

    if (result.affectedRows === 0) {
      return NextResponse.json({ error: 'Charging point not found.' }, { status: 404 });
    }

    return NextResponse.json({ message: 'Charging point updated successfully' });
  } catch (error) {
    return handleApiError(error, 'PUT /api/points');
  }
}

/**
 * DELETE /api/points
 * Deletes a point by ?id=...
 * Enforces requirement: Delete blocked if the point has sessions.
 */
export async function DELETE(request) {
  const auth = await requireAdminAuth(request);
  if (!auth.authenticated) return auth.response;

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id || isNaN(Number(id))) {
      return NextResponse.json({ error: 'Valid point ID is required.' }, { status: 400 });
    }
    const pointId = Number(id);

    // Block deletion if point is linked to sessions
    const [sessions] = await query(
      `SELECT COUNT(*) AS count FROM charging_session WHERE point_id = ?`,
      [pointId]
    );
    if (sessions && sessions.count > 0) {
      return NextResponse.json(
        {
          error: `Cannot delete charging point: This charger has ${sessions.count} charging session(s) recorded against it.`,
        },
        { status: 409 }
      );
    }

    const deleteSql = `DELETE FROM charging_point WHERE point_id = ?`;
    const result = await query(deleteSql, [pointId]);

    if (result.affectedRows === 0) {
      return NextResponse.json({ error: 'Charging point not found.' }, { status: 404 });
    }

    return NextResponse.json({ message: 'Charging point deleted successfully' });
  } catch (error) {
    return handleApiError(error, 'DELETE /api/points');
  }
}
