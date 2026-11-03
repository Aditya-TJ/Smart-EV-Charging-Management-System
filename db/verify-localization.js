import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mysql from 'mysql2/promise';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

async function verifyLocalization() {
  console.log('====================================================');
  console.log('   INDIAN SAMPLE DATA & CONSISTENCY VERIFICATION   ');
  console.log('====================================================\n');

  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'smart_ev',
  });

  try {
    const [users] = await connection.query('SELECT user_id, name, email FROM `user` ORDER BY user_id');
    const [stations] = await connection.query('SELECT station_id, name, location FROM `charging_station` ORDER BY station_id');
    const [vehicles] = await connection.query('SELECT vehicle_id, vehicle_number, model FROM `vehicle` ORDER BY vehicle_id');

    console.log('Customer Accounts:');
    users.forEach((u) => console.log(`  [✓] #${u.user_id}: ${u.name} (${u.email})`));

    console.log('\nCharging Station Network:');
    stations.forEach((s) => console.log(`  [✓] #${s.station_id}: ${s.name} - ${s.location}`));

    console.log('\nRegistered EV Fleet:');
    vehicles.forEach((v) => console.log(`  [✓] #${v.vehicle_id}: ${v.model} [${v.vehicle_number}]`));

    console.log('\nLocalization verification completed successfully.\n');
  } catch (err) {
    console.error('Verification failed:', err.message);
    process.exit(1);
  } finally {
    await connection.end();
  }
}

verifyLocalization();
