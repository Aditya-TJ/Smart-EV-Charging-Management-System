import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { handleApiError } from '@/lib/api-helpers';

/**
 * GET /api/tariff-plans
 * Lists all available pricing tariff plans from TARIFF_PLAN entity.
 */
export async function GET() {
  try {
    const plans = await query(
      `SELECT plan_id, plan_name, rate_per_kwh FROM tariff_plan ORDER BY plan_id ASC`
    );
    return NextResponse.json({ data: plans });
  } catch (error) {
    return handleApiError(error, 'GET /api/tariff-plans');
  }
}
