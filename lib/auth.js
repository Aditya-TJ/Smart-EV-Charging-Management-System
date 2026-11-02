import crypto from 'crypto';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export const SESSION_COOKIE_NAME = 'admin_session_token';
export const SESSION_DURATION_HOURS = 24;
export const MAX_LOGIN_ATTEMPTS = 5;
export const LOCKOUT_MINUTES = 15;

/**
 * Computes a SHA-256 hash of a session token.
 * We store only the SHA-256 hash in MySQL admin_sessions table,
 * while the client receives the raw high-entropy token in the HTTP-only cookie.
 * @param {string} token - Raw session token
 * @returns {string} 64-character hex SHA-256 hash
 */
export function hashSessionToken(token) {
  if (!token || typeof token !== 'string') return '';
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Returns standardized secure cookie options for session token
 */
export function getSessionCookieOptions() {
  const isProduction = process.env.NODE_ENV === 'production';
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_DURATION_HOURS * 60 * 60,
  };
}

/**
 * Creates a new cryptographically secure session for an administrator.
 * The client is given the raw token, but only the SHA-256 hash is persisted in MySQL.
 * @param {number} adminId 
 * @param {object} meta - { userAgent, ipAddress }
 * @returns {Promise<{ sessionToken: string, expiresAt: Date }>}
 */
export async function createSession(adminId, meta = {}) {
  // Generate 64-character unguessable cryptographic token (256 bits of entropy)
  const sessionToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashSessionToken(sessionToken);
  const expiresAt = new Date(Date.now() + SESSION_DURATION_HOURS * 60 * 60 * 1000);

  // Clean up any stale expired sessions across the system
  await query('DELETE FROM admin_sessions WHERE expires_at < NOW()');

  // Insert session hash into MySQL
  await query(
    `INSERT INTO admin_sessions (session_id, admin_id, expires_at, ip_address, user_agent)
     VALUES (?, ?, ?, ?, ?)`,
    [
      tokenHash,
      adminId,
      expiresAt.toISOString().slice(0, 19).replace('T', ' '),
      (meta.ipAddress || 'unknown').slice(0, 45),
      (meta.userAgent || 'unknown').slice(0, 255),
    ]
  );

  return { sessionToken, expiresAt };
}

/**
 * Validates a raw session token against the MySQL admin_sessions table by hashing it.
 * @param {string} sessionToken - Raw token received from client cookie
 * @returns {Promise<{ admin_id: number, name: string, email: string } | null>}
 */
export async function validateSession(sessionToken) {
  if (!sessionToken || typeof sessionToken !== 'string' || sessionToken.length !== 64) {
    return null;
  }

  const tokenHash = hashSessionToken(sessionToken);

  const rows = await query(
    `SELECT u.admin_id, u.name, u.email, s.expires_at
     FROM admin_sessions s
     INNER JOIN admin_users u ON s.admin_id = u.admin_id
     WHERE s.session_id = ? AND s.expires_at > NOW()`,
    [tokenHash]
  );

  if (rows.length === 0) {
    return null;
  }

  const admin = rows[0];
  return {
    admin_id: admin.admin_id,
    name: admin.name,
    email: admin.email,
  };
}

/**
 * Invalidates and removes a session token from the database by hashing it.
 * @param {string} sessionToken - Raw token to invalidate
 */
export async function destroySession(sessionToken) {
  if (!sessionToken || typeof sessionToken !== 'string') return;
  const tokenHash = hashSessionToken(sessionToken);
  await query('DELETE FROM admin_sessions WHERE session_id = ?', [tokenHash]);
}

/**
 * Checks rate limiting for login attempts by IP address and normalized email.
 * Prevents bypasses through casing, formatting or fake forwarded headers.
 * @param {string} ipAddress 
 * @param {string} email
 * @returns {Promise<{ allowed: boolean, remainingMinutes?: number }>}
 */
export async function checkRateLimit(ipAddress, email = '') {
  const sanitizedIp = (ipAddress || 'unknown').trim().slice(0, 45);
  const normalizedEmail = (email || '').trim().toLowerCase().slice(0, 100);

  // 1. Check IP failure count
  const ipRows = await query(
    `SELECT COUNT(*) AS failure_count
     FROM admin_login_attempts
     WHERE ip_address = ? 
       AND is_successful = 0
       AND attempted_at > (NOW() - INTERVAL ? MINUTE)`,
    [sanitizedIp, LOCKOUT_MINUTES]
  );
  const ipFailures = ipRows[0]?.failure_count || 0;

  // 2. Check normalized email failure count
  let emailFailures = 0;
  if (normalizedEmail) {
    const emailRows = await query(
      `SELECT COUNT(*) AS failure_count
       FROM admin_login_attempts
       WHERE email = ?
         AND is_successful = 0
         AND attempted_at > (NOW() - INTERVAL ? MINUTE)`,
      [normalizedEmail, LOCKOUT_MINUTES]
    );
    emailFailures = emailRows[0]?.failure_count || 0;
  }

  if (ipFailures >= MAX_LOGIN_ATTEMPTS || emailFailures >= MAX_LOGIN_ATTEMPTS) {
    return {
      allowed: false,
      remainingMinutes: LOCKOUT_MINUTES,
    };
  }

  return { allowed: true };
}

/**
 * Records an administrator login attempt in the database with normalized email.
 * @param {string} ipAddress 
 * @param {string} email 
 * @param {boolean} isSuccessful 
 */
