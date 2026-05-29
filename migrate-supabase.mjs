/**
 * Supabase PostgreSQL Migration Script
 * Migrates the full BodyFit AI Hub schema to Supabase Life-OS PostgreSQL
 */
import pg from 'pg';
const { Client } = pg;

const url = process.env.SUPABASE_DATABASE_URL;
if (!url) {
  console.error('SUPABASE_DATABASE_URL not set');
  process.exit(1);
}

const client = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });

const schema = `
-- Users table
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  "openId" VARCHAR(64) NOT NULL UNIQUE,
  name TEXT,
  email VARCHAR(320),
  "loginMethod" VARCHAR(64),
  role VARCHAR(10) NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  "lastSignedIn" TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Exercises library
CREATE TABLE IF NOT EXISTS exercises (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  "muscleGroup" VARCHAR(100),
  "secondaryMuscles" TEXT,
  equipment VARCHAR(100),
  category VARCHAR(100),
  description TEXT,
  instructions TEXT,
  difficulty VARCHAR(50),
  "imageUrl" TEXT,
  "isCustom" BOOLEAN NOT NULL DEFAULT FALSE,
  "userId" INTEGER REFERENCES users(id) ON DELETE CASCADE,
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Workout sessions
CREATE TABLE IF NOT EXISTS workout_sessions (
  id SERIAL PRIMARY KEY,
  "userId" INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255),
  notes TEXT,
  duration INTEGER,
  "startTime" TIMESTAMP NOT NULL DEFAULT NOW(),
  "endTime" TIMESTAMP,
  "totalVolume" DECIMAL(10,2),
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Workout sets
CREATE TABLE IF NOT EXISTS workout_sets (
  id SERIAL PRIMARY KEY,
  "sessionId" INTEGER NOT NULL REFERENCES workout_sessions(id) ON DELETE CASCADE,
  "exerciseId" INTEGER NOT NULL REFERENCES exercises(id),
  "setNumber" INTEGER NOT NULL DEFAULT 1,
  reps INTEGER,
  weight DECIMAL(8,2),
  duration INTEGER,
  distance DECIMAL(8,2),
  notes TEXT,
  "isPersonalRecord" BOOLEAN NOT NULL DEFAULT FALSE,
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Food items library
CREATE TABLE IF NOT EXISTS food_items (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  brand VARCHAR(255),
  "servingSize" DECIMAL(8,2),
  "servingUnit" VARCHAR(50),
  calories DECIMAL(8,2),
  protein DECIMAL(8,2),
  carbs DECIMAL(8,2),
  fat DECIMAL(8,2),
  fiber DECIMAL(8,2),
  sugar DECIMAL(8,2),
  sodium DECIMAL(8,2),
  "isCustom" BOOLEAN NOT NULL DEFAULT FALSE,
  "userId" INTEGER REFERENCES users(id) ON DELETE CASCADE,
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Meal logs
CREATE TABLE IF NOT EXISTS meal_logs (
  id SERIAL PRIMARY KEY,
  "userId" INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  "foodItemId" INTEGER REFERENCES food_items(id),
  "foodName" VARCHAR(255) NOT NULL,
  "mealType" VARCHAR(50) NOT NULL DEFAULT 'snack' CHECK ("mealType" IN ('breakfast','lunch','dinner','snack')),
  "servings" DECIMAL(8,2) NOT NULL DEFAULT 1,
  calories DECIMAL(8,2),
  protein DECIMAL(8,2),
  carbs DECIMAL(8,2),
  fat DECIMAL(8,2),
  fiber DECIMAL(8,2),
  notes TEXT,
  "loggedAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  "photoUrl" TEXT,
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Body composition logs
CREATE TABLE IF NOT EXISTS body_composition (
  id SERIAL PRIMARY KEY,
  "userId" INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  weight DECIMAL(6,2),
  "bodyFatPct" DECIMAL(5,2),
  "muscleMass" DECIMAL(6,2),
  "fatMass" DECIMAL(6,2),
  "visceralFat" DECIMAL(5,2),
  bmi DECIMAL(5,2),
  bmr INTEGER,
  notes TEXT,
  source VARCHAR(50) DEFAULT 'manual',
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Heart rate logs
CREATE TABLE IF NOT EXISTS heart_rate_logs (
  id SERIAL PRIMARY KEY,
  "userId" INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  "restingHr" INTEGER,
  "highHr" INTEGER,
  hrv INTEGER,
  "avgHr" INTEGER,
  zone1 INTEGER,
  zone2 INTEGER,
  zone3 INTEGER,
  zone4 INTEGER,
  zone5 INTEGER,
  notes TEXT,
  source VARCHAR(50) DEFAULT 'manual',
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Sleep logs
CREATE TABLE IF NOT EXISTS sleep_logs (
  id SERIAL PRIMARY KEY,
  "userId" INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  "sleepScore" INTEGER,
  "bodyBattery" INTEGER,
  "pulseOx" DECIMAL(5,2),
  respiration DECIMAL(5,2),
  stress INTEGER,
  "sleepQuality" VARCHAR(50),
  "sleepDuration" DECIMAL(5,2),
  "deepSleep" DECIMAL(5,2),
  "remSleep" DECIMAL(5,2),
  "lightSleep" DECIMAL(5,2),
  "awakeDuration" DECIMAL(5,2),
  notes TEXT,
  source VARCHAR(50) DEFAULT 'manual',
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Progress photos
CREATE TABLE IF NOT EXISTS progress_photos (
  id SERIAL PRIMARY KEY,
  "userId" INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  "photoUrl" TEXT NOT NULL,
  "fileKey" TEXT NOT NULL,
  angle VARCHAR(50) DEFAULT 'front' CHECK (angle IN ('front','back','side','custom')),
  notes TEXT,
  weight DECIMAL(6,2),
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW()
);

-- AI insights cache
CREATE TABLE IF NOT EXISTS ai_insights (
  id SERIAL PRIMARY KEY,
  "userId" INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  period VARCHAR(50) NOT NULL DEFAULT 'weekly',
  content TEXT NOT NULL,
  "generatedAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  "weekStart" DATE,
  "weekEnd" DATE
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_meal_logs_user_date ON meal_logs ("userId", "loggedAt");
CREATE INDEX IF NOT EXISTS idx_body_comp_user_date ON body_composition ("userId", date);
CREATE INDEX IF NOT EXISTS idx_hr_logs_user_date ON heart_rate_logs ("userId", date);
CREATE INDEX IF NOT EXISTS idx_sleep_logs_user_date ON sleep_logs ("userId", date);
CREATE INDEX IF NOT EXISTS idx_workout_sessions_user ON workout_sessions ("userId");
CREATE INDEX IF NOT EXISTS idx_progress_photos_user ON progress_photos ("userId", date);
`;

async function migrate() {
  try {
    await client.connect();
    console.log('Connected to Supabase Life-OS PostgreSQL 17.6');
    
    await client.query(schema);
    console.log('✅ Schema migration complete — all 11 tables created');
    
    // Check tables
    const res = await client.query(`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `);
    console.log('Tables in database:', res.rows.map(r => r.table_name).join(', '));
    
    await client.end();
    console.log('Migration successful!');
  } catch (err) {
    console.error('Migration failed:', err.message);
    try { await client.end(); } catch {}
    process.exit(1);
  }
}

migrate();
