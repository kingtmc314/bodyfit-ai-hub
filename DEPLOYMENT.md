# BodyFit AI Hub — Deployment Guide

## GitHub Repository

Source code: **https://github.com/kingtmc314/bodyfit-ai-hub**

---

## Architecture Note

This app uses a **full Node.js Express server** (tRPC + Vite SSR) which requires a **persistent server runtime**. It is **not compatible** with Vercel's serverless model without significant refactoring.

### Recommended Deployment Options

| Platform | Compatibility | Notes |
|---|---|---|
| **Manus Built-in Hosting** | ✅ Native | Click Publish in Management UI — zero config |
| **Railway** | ✅ Full | Supports persistent Node.js servers |
| **Render** | ✅ Full | Free tier available, supports Node.js |
| **Fly.io** | ✅ Full | Docker-based, excellent for Node.js |
| **Vercel** | ⚠️ Partial | Requires serverless refactor (not recommended) |

---

## Option 1: Manus Built-in Hosting (Recommended)

1. Open the project in Manus
2. Create a checkpoint via the Management UI
3. Click the **Publish** button in the Management UI header
4. Your app will be live at `https://bodyfit-ai-hub-[id].manus.space`

---

## Option 2: Railway

1. Go to [https://railway.app](https://railway.app) and sign in
2. Click **New Project → Deploy from GitHub repo**
3. Select `kingtmc314/bodyfit-ai-hub`
4. Railway auto-detects Node.js and runs `pnpm build && pnpm start`
5. Add all environment variables in the Railway Variables panel (see list below)
6. Railway provides a public URL automatically

---

## Option 3: Render

1. Go to [https://render.com](https://render.com) and sign in
2. Click **New → Web Service**
3. Connect `kingtmc314/bodyfit-ai-hub`
4. Set:
   - **Build Command:** `pnpm install && pnpm build`
   - **Start Command:** `pnpm start`
   - **Environment:** Node
5. Add environment variables (see list below)

---

## Required Environment Variables

| Variable | Description |
|---|---|
| `DATABASE_URL` | MySQL/TiDB connection string |
| `JWT_SECRET` | Session signing secret (random 32+ char string) |
| `VITE_APP_ID` | Manus OAuth App ID |
| `OAUTH_SERVER_URL` | `https://api.manus.im` |
| `VITE_OAUTH_PORTAL_URL` | Manus OAuth portal URL |
| `OWNER_OPEN_ID` | Your Manus user OpenID |
| `OWNER_NAME` | Your display name |
| `BUILT_IN_FORGE_API_URL` | Manus built-in API base URL |
| `BUILT_IN_FORGE_API_KEY` | Manus built-in API key (server-side) |
| `VITE_FRONTEND_FORGE_API_KEY` | Manus built-in API key (frontend) |
| `VITE_FRONTEND_FORGE_API_URL` | Manus built-in API URL (frontend) |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | Full JSON of Google Service Account key |

---

## Google Sheets Setup

The app syncs with:
**https://docs.google.com/spreadsheets/d/16MzWHNx9Njww8Ml3eq5tJEspmSkHcWxmaI9I5xTqsEU**

Required sheet tabs (matching kingsrunai Body Fitness naming):
- `Body Fitness` — body composition data
- `Sleep` — sleep records
- `Heart Rate` — heart rate records

Share the spreadsheet with your Service Account email (found in the JSON key as `client_email`).

---

## Daily Health Reminders

After deployment, configure a cron job to POST to:
```
POST https://your-domain/api/scheduled/daily-reminder
```
Recommended schedule: `0 9 * * *` (9:00 AM daily)

---

## OAuth Redirect URI

After deployment, add your domain to Manus OAuth allowed redirect URIs:
```
https://your-domain/api/oauth/callback
```