export async function recordLoginAttempt(ipAddress, email, isSuccessful) {
  const sanitizedIp = (ipAddress || 'unknown').trim().slice(0, 45);
  const normalizedEmail = (email || '').trim().toLowerCase().slice(0, 100);

  await query(
    `INSERT INTO admin_login_attempts (ip_address, email, is_successful)
     VALUES (?, ?, ?)`,
    [sanitizedIp, normalizedEmail, isSuccessful ? 1 : 0]
  );
}

/**
 * Resolves trusted application hosts from environment configuration and development defaults.
 * Prevents blindly trusting untrusted Host headers.
 * @param {Request} request 
 * @returns {Set<string>}
 */
function getTrustedHosts(request) {
  const trusted = new Set();

  const configuredUrls = [
    process.env.APP_URL,
    process.env.NEXT_PUBLIC_APP_URL,
    ...(process.env.TRUSTED_ORIGINS ? process.env.TRUSTED_ORIGINS.split(',') : []),
  ].filter(Boolean);

  for (const u of configuredUrls) {
    try {
      const parsed = new URL(u.trim());
      trusted.add(parsed.host.toLowerCase());
    } catch {
      trusted.add(u.trim().toLowerCase());
    }
  }

  // Standard development defaults
  trusted.add('localhost:3000');
  trusted.add('127.0.0.1:3000');
  trusted.add('localhost');
  trusted.add('127.0.0.1');

  // Verify incoming host matches valid pattern if configuredUrls is empty
  if (request && request.headers) {
    const rawHost = (request.headers.get('x-forwarded-host') || request.headers.get('host') || '').toLowerCase().trim();
    const candidateHost = rawHost.split(',')[0].trim();
    if (candidateHost && /^[a-zA-Z0-9.:_-]+$/.test(candidateHost)) {
      if (configuredUrls.length === 0) {
        trusted.add(candidateHost);
      }
    }
  }

  return trusted;
}

/**
 * Validates CSRF protections on state-changing HTTP requests.
 * Uses Sec-Fetch-Site and strict Origin/Referer matching against trusted application hosts.
 * @param {Request} request 
 * @returns {{ valid: boolean, response?: NextResponse }}
 */
export function validateCsrf(request) {
  if (!request || !request.method) return { valid: true };

  const method = request.method.toUpperCase();
  // Safe idempotent methods do not require CSRF validation
  if (['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    return { valid: true };
  }

  // 1. Sec-Fetch-Site guard: Reject cross-site requests immediately
  const secFetchSite = request.headers.get('sec-fetch-site');
  if (secFetchSite === 'cross-site') {
    return {
      valid: false,
      response: NextResponse.json(
        { error: 'Forbidden: Cross-site request rejected by CSRF protection.' },
        { status: 403 }
      ),
    };
  }

  // 2. Strict Origin / Referer validation against trusted application hosts
  const trustedHosts = getTrustedHosts(request);
  const origin = request.headers.get('origin');
  const referer = request.headers.get('referer');

  if (origin) {
    try {
      const originHost = new URL(origin).host.toLowerCase();
      if (!trustedHosts.has(originHost)) {
        return {
          valid: false,
          response: NextResponse.json(
            { error: 'Forbidden: Request origin is not an authorized application host.' },
            { status: 403 }
          ),
        };
      }
    } catch {
      return {
        valid: false,
        response: NextResponse.json(
          { error: 'Forbidden: Malformed Origin header.' },
          { status: 403 }
        ),
      };
    }
  } else if (referer) {
    try {
      const refererHost = new URL(referer).host.toLowerCase();
      if (!trustedHosts.has(refererHost)) {
        return {
          valid: false,
          response: NextResponse.json(
            { error: 'Forbidden: Request referer is not an authorized application host.' },
            { status: 403 }
          ),
        };
      }
    } catch {
      return {
        valid: false,
        response: NextResponse.json(
          { error: 'Forbidden: Malformed Referer header.' },
          { status: 403 }
        ),
      };
    }
  }

  return { valid: true };
}

/**
 * Authenticates the current incoming request against MySQL admin_sessions.
 * Validates CSRF for state-changing operations and hashes token with SHA-256 for lookup.
 * Returns { authenticated: true, admin } or { authenticated: false, response }
 */
export async function requireAdminAuth(request = null) {
  // 1. CSRF validation for all state-changing requests
  if (request) {
    const csrf = validateCsrf(request);
    if (!csrf.valid) {
      return {
        authenticated: false,
        response: csrf.response,
      };
    }
  }

  let sessionToken = null;

  // 2. Try reading from Next.js server cookie store
  try {
    const cookieStore = cookies();
    sessionToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  } catch {
    // If called where cookies() is unavailable, extract from request headers
  }

  // 3. Fallback to manual parsing from request headers if provided
  if (!sessionToken && request && request.headers) {
    const cookieHeader = request.headers.get('cookie') || '';
    const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${SESSION_COOKIE_NAME}=([^;]+)`));
    if (match) {
      sessionToken = match[1];
    }
  }

  if (!sessionToken) {
    return {
      authenticated: false,
      response: NextResponse.json(
        { error: 'Unauthorized: Administrator authentication required.' },
        { status: 401 }
      ),
    };
  }

  const admin = await validateSession(sessionToken);

  if (!admin) {
    return {
      authenticated: false,
      response: NextResponse.json(
        { error: 'Unauthorized: Session invalid or expired. Please sign in again.' },
        { status: 401 }
      ),
    };
  }

  return {
    authenticated: true,
    admin,
  };
}
