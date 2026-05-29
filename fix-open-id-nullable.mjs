import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.SUPABASE_DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function fix() {
  const client = await pool.connect();
  try {
    console.log('Connected to Supabase PostgreSQL');
    
    // Make open_id nullable since we're now using "openId" as the primary identifier
    await client.query(`
      ALTER TABLE public.users ALTER COLUMN open_id DROP NOT NULL
    `);
    console.log('Made open_id nullable');
    
    // Create a trigger to keep open_id in sync with openId for backwards compatibility
    await client.query(`
      CREATE OR REPLACE FUNCTION sync_open_id()
      RETURNS TRIGGER AS $$
      BEGIN
        IF NEW."openId" IS NOT NULL THEN
          NEW.open_id := NEW."openId";
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);
    
    await client.query(`
      DROP TRIGGER IF EXISTS sync_open_id_trigger ON public.users;
      CREATE TRIGGER sync_open_id_trigger
        BEFORE INSERT OR UPDATE ON public.users
        FOR EACH ROW
        EXECUTE FUNCTION sync_open_id();
    `);
    console.log('Created sync trigger for open_id');
    
    // Verify
    const result = await client.query(`
      SELECT column_name, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'users' AND table_schema = 'public' AND column_name IN ('open_id', 'openId')
    `);
    console.log('Column nullable status:', result.rows);
    
    console.log('✅ Fix applied successfully!');
  } catch (err) {
    console.error('Error:', err.message);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

fix().catch(e => { console.error(e); process.exit(1); });
