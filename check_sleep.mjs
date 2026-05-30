import { drizzle } from 'drizzle-orm/node-postgres';
import pkg from 'pg';
const { Pool } = pkg;
import { sleepLogs } from './drizzle/schema.ts';
import { desc } from 'drizzle-orm';

// Read env from .env or process.env
import { readFileSync } from 'fs';
let dbUrl;
try {
  const env = readFileSync('.env', 'utf8');
  const match = env.match(/DATABASE_URL=(.+)/);
  if (match) dbUrl = match[1].trim();
} catch {}
if (!dbUrl) dbUrl = process.env.DATABASE_URL;

console.log('DB URL prefix:', dbUrl?.substring(0, 30));
const pool = new Pool({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
const db = drizzle(pool);

const rows = await db.select({
  id: sleepLogs.id,
  date: sleepLogs.date,
  deepSleep: sleepLogs.deepSleep,
  remSleep: sleepLogs.remSleep,
  lightSleep: sleepLogs.lightSleep,
  sleepDuration: sleepLogs.sleepDuration,
}).from(sleepLogs).orderBy(desc(sleepLogs.date)).limit(10);

console.log('Latest 10 sleep records:');
console.log(JSON.stringify(rows, null, 2));
await pool.end();
