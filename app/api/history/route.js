import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { handleApiError } from '@/lib/api-helpers';
import { requireAdminAuth } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/**
 * Validate a date string in YYYY-MM-DD format
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
 * GET /api/history
 * Query historical charging sessions from database view v_charging_history.
 * Supports filters: ?user_id=..., ?station_id=..., ?from_date=..., ?to_date=..., ?status=...
 * Applies window function: SUM(payment_amount) OVER (PARTITION BY user_id ORDER BY start_time ASC)
 * Computes user-level spending and session aggregates.
 */
export async function GET(request) {
  const auth = await requireAdminAuth(request);
  if (!auth.authenticated) return auth.response;

  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('user_id');
    const stationId = searchParams.get('station_id');
    const status = searchParams.get('status');
    const fromDate = searchParams.get('from_date');
    const toDate = searchParams.get('to_date');

    const conditions = [];
    const params = [];

    // 1. User Filter
    if (userId && !isNaN(Number(userId))) {
      conditions.push('h.user_id = ?');
      params.push(Number(userId));
    }

    // 2. Station Filter
    if (stationId && !isNaN(Number(stationId))) {
      conditions.push('h.station_id = ?');
      params.push(Number(stationId));
    }

    // 3. Status Filter
    if (status && ['ongoing', 'completed'].includes(status.toLowerCase())) {
      conditions.push('h.session_status = ?');
      params.push(status.toLowerCase());
    }

    // 4. Date Range Filters (Sargable comparison on start_time)
    if (fromDate) {
      if (!isValidDate(fromDate)) {
        return NextResponse.json({ error: 'Invalid from_date format. Must be YYYY-MM-DD.' }, { status: 400 });
      }
      conditions.push('h.start_time >= ?');
      params.push(fromDate);
    }

    if (toDate) {
      if (!isValidDate(toDate)) {
        return NextResponse.json({ error: 'Invalid to_date format. Must be YYYY-MM-DD.' }, { status: 400 });
      }
      conditions.push('h.start_time < DATE_ADD(?, INTERVAL 1 DAY)');
      params.push(toDate);
    }

    if (fromDate && toDate && fromDate > toDate) {
      return NextResponse.json(
        { error: 'Validation Error: from_date cannot be later than to_date.' },
        { status: 400 }
      );
    }

    const whereClause = conditions.length > 0 ? ' WHERE ' + conditions.join(' AND ') : '';

    // Main Query using v_charging_history with Window Function for Running Total
    const sql = `
      SELECT 
        h.session_id,
        h.start_time,
        h.end_time,
        h.duration_minutes,
        h.energy_consumed_kwh,
        h.session_status,
        h.user_id,
        h.user_name,
        h.user_email,
        h.user_phone,
        h.vehicle_id,
        h.vehicle_number,
        h.vehicle_model,
        h.station_id,
        h.station_name,
        h.station_location,
        h.point_id,
        h.connector_type,
        h.power_rating_kw,
        h.plan_id,
        h.plan_name,
        h.rate_per_kwh,
        h.payment_id,
        h.payment_amount,
        h.payment_date,
        h.payment_method,
        h.payment_status,
        fn_session_cost(h.session_id) AS computed_cost,
        SUM(COALESCE(h.payment_amount, 0.00)) OVER (
          PARTITION BY h.user_id 
          ORDER BY h.start_time ASC, h.session_id ASC
        ) AS running_total_spent
      FROM v_charging_history h
      ${whereClause}
      ORDER BY h.start_time DESC, h.session_id DESC
    `;

    const rows = await query(sql, params);

    // Summary calculations across returned rows (or specifically for filtered user)
    let totalEnergy = 0;
    let totalSpent = 0;
    let totalPending = 0;
    let completedCount = 0;
    let ongoingCount = 0;

    for (const row of rows) {
      totalEnergy += Number(row.energy_consumed_kwh || 0);
      if (row.payment_amount !== null) {
        totalSpent += Number(row.payment_amount);
      } else if (row.computed_cost !== null && row.session_status === 'completed') {
        totalPending += Number(row.computed_cost);
      }
      if (row.session_status === 'completed') completedCount++;
      if (row.session_status === 'ongoing') ongoingCount++;
    }

    let userDetails = null;
    if (userId && rows.length > 0) {
      userDetails = {
        user_id: rows[0].user_id,
        name: rows[0].user_name,
        email: rows[0].user_email,
        phone: rows[0].user_phone,
      };
    } else if (userId && !isNaN(Number(userId))) {
      // User has no sessions; fetch their profile directly
      const [u] = await query('SELECT user_id, name, email, phone FROM `user` WHERE user_id = ?', [Number(userId)]);
      if (u) userDetails = u;
    }

    return NextResponse.json({
      data: rows,
      summary: {
        total_sessions: rows.length,
        completed_sessions: completedCount,
        ongoing_sessions: ongoingCount,
        total_energy_kwh: Number(totalEnergy.toFixed(2)),
        total_amount_spent: Number(totalSpent.toFixed(2)),
        total_amount_pending: Number(totalPending.toFixed(2)),
        user: userDetails,
      },
    });
  } catch (error) {
    return handleApiError(error, 'GET /api/history');
  }
}
