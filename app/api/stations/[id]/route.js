import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { handleApiError } from '@/lib/api-helpers';
import { requireAdminAuth } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/**
 * GET /api/stations/[id]
 * Returns full details for a station:
 * 1. Station record
 * 2. Installed charging points
 * 3. Read-only clean energy mix from station_energy_source JOIN energy_source
 */
export async function GET(request, { params }) {
  const auth = await requireAdminAuth(request);
  if (!auth.authenticated) return auth.response;

  try {
    const stationId = Number(params.id);
    if (isNaN(stationId)) {
      return NextResponse.json({ error: 'Invalid station ID.' }, { status: 400 });
    }

    // 1. Fetch station record
    const [station] = await query(
      `SELECT station_id, name, location, total_slots, status, contact_number
       FROM charging_station
       WHERE station_id = ?`,
      [stationId]
    );

    if (!station) {
      return NextResponse.json({ error: 'Station not found.' }, { status: 404 });
    }

    // 2. Fetch associated charging points
    const points = await query(
      `SELECT point_id, connector_type, power_rating_kw, status
       FROM charging_point
       WHERE station_id = ?
       ORDER BY point_id ASC`,
      [stationId]
    );

    // 3. Fetch read-only energy mix (M:N via station_energy_source)
    const energySources = await query(
      `SELECT 
         es.source_id,
         es.source_type,
         es.capacity_kw,
         ses.allocation_pct
       FROM station_energy_source ses
       INNER JOIN energy_source es ON ses.source_id = es.source_id
       WHERE ses.station_id = ?
       ORDER BY ses.allocation_pct DESC`,
      [stationId]
    );

    const totalAllocation = energySources.reduce(
      (sum, es) => sum + parseFloat(es.allocation_pct || 0),
      0
    );

    return NextResponse.json({
      data: {
        ...station,
        point_count: points.length,
        points,
        energy_sources: energySources,
        total_allocation_pct: Number(totalAllocation.toFixed(2)),
        is_allocation_complete: Math.abs(totalAllocation - 100) < 0.01,
      },
    });
  } catch (error) {
    return handleApiError(error, `GET /api/stations/${params.id}`);
  }
}
