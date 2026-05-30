import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({ connectionString: process.env.SUPABASE_DATABASE_URL });

try {
  // Create enum
  await pool.query(`
    CREATE TYPE goal_type AS ENUM (
      'weight', 'body_fat_pct', 'muscle_mass',
      'sleep_duration', 'sleep_score',
      'resting_hr', 'hrv',
      'daily_calories', 'daily_protein',
      'workout_duration'
    )
  `);
  console.log('✓ Created goal_type enum');
} catch (e) {
  if (e.message.includes('already exists')) {
    console.log('✓ goal_type enum already exists');
  } else {
    throw e;
  }
}

await pool.query(`
  CREATE TABLE IF NOT EXISTS health_goals (
    id SERIAL PRIMARY KEY,
    "userId" INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    "goalType" goal_type NOT NULL,
    "targetValue" REAL NOT NULL,
    unit VARCHAR(30),
    notes TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
    "createdAt" TIMESTAMP DEFAULT NOW() NOT NULL,
    "updatedAt" TIMESTAMP DEFAULT NOW() NOT NULL
  )
`);
console.log('✓ Created health_goals table');

await pool.query(`
  CREATE UNIQUE INDEX IF NOT EXISTS health_goals_user_type_unique
    ON health_goals ("userId", "goalType")
    WHERE "isActive" = TRUE
`);
console.log('✓ Created unique index on (userId, goalType) WHERE isActive');

await pool.end();
console.log('Migration complete!');
