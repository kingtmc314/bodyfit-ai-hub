import { createRequire } from 'module';
const require = createRequire(import.meta.url);
require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.SUPABASE_DATABASE_URL, ssl: { rejectUnauthorized: false } });
const client = await pool.connect();
try {
  await client.query(`
    CREATE TABLE IF NOT EXISTS "fasting_logs" (
      "id" serial PRIMARY KEY NOT NULL,
      "userId" integer NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
      "fasting_type" varchar(32) NOT NULL DEFAULT '16:8',
      "target_hours" real NOT NULL DEFAULT 16,
      "start_time" timestamp NOT NULL,
      "end_time" timestamp,
      "actual_hours" real,
      "is_completed" boolean NOT NULL DEFAULT false,
      "notes" text,
      "createdAt" timestamp DEFAULT now() NOT NULL,
      "updatedAt" timestamp DEFAULT now() NOT NULL
    )
  `);
  await client.query(`CREATE INDEX IF NOT EXISTS "fasting_logs_userId_idx" ON "fasting_logs"("userId")`);
  console.log('✅ fasting_logs table created');
} catch(e) { console.error('❌', e.message); } finally { client.release(); await pool.end(); }
