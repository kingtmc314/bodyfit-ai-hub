import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({ connectionString: process.env.SUPABASE_DATABASE_URL, max: 1 });

const tables = [
  'body_composition',
  'heart_rate_logs',
  'sleep_logs',
  'workout_sessions',
  'meal_logs',
  'progress_photos',
  'ai_insights',
];

try {
  for (const table of tables) {
    const result = await pool.query(
      `UPDATE "${table}" SET "userId" = 2 WHERE "userId" = 42`
    );
    console.log(`✅ ${table}: updated ${result.rowCount} rows`);
  }
  console.log('\nAll done! userId 42 → 2 migration complete.');
} catch (e) {
  console.error('Error:', e.message);
} finally {
  await pool.end();
}
