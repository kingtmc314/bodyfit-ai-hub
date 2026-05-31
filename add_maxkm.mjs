import pg from 'pg';
const { Client } = pg.default ?? pg;
const client = new Client({ connectionString: process.env.SUPABASE_DATABASE_URL, ssl: { rejectUnauthorized: false } });
await client.connect();
await client.query(`ALTER TABLE running_shoes ADD COLUMN IF NOT EXISTS max_km numeric DEFAULT 800`);
console.log('max_km column added');
await client.end();
