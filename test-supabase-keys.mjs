import { config } from 'dotenv';
config();

const key = process.env.SUPABASE_ANON_KEY;
const svcKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const url = 'https://awvpavxgsikzmmrwspqp.supabase.co';

console.log('Anon key present:', !!key, key ? key.substring(0, 20) + '...' : 'MISSING');
console.log('Service key present:', !!svcKey, svcKey ? svcKey.substring(0, 20) + '...' : 'MISSING');

// Test with service role key (bypasses RLS)
const res = await fetch(`${url}/rest/v1/users?select=id&limit=1`, {
  headers: {
    apikey: svcKey,
    Authorization: `Bearer ${svcKey}`,
  },
});
console.log('REST API status:', res.status);
const text = await res.text();
console.log('Response:', text.substring(0, 200));
