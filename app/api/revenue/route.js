import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { handleApiError } from '@/lib/api-helpers';

export const dynamic = 'force-dynamic';

/**
 * Validate YYYY-MM-DD date string
 * @param {string} dateStr 
 * @returns {boolean}
 */
function isValidDate(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') return false;
  const regex = /^\d{4}-\d{2}-\d{2}$/;
  if (!regex.test(dateStr)) return false;
  const d = new Date(dateStr);
  return d instanceof Date && !isNaN(d.getTime());
}

/**
 * GET /api/revenue
 * Calculates station-wise revenue and energy consumption.
 * When date filters are provided: calls stored procedure sp_station_revenue(from_date, to_date).
 * When no date filters: queries database view v_station_revenue.
 * Also queries CTE + DENSE_RANK() for stations ranked by number of charging sessions.
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const fromDate = searchParams.get('from_date');
    const toDate = searchParams.get('to_date');

    // 1. Date Validation
    if (fromDate && !isValidDate(fromDate)) {
      return NextResponse.json({ error: 'Invalid from_date format. Expected YYYY-MM-DD.' }, { status: 400 });
    }
    if (toDate && !isValidDate(toDate)) {
      return NextResponse.json({ error: 'Invalid to_date format. Expected YYYY-MM-DD.' }, { status: 400 });
    }
    if (fromDate && toDate && fromDate > toDate) {
      return NextResponse.json(
        { error: 'Validation Error: from_date cannot be later than to_date.' },
        { status: 400 }
      );
    }

    const isDateFiltered = Boolean(fromDate || toDate);

    // 2. Query Station Revenue: use sp_station_revenue if date range provided, else v_station_revenue
    let stationRevenue = [];
    let dataSource = 'v_station_revenue';

    if (isDateFiltered) {
      dataSource = 'sp_station_revenue';
      // Stored procedure returns [[rows], packet] in mysql2
      const procResult = await query(
        `CALL sp_station_revenue(?, ?)`,
        [fromDate || null, toDate || null]
      );
      stationRevenue = Array.isArray(procResult) && Array.isArray(procResult[0])
        ? procResult[0]
        : procResult;
    } else {
      stationRevenue = await query(
        `SELECT * FROM v_station_revenue ORDER BY total_revenue DESC, session_count DESC`
      );
    }

    // 3. Query Station Ranking by Session Count using CTE + DENSE_RANK() (Project PDF required query)
    const rankingSql = `
      WITH StationActivity AS (
        SELECT 
          cs.station_id,
          cs.name AS station_name,
          cs.location,
          cs.status AS station_status,
          cs.total_slots,
          COUNT(DISTINCT cp.point_id) AS total_points,
          COUNT(csess.session_id) AS session_count,
          COALESCE(SUM(csess.energy_consumed_kwh), 0.00) AS total_energy_kwh,
          COALESCE(SUM(p.amount), 0.00) AS total_revenue
        FROM charging_station cs
        LEFT JOIN charging_point cp ON cs.station_id = cp.station_id
        LEFT JOIN charging_session csess ON cp.point_id = csess.point_id
          AND (? IS NULL OR csess.start_time >= ?)
          AND (? IS NULL OR csess.start_time < DATE_ADD(?, INTERVAL 1 DAY))
        LEFT JOIN payment p ON csess.session_id = p.session_id
        GROUP BY cs.station_id, cs.name, cs.location, cs.status, cs.total_slots
      )
      SELECT 
        station_id,
        station_name,
        location,
        station_status,
        total_slots,
        total_points,
        session_count,
        total_energy_kwh,
        total_revenue,
        DENSE_RANK() OVER (ORDER BY session_count DESC, total_revenue DESC) AS session_rank
      FROM StationActivity
      ORDER BY session_rank ASC, station_name ASC
    `;

    const rankingParams = [
      fromDate || null,
      fromDate || null,
      toDate || null,
      toDate || null,
    ];

    const stationRanking = await query(rankingSql, rankingParams);

    // 4. Compute System-Wide Totals
    let sysRevenue = 0;
    let sysEnergy = 0;
    let sysSessions = 0;

    for (const st of stationRevenue) {
      sysRevenue += Number(st.total_revenue || 0);
      sysEnergy += Number(st.total_energy_kwh || 0);
      sysSessions += Number(st.session_count || 0);
    }

    return NextResponse.json({
      station_revenue: stationRevenue,
      station_ranking: stationRanking,
      summary: {
        total_revenue: Number(sysRevenue.toFixed(2)),
        total_energy_kwh: Number(sysEnergy.toFixed(2)),
        total_sessions: sysSessions,
        total_stations: stationRevenue.length,
        average_revenue_per_station:
          stationRevenue.length > 0 ? Number((sysRevenue / stationRevenue.length).toFixed(2)) : 0.00,
      },
      filters: {
        from_date: fromDate || null,
        to_date: toDate || null,
      },
      source: dataSource,
    });
  } catch (error) {
    return handleApiError(error, 'GET /api/revenue');
  }
}
