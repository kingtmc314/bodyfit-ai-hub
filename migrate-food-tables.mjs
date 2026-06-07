import pg from 'pg';
const { Client } = pg;

const client = new Client({ connectionString: process.env.SUPABASE_DATABASE_URL });
await client.connect();

try {
  await client.query(`
    CREATE TABLE IF NOT EXISTS food_favorites (
      id SERIAL PRIMARY KEY,
      "userId" INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      "foodName" VARCHAR(255) NOT NULL,
      calories REAL,
      protein REAL,
      carbs REAL,
      fat REAL,
      "servingSize" REAL,
      "servingUnit" VARCHAR(50),
      "createdAt" TIMESTAMP DEFAULT NOW() NOT NULL
    );

    CREATE TABLE IF NOT EXISTS food_analysis_history (
      id SERIAL PRIMARY KEY,
      "userId" INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      "photoUrl" TEXT,
      "analysisResult" TEXT NOT NULL,
      "totalCalories" REAL,
      "analyzedAt" TIMESTAMP DEFAULT NOW() NOT NULL
    );
  `);
  console.log('✅ food_favorites and food_analysis_history tables created');
} catch (err) {
  console.error('❌ Error:', err.message);
} finally {
  await client.end();
}
