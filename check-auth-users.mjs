import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
config();

const supabase = createClient(
  'https://awvpavxgsikzmmrwspqp.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const { data, error } = await supabase.auth.admin.listUsers();
if (error) {
  console.error('Error:', error.message);
  process.exit(1);
}
console.log('Total Supabase auth users:', data.users.length);
data.users.forEach(u => {
  console.log(` - ${u.email} | provider: ${u.app_metadata?.provider} | confirmed: ${!!u.email_confirmed_at} | id: ${u.id}`);
});
