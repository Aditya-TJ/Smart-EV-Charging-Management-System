import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';

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

async function seedAdmin() {
  const adminName = process.env.INITIAL_ADMIN_NAME || 'System Administrator';
  const adminEmail = (process.env.INITIAL_ADMIN_EMAIL || '').trim().toLowerCase();
  const adminPassword = process.env.INITIAL_ADMIN_PASSWORD;

  if (!adminEmail || !adminPassword) {
    console.error('Error: INITIAL_ADMIN_EMAIL and INITIAL_ADMIN_PASSWORD must be configured in environment variables (.env.local).');
    process.exit(1);
  }

  const shouldUpdatePassword =
    process.argv.includes('--update-password') ||
    process.env.UPDATE_ADMIN_PASSWORD === 'true';

  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'smart_ev',
  });

  try {
    // Ensure admin_users table exists
    await connection.query(`
      CREATE TABLE IF NOT EXISTS admin_users (
        admin_id INT PRIMARY KEY AUTO_INCREMENT,
        name VARCHAR(100) NOT NULL,
        email VARCHAR(100) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_admin_email (email)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // Check if administrator already exists
    const [existing] = await connection.query(
      'SELECT admin_id, email FROM admin_users WHERE email = ?',
      [adminEmail]
    );

    const saltRounds = 12;

    if (existing.length > 0) {
      const adminId = existing[0].admin_id;

      if (shouldUpdatePassword) {
        // Safe, deliberate password update procedure
        const newPasswordHash = await bcrypt.hash(adminPassword, saltRounds);
        await connection.query(
          'UPDATE admin_users SET name = ?, password_hash = ? WHERE admin_id = ?',
          [adminName, newPasswordHash, adminId]
        );

        // Revoke active sessions for security
        await connection.query('DELETE FROM admin_sessions WHERE admin_id = ?', [adminId]);

        console.log(`✓ Administrator password for (${adminEmail}) updated successfully and existing sessions revoked.`);
      } else {
        console.log(`Administrator account (${adminEmail}) already exists. Existing credentials were preserved.`);
        console.log(`To explicitly update the password from environment variables, run: npm run db:seed-admin -- --update-password`);
      }
      return;
    }

    // Generate secure bcrypt hash with 12 salt rounds for new administrator
    const passwordHash = await bcrypt.hash(adminPassword, saltRounds);

    await connection.query(
      'INSERT INTO admin_users (name, email, password_hash) VALUES (?, ?, ?)',
      [adminName, adminEmail, passwordHash]
    );

    console.log(`✓ Initial administrator account (${adminEmail}) provisioned successfully.`);
  } catch (err) {
    console.error('Failed to seed administrator account:', err.message);
    process.exit(1);
  } finally {
    await connection.end();
  }
}

seedAdmin();
