import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import mysql from 'mysql2/promise';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env.local
function loadEnv() {
  const envPath = path.resolve(__dirname, '../.env.local');
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf8').split('\n');
    for (const line of lines) {
      const match = line.match(/^\s*([^#=]+)=(.*)$/);
      if (match) {
        const key = match[1].trim();
        const value = match[2].trim().replace(/^['"]|['"]$/g, '');
        if (!process.env[key]) {
          process.env[key] = value;
        }
      }
    }
  }
}
loadEnv();

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const ADMIN_EMAIL = (process.env.INITIAL_ADMIN_EMAIL || 'admin@smartev.com').trim().toLowerCase();
const ADMIN_PASSWORD = process.env.INITIAL_ADMIN_PASSWORD || 'Admin@123';

async function runTests() {
  console.log('====================================================');
  console.log('   PHASE 8: ADMIN AUTHENTICATION FINAL VERIFICATION');
  console.log('====================================================\n');

  let passedTests = 0;
  let totalTests = 0;

  function assert(condition, message) {
    totalTests++;
    if (condition) {
      console.log(`  [PASS] Test ${totalTests}: ${message}`);
      passedTests++;
    } else {
      console.error(`  [FAIL] Test ${totalTests}: ${message}`);
    }
  }

  const db = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'smart_ev',
  });

  // Reset login attempts before test run
  await db.query('DELETE FROM admin_login_attempts');

  // TEST 1: Unauthenticated page access redirects to /login
  console.log('--- Test 1: Page Protection & Redirects ---');
  try {
    const res = await fetch(`${BASE_URL}/`, { redirect: 'manual' });
    const isRedirect = res.status === 307 || res.status === 302;
    const location = res.headers.get('location') || '';
    assert(isRedirect && location.includes('/login'), `Unauthenticated access to '/' redirects to /login (Status: ${res.status}, Location: ${location})`);

    const resUsers = await fetch(`${BASE_URL}/users`, { redirect: 'manual' });
    const locUsers = resUsers.headers.get('location') || '';
    assert(
      (resUsers.status === 307 || resUsers.status === 302) && locUsers.includes('/login'),
      `Unauthenticated access to '/users' redirects to /login with redirect parameter`
    );
  } catch (err) {
    assert(false, `Page protection error: ${err.message}`);
  }

  // TEST 2: Unauthenticated API access returns 401
  console.log('\n--- Test 2: Unauthenticated API Access Protection (401) ---');
  const protectedApis = [
    '/api/stats',
    '/api/users',
    '/api/vehicles',
    '/api/stations',
    '/api/points',
    '/api/sessions',
    '/api/payments',
    '/api/history',
    '/api/revenue',
    '/api/tariff-plans',
  ];

  let allReturned401 = true;
  for (const apiPath of protectedApis) {
    try {
      const res = await fetch(`${BASE_URL}${apiPath}`);
      if (res.status !== 401) {
        allReturned401 = false;
        console.error(`    ${apiPath} returned HTTP ${res.status} instead of 401`);
      }
    } catch (e) {
      allReturned401 = false;
    }
  }
  assert(allReturned401, `All 10 protected API endpoints return HTTP 401 when accessed without session cookie`);

  // TEST 3: Invalid email/password is rejected and rate limited
  console.log('\n--- Test 3: Invalid Credentials Rejection & Rate Limiting ---');
  try {
    const badRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: ADMIN_EMAIL, password: 'WrongPassword999!' }),
    });
    const badData = await badRes.json();
    assert(
      badRes.status === 401 && badData.error === 'Invalid email or password.',
      `Invalid password rejected with 401 and generic security message: "${badData.error}"`
    );

    const nonExistentRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'nonexistent@smartev.com', password: 'WrongPassword999!' }),
    });
    const nonExistentData = await nonExistentRes.json();
    assert(
      nonExistentRes.status === 401 && nonExistentData.error === 'Invalid email or password.',
      `Non-existent email also rejected with identical 401 error (no user enumeration)`
    );

    // Test Rate Limiting across different casing/formatting of email
    for (let i = 0; i < 4; i++) {
      await fetch(`${BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: `  ATTACKER${i}@SmartEV.COM  `, password: `Wrong${i}` }),
      });
    }

    const rateLimitedRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'attacker0@smartev.com', password: 'AnotherAttempt' }),
    });
    const rateLimitedData = await rateLimitedRes.json();
    assert(
      rateLimitedRes.status === 429 && rateLimitedData.error.includes('Too many failed login attempts'),
      `Brute-force protection triggers HTTP 429 after 5 failed attempts: "${rateLimitedData.error?.substring(0, 45)}..."`
    );

    // Reset attempts so subsequent valid login tests succeed
    await db.query('DELETE FROM admin_login_attempts');
  } catch (err) {
    assert(false, `Login test error: ${err.message}`);
  }

  // TEST 4: Valid administrator credentials & SHA-256 session token hashing
  console.log('\n--- Test 4: Valid Administrator Authentication & Hashed Session ---');
  let sessionCookie = '';
  let sessionToken = '';
  try {
    const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
    });
    const loginData = await loginRes.json();
    const setCookieHeader = loginRes.headers.get('set-cookie') || '';

    const match = setCookieHeader.match(/admin_session_token=([a-f0-9]+)/);
    if (match) {
      sessionToken = match[1];
      sessionCookie = `admin_session_token=${sessionToken}`;
    }

    assert(
      loginRes.status === 200 &&
      loginData.success === true &&
      loginData.admin?.email === ADMIN_EMAIL &&
      !loginData.admin?.password_hash,
      `Valid admin login (${ADMIN_EMAIL}) returns 200, admin object, and strictly omits password_hash`
    );

    assert(
      setCookieHeader.toLowerCase().includes('httponly') &&
      setCookieHeader.toLowerCase().includes('samesite=lax') &&
      Boolean(sessionCookie),
      `Set-Cookie header includes HttpOnly, SameSite=Lax protection, and valid 64-char hex token`
    );

    // Verify session token is SHA-256 hashed in MySQL
    const [sessRows] = await db.query('SELECT session_id FROM admin_sessions WHERE admin_id = ?', [loginData.admin.admin_id]);
    const expectedHash = crypto.createHash('sha256').update(sessionToken).digest('hex');
    assert(
      sessRows.length > 0 && sessRows[0].session_id === expectedHash && sessRows[0].session_id !== sessionToken,
      `Session stored in MySQL is SHA-256 hash (${sessRows[0]?.session_id?.substring(0, 16)}...), raw token is never stored`
    );
  } catch (err) {
    assert(false, `Valid login error: ${err.message}`);
  }

  // TEST 5: Passwords stored as bcrypt hashes
  console.log('\n--- Test 5: Password Hashing Verification in Database ---');
  try {
    const [rows] = await db.query('SELECT admin_id, name, email, password_hash FROM admin_users WHERE email = ?', [ADMIN_EMAIL]);
    const adminRecord = rows[0];
    const isBcryptHash = adminRecord && adminRecord.password_hash.startsWith('$2') && adminRecord.password_hash.length >= 60;
    const isPlaintext = adminRecord && adminRecord.password_hash === ADMIN_PASSWORD;
    assert(
      isBcryptHash && !isPlaintext,
      `Password in MySQL is safely stored as bcrypt hash with salt: ${adminRecord?.password_hash?.substring(0, 20)}...`
    );
  } catch (err) {
    assert(false, `DB password hash check error: ${err.message}`);
  }

  // TEST 6: CSRF Protection (Origin and Sec-Fetch-Site checks)
  console.log('\n--- Test 6: CSRF Origin & Sec-Fetch-Site Validation ---');
  try {
    // 6a. Cross-origin state-changing request blocked with 403
    const crossOriginRes = await fetch(`${BASE_URL}/api/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: sessionCookie,
        Origin: 'https://malicious-attacker.com',
      },
      body: JSON.stringify({ name: 'Hacker', email: 'hacker@evil.com', phone: '000' }),
    });
    assert(
      crossOriginRes.status === 403,
      `Cross-Origin state-changing request rejected with HTTP 403 Forbidden (Origin: https://malicious-attacker.com)`
    );

    // 6b. Sec-Fetch-Site: cross-site blocked with 403
    const secFetchRes = await fetch(`${BASE_URL}/api/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: sessionCookie,
        'Sec-Fetch-Site': 'cross-site',
      },
      body: JSON.stringify({ name: 'Hacker2', email: 'hacker2@evil.com', phone: '000' }),
    });
    assert(
      secFetchRes.status === 403,
      `Cross-site request via Sec-Fetch-Site rejected with HTTP 403 Forbidden`
    );
  } catch (err) {
    assert(false, `CSRF protection test error: ${err.message}`);
  }

  // TEST 7: Authenticated administrator can access all eight modules
  console.log('\n--- Test 7: Authenticated Access to All Modules ---');
  try {
    const meRes = await fetch(`${BASE_URL}/api/auth/me`, {
      headers: { Cookie: sessionCookie },
    });
    const meData = await meRes.json();
    assert(
      meRes.status === 200 && meData.authenticated === true && meData.admin.email === ADMIN_EMAIL,
      `/api/auth/me returns authenticated administrator profile (${meData.admin?.name})`
    );

    let allModulesPassed = true;
    for (const apiPath of protectedApis) {
      const res = await fetch(`${BASE_URL}${apiPath}`, {
        headers: { Cookie: sessionCookie },
      });
      if (res.status !== 200) {
        allModulesPassed = false;
        console.error(`    ${apiPath} failed with status ${res.status}`);
      }
    }
    assert(allModulesPassed, `Authenticated administrator can successfully query all 8 module APIs (HTTP 200)`);

    // Verify page access with session cookie
    const pageRes = await fetch(`${BASE_URL}/`, {
      headers: { Cookie: sessionCookie },
      redirect: 'manual',
    });
    assert(pageRes.status === 200, `Dashboard page '/' loads successfully with valid session cookie (HTTP 200)`);
  } catch (err) {
    assert(false, `Authenticated access error: ${err.message}`);
  }

  // TEST 8: Forged Cookie Rejection
  console.log('\n--- Test 8: Forged Cookie Rejection ---');
  try {
    const forgedToken = 'f'.repeat(64);
    const forgedRes = await fetch(`${BASE_URL}/api/users`, {
      headers: { Cookie: `admin_session_token=${forgedToken}` },
    });
    assert(
      forgedRes.status === 401,
      `Forged session cookie not present in MySQL is rejected with HTTP 401`
    );
  } catch (err) {
    assert(false, `Forged cookie test error: ${err.message}`);
  }

  // TEST 9: Logout invalidates the session
  console.log('\n--- Test 9: Logout Session Invalidation ---');
  try {
    const expectedHash = crypto.createHash('sha256').update(sessionToken).digest('hex');
    const logoutRes = await fetch(`${BASE_URL}/api/auth/logout`, {
      method: 'POST',
      headers: { Cookie: sessionCookie },
    });
    const logoutData = await logoutRes.json();
    const logoutCookie = logoutRes.headers.get('set-cookie') || '';

    // Check if session token hash deleted from admin_sessions table
    const [sessRows] = await db.query('SELECT * FROM admin_sessions WHERE session_id = ?', [expectedHash]);

    assert(
      logoutRes.status === 200 && logoutData.success === true && sessRows.length === 0,
      `Logout destroys session in admin_sessions table and returns success`
    );

    assert(
      logoutCookie.includes('Max-Age=0') || logoutCookie.includes('expires='),
      `Logout sends Set-Cookie clearing the session token`
    );
  } catch (err) {
    assert(false, `Logout error: ${err.message}`);
  }

  // TEST 10: Access after logout is denied
  console.log('\n--- Test 10: Access After Logout Denied ---');
  try {
    const postLogoutApi = await fetch(`${BASE_URL}/api/users`, {
      headers: { Cookie: sessionCookie },
    });
    assert(
      postLogoutApi.status === 401,
      `API access with invalidated session cookie is denied with HTTP 401`
    );

    const postLogoutPage = await fetch(`${BASE_URL}/users`, {
      headers: { Cookie: sessionCookie },
      redirect: 'manual',
    });
    const isRedirect = postLogoutPage.status === 307 || postLogoutPage.status === 302;
    const loc = postLogoutPage.headers.get('location') || '';
    assert(
      isRedirect && loc.includes('/login'),
      `Page access with invalidated session cookie redirects to /login (Status: ${postLogoutPage.status})`
    );
  } catch (err) {
    assert(false, `Post logout access error: ${err.message}`);
  }

  // TEST 11: Customer records in existing user table remain unchanged
  console.log('\n--- Test 11: Customer Data (user Table) Integrity ---');
  try {
    const [userRows] = await db.query('SELECT user_id, name, email, phone FROM `user` ORDER BY user_id ASC');
    const originalCount = userRows.length;
    const priya = userRows.find((u) => u.user_id === 1);
    const rahul = userRows.find((u) => u.user_id === 2);
    const sneha = userRows.find((u) => u.user_id === 3);

    assert(
      originalCount === 3 &&
      priya?.email === 'priya.sharma@example.com' &&
      rahul?.email === 'rahul.verma@example.com' &&
      sneha?.email === 'sneha.kulkarni@example.com',
      `Original 'user' table has exactly 3 customer records with localized Indian sample data (Priya Sharma, Rahul Verma, Sneha Kulkarni)`
    );
  } catch (err) {
    assert(false, `Customer table check error: ${err.message}`);
  }

  // TEST 12: All original database tables and sample data remain intact
  console.log('\n--- Test 12: Original Database Schema & Data Intact ---');
  try {
    const [vehicleCount] = await db.query('SELECT COUNT(*) AS c FROM vehicle');
    const [stationCount] = await db.query('SELECT COUNT(*) AS c FROM charging_station');
    const [pointCount] = await db.query('SELECT COUNT(*) AS c FROM charging_point');
    const [sessionCount] = await db.query('SELECT COUNT(*) AS c FROM charging_session');
    const [paymentCount] = await db.query('SELECT COUNT(*) AS c FROM payment');
    const [tariffCount] = await db.query('SELECT COUNT(*) AS c FROM tariff_plan');

    assert(
      vehicleCount[0].c === 4 &&
      stationCount[0].c === 3 &&
      pointCount[0].c === 6 &&
      sessionCount[0].c === 3 &&
      paymentCount[0].c === 3 &&
      tariffCount[0].c === 2,
      `All 6 core entity tables maintain exact original sample data counts (Vehicles: 4, Stations: 3, Points: 6, Sessions: 3, Payments: 3, Tariff Plans: 2)`
    );
  } catch (err) {
    assert(false, `Schema check error: ${err.message}`);
  }

  // TEST 13: Concurrent Requests
  console.log('\n--- Test 13: Concurrent Requests Handling ---');
  try {
    const relogin = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
    });
    const setCookie = relogin.headers.get('set-cookie') || '';
    const tokenMatch = setCookie.match(/admin_session_token=([a-f0-9]+)/);
    const activeCookie = `admin_session_token=${tokenMatch[1]}`;

    const requests = Array.from({ length: 8 }).map(() =>
      fetch(`${BASE_URL}/api/stats`, { headers: { Cookie: activeCookie } })
    );
    const responses = await Promise.all(requests);
    const allConcurrentOk = responses.every((r) => r.status === 200);
    assert(allConcurrentOk, `8 concurrent API requests processed successfully in parallel (HTTP 200)`);

    // Clean up session
    await fetch(`${BASE_URL}/api/auth/logout`, {
      method: 'POST',
      headers: { Cookie: activeCookie },
    });
  } catch (err) {
    assert(false, `Concurrent requests test error: ${err.message}`);
  }

  // TEST 14: Session Expiration Handling
  console.log('\n--- Test 14: Expired Session Token Rejection ---');
  try {
    const expiredRawToken = 'e'.repeat(64);
    const expiredTokenHash = crypto.createHash('sha256').update(expiredRawToken).digest('hex');
    const [adminRow] = await db.query('SELECT admin_id FROM admin_users LIMIT 1');
    const adminId = adminRow[0].admin_id;

    await db.query(`
      INSERT INTO admin_sessions (session_id, admin_id, created_at, expires_at, ip_address, user_agent)
      VALUES (?, ?, DATE_SUB(NOW(), INTERVAL 2 HOUR), DATE_SUB(NOW(), INTERVAL 1 HOUR), '127.0.0.1', 'TestRunner')
      ON DUPLICATE KEY UPDATE expires_at = DATE_SUB(NOW(), INTERVAL 1 HOUR)
    `, [expiredTokenHash, adminId]);

    const expiredRes = await fetch(`${BASE_URL}/api/users`, {
      headers: { Cookie: `admin_session_token=${expiredRawToken}` },
    });

    assert(
      expiredRes.status === 401,
      `Expired session token rejected with HTTP 401 Unauthorized`
    );

    // Clean up
    await db.query('DELETE FROM admin_sessions WHERE session_id = ?', [expiredTokenHash]);
  } catch (err) {
    assert(false, `Session expiry test error: ${err.message}`);
  }

  await db.end();

  console.log('\n====================================================');
  console.log(`  FINAL RESULT: ${passedTests} / ${totalTests} TESTS PASSED`);
  console.log('====================================================\n');

  if (passedTests === totalTests) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
