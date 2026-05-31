import { config } from 'dotenv';
config();

// Supabase Management API endpoint to update project auth config
// Requires a Management API token (personal access token), NOT service role key
// We'll use the service role key to call the admin API to update site_url and redirect_urls

const PROJECT_REF = 'awvpavxgsikzmmrwspqp';
const SUPABASE_URL = `https://${PROJECT_REF}.supabase.co`;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// The Supabase admin API doesn't allow updating site_url/redirect_urls via service role.
// We need to use the Management API with a personal access token.
// Let's check if we can use the auth admin endpoint to at least verify the setup.

// Try to send a magic link OTP to the owner email
const res = await fetch(`${SUPABASE_URL}/auth/v1/otp`, {
  method: 'POST',
  headers: {
    'apikey': process.env.SUPABASE_ANON_KEY,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    email: 'kingsleytsemc314@gmail.com',
    create_user: false,
  }),
});

console.log('OTP send status:', res.status);
const text = await res.text();
console.log('Response:', text);
