import mysql from 'mysql2/promise';

// Prevent multiple connection pools during Next.js hot reloads in development
let pool = global.__dbPool;

if (!pool) {
  pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'smart_ev',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelay: 0,
    dateStrings: true, // Return dates as strings (YYYY-MM-DD HH:mm:ss) rather than UTC JS Dates
  });

  if (process.env.NODE_ENV !== 'production') {
    global.__dbPool = pool;
  }
}

/**
 * Execute a parameterised SQL query against the connection pool
 * @param {string} sql - SQL query with ? placeholders
 * @param {Array} params - Array of parameters
 * @returns {Promise<Array>} Query results
 */
export async function query(sql, params = []) {
  const [rows] = await pool.query(sql, params);
  return rows;
}

/**
 * Execute a sequence of queries within a single ACID transaction.
 * Automatically performs START TRANSACTION, COMMIT on success,
 * ROLLBACK on error, and always releases the connection.
 * @param {Function} callback - Async function receiving the dedicated connection
 * @returns {Promise<any>} Result of callback
 */
export async function withTransaction(callback) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const result = await callback(conn);
    await conn.commit();
    return result;
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}

export { pool };
const db = { query, withTransaction, pool };
export default db;
