# BodyFit AI Hub — Deployment Guide

## GitHub Repository

The source code is hosted at: **https://github.com/kingtmc314/bodyfit-ai-hub**

---

## Deploying to Vercel

This app uses a Node.js Express + React (Vite) stack. Follow these steps to deploy on Vercel.

### Step 1: Import the GitHub Repository

1. Go to [https://vercel.com/new](https://vercel.com/new)
2. Click **"Import Git Repository"**
3. Select `kingtmc314/bodyfit-ai-hub`
4. Choose **Framework Preset: Other**

### Step 2: Configure Build Settings

| Setting | Value |
|---|---|
| Build Command | `pnpm build` |
| Output Directory | `dist` |
| Install Command | `pnpm install` |
| Node.js Version | 18.x or 20.x |

### Step 3: Set Environment Variables

In Vercel Dashboard → Settings → Environment Variables, add all of the following:

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
| `GOOGLE_SERVICE_ACCOUNT_JSON` | Full JSON content of Google Service Account key |

### Step 4: Deploy

Click **Deploy**. Vercel will build and deploy the app automatically.

### Step 5: Configure OAuth Redirect URI

After deployment, go to your Manus OAuth app settings and add the Vercel domain as an allowed redirect URI:
```
https://your-app.vercel.app/api/oauth/callback
```

---

## Google Sheets Setup

The app syncs with this spreadsheet:
**https://docs.google.com/spreadsheets/d/16MzWHNx9Njww8Ml3eq5tJEspmSkHcWxmaI9I5xTqsEU**

Required sheet tabs (matching kingsrunai Body Fitness naming):
- `Body Fitness` — body composition data
- `Sleep` — sleep records
- `Heart Rate` — heart rate records

Share the spreadsheet with your Service Account email (found in the JSON key as `client_email`).

---

## Daily Health Reminders

The daily reminder endpoint is at `/api/scheduled/daily-reminder`.

To activate scheduled reminders after deployment, configure a cron job (e.g., via Vercel Cron or an external scheduler) to POST to:
```
POST https://your-app.vercel.app/api/scheduled/daily-reminder
```
Recommended schedule: `0 9 * * *` (9:00 AM daily)

---

## Alternative: Manus Built-in Hosting

If you prefer to use Manus built-in hosting instead of Vercel:
1. Open the project in Manus
2. Create a checkpoint
3. Click the **Publish** button in the Management UI header

The app is already configured and ready to publish on Manus infrastructure.
