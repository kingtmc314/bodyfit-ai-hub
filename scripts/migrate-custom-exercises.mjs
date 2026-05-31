import pg from "pg";
const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.SUPABASE_DATABASE_URL || process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const sql = `
CREATE TABLE IF NOT EXISTS "custom_exercises" (
  "id" serial PRIMARY KEY NOT NULL,
  "userId" integer NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "name_zh" text DEFAULT '',
  "muscle_group" text NOT NULL DEFAULT 'other',
  "equipment" text NOT NULL DEFAULT 'Other',
  "instructions" text DEFAULT '',
  "photo_url" text,
  "file_key" text,
  "createdAt" timestamp DEFAULT now() NOT NULL
);
`;

try {
  await pool.query(sql);
  console.log("✅ custom_exercises table created (or already exists)");
} catch (e) {
  console.error("❌ Migration failed:", e.message);
} finally {
  await pool.end();
}
