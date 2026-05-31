import { config } from 'dotenv';
config();

// Supabase Management API requires a personal access token (not service role)
// We can check auth config via the admin API with service role
const SUPABASE_URL = 'https://awvpavxgsikzmmrwspqp.supabase.co';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Check current auth settings via admin API
const res = await fetch(`${SUPABASE_URL}/auth/v1/settings`, {
  headers: {
    'apikey': SERVICE_KEY,
    'Authorization': `Bearer ${SERVICE_KEY}`,
  },
});

console.log('Auth settings status:', res.status);
const data = await res.json();
console.log('External providers enabled:', JSON.stringify(data.external, null, 2));
console.log('Site URL:', data.site_url);
console.log('Redirect URLs:', data.uri_allow_list);
