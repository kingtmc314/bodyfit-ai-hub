#!/bin/bash
# Set all environment variables on Vercel for production
export PATH="$PATH:/home/ubuntu/.local/share/pnpm"
cd /home/ubuntu/bodyfit-ai-hub

set_env() {
  local key="$1"
  local value="$2"
  echo "$value" | vercel env add "$key" production --yes 2>&1 || true
}

set_env "NODE_ENV" "production"
set_env "SUPABASE_DATABASE_URL" "postgresql://postgres.awvpavxgsikzmmrwspqp:mIh9GKcclFeycfpQ@aws-1-ap-northeast-1.pooler.supabase.com:5432/postgres"
set_env "JWT_SECRET" "8Fh6oLRj3GQMrvSGGY3S7q"
set_env "VITE_APP_ID" "hUA9en8TCa2tmDEpm7yCP7"
set_env "OAUTH_SERVER_URL" "https://api.manus.im"
set_env "VITE_OAUTH_PORTAL_URL" "https://manus.im"
set_env "OWNER_OPEN_ID" "itMKXHU54SsFYcQdboUA7b"
set_env "OWNER_NAME" "kingmath"
set_env "BUILT_IN_FORGE_API_URL" "https://forge.manus.ai"
set_env "BUILT_IN_FORGE_API_KEY" "cEU4zTD8JMt4aCBmC2SEwG"
set_env "VITE_FRONTEND_FORGE_API_KEY" "WYnbzETQX5KGmubrXcRg9R"
set_env "VITE_FRONTEND_FORGE_API_URL" "https://forge.manus.ai"

echo "All env vars set!"
