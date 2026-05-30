import pkg from 'pg';
const { Client } = pkg;
const c = new Client({
  connectionString: process.env.SUPABASE_DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});
await c.connect();
try {
  await c.query(`CREATE TABLE IF NOT EXISTS favourite_exercises (
    id SERIAL PRIMARY KEY,
    "userId" INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    exercise_name TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ DEFAULT NOW() NOT NULL
  )`);
  console.log('✅ favourite_exercises table created (or already exists)');
} catch (err) {
  console.error('❌ Error:', err.message);
} finally {
  await c.end();
}
