import pg from 'pg';
const { Client } = pg.default ?? pg;
const client = new Client({ connectionString: process.env.SUPABASE_DATABASE_URL, ssl: { rejectUnauthorized: false } });
await client.connect();
const r = await client.query(`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'running_shoes' ORDER BY ordinal_position`);
console.log(r.rows.map(c => `${c.column_name}: ${c.data_type}`).join('\n'));
await client.end();
