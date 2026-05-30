import pg from "pg";
const { Pool } = pg;

const connStr = process.env.SUPABASE_DATABASE_URL || process.env.DATABASE_URL;
const pool = new Pool({ connectionString: connStr, ssl: { rejectUnauthorized: false }, max: 1 });

try {
  const client = await pool.connect();
  
  // Check columns
  const cols = await client.query(`
    SELECT column_name FROM information_schema.columns 
    WHERE table_name = 'exercises' ORDER BY ordinal_position
  `);
  console.log("Columns:", cols.rows.map(r => r.column_name).join(", "));
  
  // Count
  const count = await client.query(`SELECT COUNT(*) FROM exercises`);
  console.log(`Total exercises: ${count.rows[0].count}`);
  
  // All names with current description
  const names = await client.query(`SELECT id, name, "muscleGroup", description, instructions FROM exercises ORDER BY id`);
  console.log("\nAll exercises:");
  names.rows.forEach(r => {
    console.log(`[${r.id}] ${r.name} (${r.muscleGroup}) | desc: ${r.description ? r.description.substring(0,40) : 'NULL'} | inst: ${r.instructions ? r.instructions.substring(0,40) : 'NULL'}`);
  });
  
  client.release();
} catch (err) {
  console.error("Error:", err.message);
} finally {
  await pool.end();
}
