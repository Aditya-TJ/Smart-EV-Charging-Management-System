import { NextResponse } from 'next/server';

/**
 * Handle database and validation errors consistently across Route Handlers
 * @param {Error} error 
 * @param {string} customContext 
 * @returns {NextResponse}
 */
export function handleApiError(error, customContext = 'Operation') {
  console.error(`API Error in ${customContext}:`, error);

  // MySQL Error 1062: Duplicate entry for unique key
  if (error.code === 'ER_DUP_ENTRY' || error.errno === 1062) {
    let msg = 'A record with this unique identifier already exists.';
    if (error.sqlMessage && error.sqlMessage.includes('email')) {
      msg = 'This email address is already registered to another user.';
    } else if (error.sqlMessage && error.sqlMessage.includes('vehicle_number')) {
      msg = 'This vehicle registration number is already in the database.';
    } else if (error.sqlMessage && error.sqlMessage.includes('session_id')) {
      msg = 'A payment has already been recorded for this charging session (1:1 constraint).';
    }
    return NextResponse.json({ error: msg }, { status: 409 });
  }

  // MySQL Error 1451: Cannot delete or update a parent row: foreign key constraint fails
  if (error.code === 'ER_ROW_IS_REFERENCED_2' || error.errno === 1451) {
    return NextResponse.json(
      { error: 'Cannot delete: this record is currently referenced by other database records.' },
      { status: 409 }
    );
  }

  // MySQL Error 1452: Cannot add or update a child row: a foreign key constraint fails
  if (error.code === 'ER_NO_REFERENCED_ROW_2' || error.errno === 1452) {
    return NextResponse.json(
      { error: 'Invalid reference: The associated record does not exist in the database.' },
      { status: 400 }
    );
  }

  // MySQL Error 1644: Custom trigger exception raised via SIGNAL SQLSTATE '45000'
  if (error.code === 'ER_SIGNAL_EXCEPTION' || error.errno === 1644) {
    return NextResponse.json(
      { error: error.sqlMessage || 'Integrity or business rule violation.' },
      { status: 400 }
    );
  }

  // Fallback for general server errors
  return NextResponse.json(
    { error: error.message || 'An unexpected database error occurred.' },
    { status: 500 }
  );
}
