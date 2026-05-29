import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.SUPABASE_DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function fixUsersTable() {
  const client = await pool.connect();
  try {
    console.log('Connected to Supabase PostgreSQL');
    
    // Check current columns
    const colResult = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'users' AND table_schema = 'public'
      ORDER BY ordinal_position
    `);
    console.log('Current users columns:', colResult.rows.map(r => r.column_name));
    
    // Add missing columns that the Drizzle schema expects
    // The Drizzle schema uses camelCase column names (quoted) for new columns
    // But the existing 'open_id' needs to be handled
    
    // Strategy: Update Drizzle schema to use the actual DB column names
    // But first, let's add the missing columns to the DB
    
    await client.query(`
      ALTER TABLE public.users 
      ADD COLUMN IF NOT EXISTS "openId" varchar(64),
      ADD COLUMN IF NOT EXISTS "loginMethod" varchar(64),
      ADD COLUMN IF NOT EXISTS "updatedAt" timestamp DEFAULT now(),
      ADD COLUMN IF NOT EXISTS "lastSignedIn" timestamp DEFAULT now(),
      ADD COLUMN IF NOT EXISTS "createdAt" timestamp DEFAULT now()
    `);
    console.log('Added missing columns to users table');
    
    // Copy open_id values to openId (for any existing rows)
    await client.query(`
      UPDATE public.users SET "openId" = open_id WHERE "openId" IS NULL AND open_id IS NOT NULL
    `);
    console.log('Copied open_id values to openId');
    
    // Check final columns
    const finalResult = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'users' AND table_schema = 'public'
      ORDER BY ordinal_position
    `);
    console.log('Final users columns:', finalResult.rows.map(r => r.column_name));
    
    console.log('✅ Users table fixed successfully!');
  } catch (err) {
    console.error('Error:', err.message);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

fixUsersTable().catch(e => { console.error(e); process.exit(1); });
