import { config } from 'dotenv';
config();

// We need the Supabase Management API (not the project API) to configure auth settings.
// The Management API uses a personal access token, not the service role key.
// However, we can update the redirect URLs via the project's auth admin API.

const SUPABASE_URL = 'https://awvpavxgsikzmmrwspqp.supabase.co';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Test: create a magic link for the owner email to verify email auth works
const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
  method: 'GET',
  headers: {
    'apikey': SERVICE_KEY,
    'Authorization': `Bearer ${SERVICE_KEY}`,
  },
});

console.log('Admin users status:', res.status);
const data = await res.json();
console.log('Users:', JSON.stringify(data?.users?.map(u => ({ id: u.id, email: u.email, providers: u.app_metadata?.providers })), null, 2));
