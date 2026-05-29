import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.SUPABASE_DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function fixConstraints() {
  const client = await pool.connect();
  try {
    console.log('Connected to Supabase PostgreSQL');
    
    // First, copy all open_id values to openId for existing rows
    await client.query(`
      UPDATE public.users SET "openId" = open_id WHERE "openId" IS NULL AND open_id IS NOT NULL
    `);
    console.log('Synced open_id -> openId for existing rows');
    
    // Make openId NOT NULL
    await client.query(`
      ALTER TABLE public.users ALTER COLUMN "openId" SET NOT NULL
    `);
    console.log('Set openId NOT NULL');
    
    // Add UNIQUE constraint on openId (needed for onConflictDoUpdate)
    // First check if constraint already exists
    const constraintCheck = await client.query(`
      SELECT constraint_name FROM information_schema.table_constraints 
      WHERE table_name = 'users' AND table_schema = 'public' 
      AND constraint_type = 'UNIQUE' AND constraint_name LIKE '%openId%'
    `);
    
    if (constraintCheck.rows.length === 0) {
      await client.query(`
        ALTER TABLE public.users ADD CONSTRAINT users_openId_unique UNIQUE ("openId")
      `);
      console.log('Added UNIQUE constraint on openId');
    } else {
      console.log('UNIQUE constraint on openId already exists');
    }
    
    // Make createdAt NOT NULL with default
    await client.query(`
      UPDATE public.users SET "createdAt" = now() WHERE "createdAt" IS NULL
    `);
    await client.query(`
      ALTER TABLE public.users ALTER COLUMN "createdAt" SET NOT NULL,
                               ALTER COLUMN "createdAt" SET DEFAULT now()
    `);
    console.log('Fixed createdAt column');
    
    // Make updatedAt NOT NULL with default
    await client.query(`
      UPDATE public.users SET "updatedAt" = now() WHERE "updatedAt" IS NULL
    `);
    await client.query(`
      ALTER TABLE public.users ALTER COLUMN "updatedAt" SET NOT NULL,
                               ALTER COLUMN "updatedAt" SET DEFAULT now()
    `);
    console.log('Fixed updatedAt column');
    
    // Make lastSignedIn NOT NULL with default
    await client.query(`
      UPDATE public.users SET "lastSignedIn" = now() WHERE "lastSignedIn" IS NULL
    `);
    await client.query(`
      ALTER TABLE public.users ALTER COLUMN "lastSignedIn" SET NOT NULL,
                               ALTER COLUMN "lastSignedIn" SET DEFAULT now()
    `);
    console.log('Fixed lastSignedIn column');
    
    // Verify final state
    const result = await client.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'users' AND table_schema = 'public'
      ORDER BY ordinal_position
    `);
    console.log('\nFinal users table columns:');
    result.rows.forEach(r => console.log(`  ${r.column_name}: ${r.data_type} (nullable: ${r.is_nullable})`));
    
    // Check constraints
    const constraints = await client.query(`
      SELECT constraint_name, constraint_type 
      FROM information_schema.table_constraints 
      WHERE table_name = 'users' AND table_schema = 'public'
    `);
    console.log('\nConstraints:', constraints.rows);
    
    console.log('\n✅ Users table constraints fixed successfully!');
  } catch (err) {
    console.error('Error:', err.message);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

fixConstraints().catch(e => { console.error(e); process.exit(1); });
