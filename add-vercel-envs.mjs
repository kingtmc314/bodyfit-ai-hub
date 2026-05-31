// Add missing env vars to Vercel via API
const VERCEL_TOKEN = process.env.VERCEL_TOKEN;
const PROJECT_ID = 'bodyfit-ai-hub';
const TEAM_ID = 'team_jp4r6F6w3D5tjLCtXszjHuwb';

const envVars = [
  { key: 'VITE_SUPABASE_ANON_KEY', value: process.env.VITE_SUPABASE_ANON_KEY, type: 'encrypted', target: ['production', 'preview', 'development'] },
  { key: 'SUPABASE_ANON_KEY', value: process.env.SUPABASE_ANON_KEY, type: 'encrypted', target: ['production', 'preview', 'development'] },
  { key: 'SUPABASE_SERVICE_ROLE_KEY', value: process.env.SUPABASE_SERVICE_ROLE_KEY, type: 'encrypted', target: ['production', 'preview', 'development'] },
  { key: 'VITE_APP_TITLE', value: process.env.VITE_APP_TITLE, type: 'plain', target: ['production', 'preview', 'development'] },
  { key: 'VITE_APP_LOGO', value: process.env.VITE_APP_LOGO, type: 'plain', target: ['production', 'preview', 'development'] },
];

if (!VERCEL_TOKEN) {
  console.error('VERCEL_TOKEN not set');
  process.exit(1);
}

for (const env of envVars) {
  if (!env.value) {
    console.log(`Skipping ${env.key} - no value`);
    continue;
  }
  const res = await fetch(`https://api.vercel.com/v10/projects/${PROJECT_ID}/env?teamId=${TEAM_ID}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${VERCEL_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(env),
  });
  const data = await res.json();
  if (res.ok) {
    console.log(`✓ Added ${env.key}`);
  } else {
    console.log(`✗ Failed ${env.key}: ${data.error?.message || JSON.stringify(data)}`);
  }
}
