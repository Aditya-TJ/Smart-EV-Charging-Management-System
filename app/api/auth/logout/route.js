import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import {
  SESSION_COOKIE_NAME,
  getSessionCookieOptions,
  destroySession,
  validateCsrf,
} from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  // CSRF validation for state-changing logout
  const csrf = validateCsrf(request);
  if (!csrf.valid) return csrf.response;

  try {
    const cookieStore = cookies();
    const sessionToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;

    if (sessionToken) {
      await destroySession(sessionToken);
    }

    const response = NextResponse.json({
      success: true,
      message: 'Successfully logged out.',
    });

    // Clear the HTTP-only session cookie
    response.cookies.set(SESSION_COOKIE_NAME, '', {
      ...getSessionCookieOptions(),
      maxAge: 0,
      expires: new Date(0),
    });

    return response;
  } catch (error) {
    console.error('Logout Route Error:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred during logout.' },
      { status: 500 }
    );
  }
}
