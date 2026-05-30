import pg from "pg";
const { Client } = pg;

// Get DB URL from the running server env
const dbUrl = process.env.SUPABASE_DATABASE_URL;
if (!dbUrl) {
  console.error("SUPABASE_DATABASE_URL not set");
  process.exit(1);
}

const client = new Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
await client.connect();
console.log("Connected to Supabase");

// List of ALTER TABLE statements to add missing columns
// Each is wrapped in a DO block to skip if already exists
const migrations = [
  // meal_logs: add servingSize
  `DO $$ BEGIN
    ALTER TABLE meal_logs ADD COLUMN "servingSize" real;
  EXCEPTION WHEN duplicate_column THEN NULL; END $$;`,

  // workout_sessions: add startTime, endTime, totalVolume
  `DO $$ BEGIN
    ALTER TABLE workout_sessions ADD COLUMN "startTime" timestamp;
  EXCEPTION WHEN duplicate_column THEN NULL; END $$;`,
  `DO $$ BEGIN
    ALTER TABLE workout_sessions ADD COLUMN "endTime" timestamp;
  EXCEPTION WHEN duplicate_column THEN NULL; END $$;`,
  `DO $$ BEGIN
    ALTER TABLE workout_sessions ADD COLUMN "totalVolume" real;
  EXCEPTION WHEN duplicate_column THEN NULL; END $$;`,

  // workout_sets: add all missing columns
  `DO $$ BEGIN
    ALTER TABLE workout_sets ADD COLUMN "exerciseName" varchar(255);
  EXCEPTION WHEN duplicate_column THEN NULL; END $$;`,
  `DO $$ BEGIN
    ALTER TABLE workout_sets ADD COLUMN "setNumber" integer;
  EXCEPTION WHEN duplicate_column THEN NULL; END $$;`,
  `DO $$ BEGIN
    ALTER TABLE workout_sets ADD COLUMN "reps" integer;
  EXCEPTION WHEN duplicate_column THEN NULL; END $$;`,
  `DO $$ BEGIN
    ALTER TABLE workout_sets ADD COLUMN "weight" real;
  EXCEPTION WHEN duplicate_column THEN NULL; END $$;`,
  `DO $$ BEGIN
    ALTER TABLE workout_sets ADD COLUMN "duration" integer;
  EXCEPTION WHEN duplicate_column THEN NULL; END $$;`,
  `DO $$ BEGIN
    ALTER TABLE workout_sets ADD COLUMN "distance" real;
  EXCEPTION WHEN duplicate_column THEN NULL; END $$;`,
  `DO $$ BEGIN
    ALTER TABLE workout_sets ADD COLUMN "notes" text;
  EXCEPTION WHEN duplicate_column THEN NULL; END $$;`,
  `DO $$ BEGIN
    ALTER TABLE workout_sets ADD COLUMN "createdAt" timestamp DEFAULT now();
  EXCEPTION WHEN duplicate_column THEN NULL; END $$;`,

  // heart_rate_logs: add zone columns
  `DO $$ BEGIN
    ALTER TABLE heart_rate_logs ADD COLUMN "zone1Minutes" integer;
  EXCEPTION WHEN duplicate_column THEN NULL; END $$;`,
  `DO $$ BEGIN
    ALTER TABLE heart_rate_logs ADD COLUMN "zone2Minutes" integer;
  EXCEPTION WHEN duplicate_column THEN NULL; END $$;`,
  `DO $$ BEGIN
    ALTER TABLE heart_rate_logs ADD COLUMN "zone3Minutes" integer;
  EXCEPTION WHEN duplicate_column THEN NULL; END $$;`,
  `DO $$ BEGIN
    ALTER TABLE heart_rate_logs ADD COLUMN "zone4Minutes" integer;
  EXCEPTION WHEN duplicate_column THEN NULL; END $$;`,
  `DO $$ BEGIN
    ALTER TABLE heart_rate_logs ADD COLUMN "zone5Minutes" integer;
  EXCEPTION WHEN duplicate_column THEN NULL; END $$;`,
  `DO $$ BEGIN
    ALTER TABLE heart_rate_logs ADD COLUMN "notes" text;
  EXCEPTION WHEN duplicate_column THEN NULL; END $$;`,
  `DO $$ BEGIN
    ALTER TABLE heart_rate_logs ADD COLUMN "source" varchar(50);
  EXCEPTION WHEN duplicate_column THEN NULL; END $$;`,

  // sleep_logs: add remaining missing columns
  `DO $$ BEGIN
    ALTER TABLE sleep_logs ADD COLUMN "lightSleep" real;
  EXCEPTION WHEN duplicate_column THEN NULL; END $$;`,
  `DO $$ BEGIN
    ALTER TABLE sleep_logs ADD COLUMN "awakeDuration" real;
  EXCEPTION WHEN duplicate_column THEN NULL; END $$;`,
  `DO $$ BEGIN
    ALTER TABLE sleep_logs ADD COLUMN "sleepQuality" varchar(20);
  EXCEPTION WHEN duplicate_column THEN NULL; END $$;`,
  `DO $$ BEGIN
    ALTER TABLE sleep_logs ADD COLUMN "notes" text;
  EXCEPTION WHEN duplicate_column THEN NULL; END $$;`,
  `DO $$ BEGIN
    ALTER TABLE sleep_logs ADD COLUMN "source" varchar(50);
  EXCEPTION WHEN duplicate_column THEN NULL; END $$;`,

  // body_composition: add missing columns
  `DO $$ BEGIN
    ALTER TABLE body_composition ADD COLUMN "fatMass" real;
  EXCEPTION WHEN duplicate_column THEN NULL; END $$;`,
  `DO $$ BEGIN
    ALTER TABLE body_composition ADD COLUMN "bmr" real;
  EXCEPTION WHEN duplicate_column THEN NULL; END $$;`,
  `DO $$ BEGIN
    ALTER TABLE body_composition ADD COLUMN "notes" text;
  EXCEPTION WHEN duplicate_column THEN NULL; END $$;`,
  `DO $$ BEGIN
    ALTER TABLE body_composition ADD COLUMN "source" varchar(50);
  EXCEPTION WHEN duplicate_column THEN NULL; END $$;`,

  // ai_insights: add period column
  `DO $$ BEGIN
    ALTER TABLE ai_insights ADD COLUMN "period" varchar(50);
  EXCEPTION WHEN duplicate_column THEN NULL; END $$;`,

  // progress_photos: add missing columns
  `DO $$ BEGIN
    ALTER TABLE progress_photos ADD COLUMN "angle" varchar(50);
  EXCEPTION WHEN duplicate_column THEN NULL; END $$;`,
  `DO $$ BEGIN
    ALTER TABLE progress_photos ADD COLUMN "notes" text;
  EXCEPTION WHEN duplicate_column THEN NULL; END $$;`,
  `DO $$ BEGIN
    ALTER TABLE progress_photos ADD COLUMN "weight" real;
  EXCEPTION WHEN duplicate_column THEN NULL; END $$;`,
  `DO $$ BEGIN
    ALTER TABLE progress_photos ADD COLUMN "bodyFatPct" real;
  EXCEPTION WHEN duplicate_column THEN NULL; END $$;`,
];

let success = 0;
let failed = 0;
for (const sql of migrations) {
  try {
    await client.query(sql);
    success++;
    process.stdout.write(".");
  } catch (err) {
    failed++;
    console.error(`\nFailed: ${err.message}\nSQL: ${sql.substring(0, 100)}`);
  }
}

console.log(`\n\nDone: ${success} succeeded, ${failed} failed`);
await client.end();
