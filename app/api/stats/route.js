import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET() {
  try {
    const statsSql = `
      SELECT 
        (SELECT COUNT(*) FROM \`user\`) AS usersCount,
        (SELECT COUNT(*) FROM vehicle) AS vehiclesCount,
        (SELECT COUNT(*) FROM charging_station) AS stationsCount,
        (SELECT COUNT(*) FROM charging_point) AS pointsCount,
        (SELECT COUNT(*) FROM charging_session) AS sessionsCount,
        (SELECT COUNT(*) FROM payment) AS paymentsCount
    `;
    const rows = await query(statsSql);
    const data = rows[0] || {
      usersCount: 0,
      vehiclesCount: 0,
      stationsCount: 0,
      pointsCount: 0,
      sessionsCount: 0,
      paymentsCount: 0,
    };

    return NextResponse.json({ data });
  } catch (error) {
    console.error('Error fetching home stats:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve database counts from MySQL' },
      { status: 500 }
    );
  }
}
