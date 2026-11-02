import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET() {
  try {
    // 1. Basic connectivity check
    const pingResult = await query('SELECT 1 AS connected, VERSION() AS version, DATABASE() AS current_db');
    
    // 2. Query table counts in smart_ev
    const tablesResult = await query(
      `SELECT TABLE_NAME AS tableName, TABLE_ROWS AS approxRows 
       FROM information_schema.tables 
       WHERE table_schema = DATABASE() 
       ORDER BY TABLE_NAME`
    );

    return NextResponse.json({
      status: 'ok',
      database: 'connected',
      mysqlVersion: pingResult[0]?.version || 'unknown',
      databaseName: pingResult[0]?.current_db || 'unknown',
      tableCount: tablesResult.length,
      tables: tablesResult.map((t) => t.tableName),
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Health check database error:', error);
    return NextResponse.json(
      {
        status: 'error',
        database: 'disconnected',
        error: error.message,
      },
      { status: 500 }
    );
  }
}
