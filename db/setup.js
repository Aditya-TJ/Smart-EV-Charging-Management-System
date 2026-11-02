import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mysql from 'mysql2/promise';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Helper to load .env.local without external dotenv dependency
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

/**
 * Splits SQL file content into individual executable statements,
 * correctly handling dynamic DELIMITER switches (e.g. DELIMITER $$ and DELIMITER ;)
 * and preventing stored routine bodies from being split at internal semicolons.
 * @param {string} content - Raw SQL file text
 * @returns {string[]} Array of executable SQL statements
 */
export function parseSqlStatements(content) {
  const statements = [];
  let currentDelimiter = ';';
  let buffer = '';

  const lines = content.split('\n');

  for (let rawLine of lines) {
    const line = rawLine.replace(/\r$/, '');
    const trimmed = line.trim();

    // Skip empty lines or pure comment lines when buffer is empty
    if (buffer.trim() === '' && (trimmed === '' || trimmed.startsWith('--') || trimmed.startsWith('/*'))) {
      continue;
    }

    // Check for DELIMITER command (client-side only; never send to MySQL server)
    const delimiterMatch = trimmed.match(/^DELIMITER\s+(\S+)$/i);
    if (delimiterMatch) {
      currentDelimiter = delimiterMatch[1];
      continue;
    }

    buffer += line + '\n';

    // Check if buffer terminates with the current delimiter
    const bufferTrimmed = buffer.trim();
    if (bufferTrimmed.endsWith(currentDelimiter)) {
      let stmt = bufferTrimmed.slice(0, -currentDelimiter.length).trim();
      if (stmt.length > 0) {
        statements.push(stmt);
      }
      buffer = '';
    }
  }

  // Handle any remaining content
  if (buffer.trim().length > 0) {
    let stmt = buffer.trim();
    if (stmt.endsWith(currentDelimiter)) {
      stmt = stmt.slice(0, -currentDelimiter.length).trim();
    }
    if (stmt.length > 0) {
      statements.push(stmt);
    }
  }

  return statements;
}

async function runSetup() {
  console.log('--- Smart EV Database Setup (Additive Objects Only) ---');

  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'smart_ev',
    multipleStatements: true,
  });

  // Strictly ONLY the approved additive SQL files in sequential dependency order.
  // schema.sql, data.sql, and optional_demo_data_fix.sql are EXCLUDED to protect live data.
  const sqlFiles = [
    '01_views.sql',        // 1. Relational Views (v_available_points, v_charging_history, v_station_revenue)
    '02_functions.sql',    // 2. Stored Function (fn_session_cost)
    '03_triggers.sql',     // 3. Validation & 1:1 Integrity Triggers (trg_session_bi/bu, trg_payment_bi)
    '04_procedures.sql',   // 4. Stored Procedure (sp_station_revenue)
    '05_demo_queries.sql', // 5. Viva Demo Queries verification
    '06_admin_auth.sql',   // 6. Administrator Authentication & Session tables
  ];

  try {
    for (const file of sqlFiles) {
      const filePath = path.join(__dirname, file);
      console.log(`Executing ${file}...`);
      const content = fs.readFileSync(filePath, 'utf8');
      const statements = parseSqlStatements(content);

      for (let i = 0; i < statements.length; i++) {
        await connection.query(statements[i]);
      }

      console.log(`✓ ${file} (${statements.length} statement${statements.length === 1 ? '' : 's'}) executed successfully.`);
    }

    console.log('--- All 6 additive database scripts verified and deployed successfully! ---');
  } catch (err) {
    console.error('Database setup failed:', err.message);
    process.exit(1);
  } finally {
    await connection.end();
  }
}

// Only auto-run if executed directly as script
if (process.argv[1] && process.argv[1].endsWith('setup.js')) {
  runSetup();
}
