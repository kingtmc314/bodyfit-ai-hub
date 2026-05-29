# BodyFit AI Hub — Render Deployment Guide

## Prerequisites
- GitHub account with this repo: `kingtmc314/bodyfit-ai-hub`
- Render account: https://render.com (free tier available)
- MySQL database (PlanetScale, Railway MySQL, or Render MySQL)

---

## Step 1 — Create a MySQL Database

### Option A: PlanetScale (Recommended, free tier)
1. Go to https://planetscale.com and create an account
2. Create a new database named `bodyfit`
3. Go to **Connect** → select **Node.js** → copy the connection string
4. Format: `mysql://user:pass@host/bodyfit?ssl={"rejectUnauthorized":true}`

### Option B: Railway MySQL
1. Go to https://railway.app → New Project → MySQL
2. Copy the `DATABASE_URL` from the Variables tab

---

## Step 2 — Deploy to Render

1. Go to https://render.com and sign in with GitHub
2. Click **New** → **Web Service**
3. Connect your GitHub account and select: `kingtmc314/bodyfit-ai-hub`
4. Configure:
   - **Name:** `bodyfit-ai-hub`
   - **Region:** Singapore (closest to HK)
   - **Branch:** `main`
   - **Runtime:** Node
   - **Build Command:** `pnpm install && pnpm build`
   - **Start Command:** `node dist/index.js`
   - **Plan:** Free (or Starter for better performance)

5. Click **Advanced** → **Add Environment Variable** and add:

| Key | Value |
|-----|-------|
| `NODE_ENV` | `production` |
| `DATABASE_URL` | Your MySQL connection string |
| `JWT_SECRET` | Any random 32+ char string |
| `VITE_APP_ID` | Your Manus App ID |
| `OAUTH_SERVER_URL` | `https://api.manus.im` |
| `VITE_OAUTH_PORTAL_URL` | `https://manus.im` |
| `OWNER_OPEN_ID` | Your Manus OpenID |
| `OWNER_NAME` | Your name |
| `BUILT_IN_FORGE_API_URL` | Manus Forge API URL |
| `BUILT_IN_FORGE_API_KEY` | Manus Forge API Key |
| `VITE_FRONTEND_FORGE_API_KEY` | Manus Frontend Forge Key |
| `VITE_FRONTEND_FORGE_API_URL` | Manus Frontend Forge URL |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | Your Google Service Account JSON (minified) |

6. Click **Create Web Service**

---

## Step 3 — Run Database Migrations

After the first deploy succeeds:

1. In Render dashboard → your service → **Shell** tab
2. Run: `node -e "import('./server/db.ts').then(m => console.log('DB connected'))"`
3. Or use the Render shell to run migrations manually

Alternatively, set up the database tables by running the SQL from `drizzle/migrations/` in your MySQL dashboard.

---

## Step 4 — Configure Manus OAuth

1. In your Manus developer settings, add the Render URL as an allowed redirect:
   `https://bodyfit-ai-hub.onrender.com/api/oauth/callback`
2. Update `VITE_APP_ID` with your Manus application ID

---

## Step 5 — Google Sheets Integration

1. Share your Google Spreadsheet with the service account email from `GOOGLE_SERVICE_ACCOUNT_JSON`
2. The email looks like: `xxx@your-project.iam.gserviceaccount.com`
3. Give it **Editor** access to the spreadsheet

---

## Automatic Deployments

Render automatically redeploys when you push to the `main` branch on GitHub.

```bash
git add .
git commit -m "Update feature"
git push origin main
# Render auto-deploys within ~2 minutes
```

---

## Custom Domain

1. In Render → Settings → Custom Domains
2. Add your domain (e.g., `fitness.yourdomain.com`)
3. Add the CNAME record in your DNS provider

---

## Health Check

The app exposes `/api/health` for Render's health checks.
If the service shows "unhealthy", check the logs in Render dashboard.

---

## Estimated Costs

| Plan | Cost | RAM | CPU |
|------|------|-----|-----|
| Free | $0/mo | 512 MB | 0.1 CPU (spins down after 15min) |
| Starter | $7/mo | 512 MB | 0.5 CPU (always on) |
| Standard | $25/mo | 2 GB | 1 CPU |

**Recommendation:** Start with Free, upgrade to Starter when you need always-on availability.
