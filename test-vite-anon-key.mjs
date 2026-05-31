import { config } from 'dotenv';
config();

const anon = process.env.SUPABASE_ANON_KEY;
const viteAnon = process.env.VITE_SUPABASE_ANON_KEY;

console.log('SUPABASE_ANON_KEY present:', !!anon);
console.log('VITE_SUPABASE_ANON_KEY present:', !!viteAnon);

if (anon && viteAnon) {
  console.log('Both keys present - OK');
  process.exit(0);
} else {
  console.log('MISSING KEY - check secrets');
  process.exit(1);
}
