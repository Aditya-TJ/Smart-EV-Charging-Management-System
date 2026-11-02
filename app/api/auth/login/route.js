import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { query } from '@/lib/db';
import {
  SESSION_COOKIE_NAME,
  getSessionCookieOptions,
  createSession,
  checkRateLimit,
  recordLoginAttempt,
  validateCsrf,
} from '@/lib/auth';

export const dynamic = 'force-dynamic';

// Constant-time dummy hash to prevent timing attacks when an email does not exist
const DUMMY_HASH = '$2b$12$e8Yk2uV5J4lQW8hZ0pL0xOyYk2uV5J4lQW8hZ0pL0xOyYk2uV5J4l';

export async function POST(request) {
  // CSRF validation for state-changing login
  const csrf = validateCsrf(request);
  if (!csrf.valid) return csrf.response;

  try {
    const body = await request.json().catch(() => ({}));
    const { email, password } = body;

    // 1. Input sanitization and presence validation
    if (!email || !password || typeof email !== 'string' || typeof password !== 'string') {
      return NextResponse.json(
        { error: 'Please provide both email and password.' },
        { status: 400 }
      );
    }

    const normalizedEmail = email.trim().toLowerCase();
    
    // Safe client IP extraction and sanitization
    let clientIp = '127.0.0.1';
    const xForwardedFor = request.headers.get('x-forwarded-for');
    if (xForwardedFor) {
      const candidate = xForwardedFor.split(',')[0].trim().replace(/[^a-fA-F0-9:.]/g, '');
      if (candidate && candidate.length <= 45) clientIp = candidate;
    } else {
      const xRealIp = request.headers.get('x-real-ip');
      if (xRealIp) {
        const candidate = xRealIp.trim().replace(/[^a-fA-F0-9:.]/g, '');
        if (candidate && candidate.length <= 45) clientIp = candidate;
      }
    }

    const userAgent = (request.headers.get('user-agent') || 'unknown').slice(0, 255);

    // 2. Brute-force and rate-limit guard (checks both IP and normalized email)
    const rateLimit = await checkRateLimit(clientIp, normalizedEmail);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          error: `Too many failed login attempts. For security, access from this address is temporarily restricted for ${rateLimit.remainingMinutes} minutes.`,
        },
        { status: 429 }
      );
    }

    // 3. Query administrator account
    const rows = await query(
      'SELECT admin_id, name, email, password_hash FROM admin_users WHERE email = ?',
      [normalizedEmail]
    );

    const admin = rows[0] || null;

    // 4. Secure password verification (constant time)
    const hashToCompare = admin ? admin.password_hash : DUMMY_HASH;
    const isPasswordValid = await bcrypt.compare(password, hashToCompare);

    if (!admin || !isPasswordValid) {
      // Record failed attempt
      await recordLoginAttempt(clientIp, normalizedEmail, false);

      // Do NOT reveal whether the email exists
      return NextResponse.json(
        { error: 'Invalid email or password.' },
        { status: 401 }
      );
    }

    // 5. Successful login: clear failed attempts for this IP and email, then record success
    await query(
      'DELETE FROM admin_login_attempts WHERE (ip_address = ? OR email = ?) AND is_successful = 0',
      [clientIp, normalizedEmail]
    );
    await recordLoginAttempt(clientIp, normalizedEmail, true);

    // 6. Session fixation protection: clear old sessions for this administrator
    await query('DELETE FROM admin_sessions WHERE admin_id = ?', [admin.admin_id]);

    // 7. Create cryptographically secure server session
    const { sessionToken } = await createSession(admin.admin_id, {
      userAgent,
      ipAddress: clientIp,
    });

    // 8. Construct response and set secure HTTP-only cookie
    const response = NextResponse.json({
      success: true,
      message: 'Authentication successful.',
      admin: {
        admin_id: admin.admin_id,
        name: admin.name,
        email: admin.email,
      },
    });

    response.cookies.set(SESSION_COOKIE_NAME, sessionToken, getSessionCookieOptions());

    return response;
  } catch (error) {
    console.error('Login Route Error:', error);
    return NextResponse.json(
      { error: 'An unexpected authentication error occurred.' },
      { status: 500 }
    );
  }
}
