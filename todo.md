# BodyFit AI Hub — TODO

## Phase 2: Database Schema & Project Structure
- [x] Define all database tables in drizzle/schema.ts (meals, workouts, exercises, body_metrics, sleep_records, heart_rate_records, progress_photos, food_items, ai_insights)
- [x] Generate and apply migrations
- [x] Set up server/db.ts query helpers for all tables
- [x] Set up server/routers.ts with all feature routers

## Phase 3: Core Layout, Navigation & Auth
- [x] Dark/light theme with premium color palette in index.css (deep navy + electric emerald)
- [x] AppLayout with sidebar navigation (all modules)
- [x] Mobile-responsive sidebar (collapsible drawer on mobile)
- [x] Auth flow with Manus OAuth (login/logout)
- [x] Dashboard overview page with daily summary cards and charts

## Phase 4: Nutrition & Diet Module
- [x] Food database search (57 exercises, 35 food items seeded)
- [x] Manual macro entry for meals
- [x] AI food photo analysis (upload + camera capture via LLM vision)
- [x] Daily meal log with breakfast/lunch/dinner/snacks
- [x] Macro breakdown charts (calories, protein, carbs, fat)
- [x] Weekly nutrition summary
- [x] CRUD: add, edit, delete meal entries

## Phase 5: Workout & Fitness Module
- [x] Exercise library with muscle group filters (chest, back, legs, shoulders, arms, core, cardio)
- [x] Interactive 3D muscle anatomy SVG map (MuscleMap component)
- [x] Equipment categories (barbell, dumbbell, machine, cable, bodyweight)
- [x] Create and log workout sessions
- [x] Log sets, reps, weight per exercise
- [x] Personal records tracking
- [x] Workout history and progress charts
- [x] CRUD: add, edit, delete workout sessions and exercises

## Phase 6: Body Composition, Heart Rate & Sleep
- [x] Body composition log (weight, BMI, body fat %, fat mass, muscle mass, BMR, visceral fat)
- [x] Body composition trend charts
- [x] Heart rate log (resting HR, high HR, HRV)
- [x] Heart rate trend charts
- [x] Sleep log (score, resting HR, body battery, pulse ox, respiration, stress, quality)
- [x] Sleep trend charts
- [x] Google Sheets bidirectional sync (read + write) for body, heart rate, sleep
- [x] CRUD: add, edit, delete all records

## Phase 7: Progress Photos & AI Insights
- [x] Progress photo upload with S3 storage
- [x] Photo timeline gallery organized by date
- [x] AI Nutrition Insights: weekly analysis via LLM
- [x] Personalized macro recommendations on dashboard
- [x] AI Performance Review page with comprehensive analytics

## Phase 8: Daily Health Reminders
- [x] Scheduled daily reminder handler at /api/scheduled/daily-reminder
- [x] Check if user has logged meals/workouts/body metrics today
- [x] Send notification via notifyOwner if no entry recorded
- [x] Handler mounted in Express before Vite fallthrough

## Phase 9: Polish & Deployment
- [x] Responsive design (mobile + desktop)
- [x] Loading states, empty states, error handling throughout
- [x] Vitest unit tests — 16 tests passing (2 test files)
- [x] GitHub repository creation and push — https://github.com/kingtmc314/bodyfit-ai-hub
- [x] Vercel deployment configuration — vercel.json + DEPLOYMENT.md created
- [x] Checkpoint save

## Phase 10: UI Redesign — Healthy & Sunny Style
- [x] New color palette: warm sunrise gradient (amber/orange/green), vibrant accent colors
- [x] Updated typography: rounded, friendly, energetic font pairing
- [x] Redesigned sidebar with gradient and health-themed icons
- [x] Redesigned Dashboard with sunny hero section and colorful metric cards
- [x] Updated all module pages with new style tokens
- [x] Light theme as default (health/sunny feel)

## Phase 11: Chinese/English i18n
- [x] Install react-i18next and i18next
- [x] Create en.json and zh.json translation files for all 8 modules
- [x] Add language toggle button in sidebar/header
- [x] Apply translations across Dashboard, Nutrition, Workout, Body, HeartRate, Sleep, Photos, Insights

## Phase 12: Supabase Migration
- [x] Obtain Supabase PostgreSQL connection string (user login — life-OS project awvpavxgsikzmmrwspqp)
- [x] Update SUPABASE_DATABASE_URL secret to Session Pooler connection string
- [x] Update Drizzle config to use PostgreSQL dialect
- [x] Update schema.ts to use PostgreSQL types (pgTable, pgEnum)
- [x] Generate and apply migrations to Supabase (11 tables created)
- [x] Verify all queries work with PostgreSQL (16 tests passing, server connected)

## Phase 13: Deployment
- [x] Render deployment step-by-step guide (render.yaml + RENDER_DEPLOY.md)
- [x] Final checkpoint and GitHub push

## Phase 15: Render Auto-Deploy Setup
- [x] Add /api/health endpoint to Express server for Render health checks
- [x] Update RENDER_DEPLOY.md with accurate Supabase-based deployment guide (Chinese)
- [x] Push to GitHub for auto-deploy trigger

## Phase 14: Critical Bug Fixes
- [x] Fix OAuth login: Supabase users table missing "openId" column (camelCase) — added column and UNIQUE constraint
- [x] Fix open_id NOT NULL constraint — made nullable, added trigger to sync openId → open_id
- [x] Fix Drizzle schema: users table role column uses pgEnum (user_role) not varchar
- [x] Fix 46 TypeScript errors in frontend pages (Nutrition, Sleep, Workout, Dashboard, HeartRate, Insights)
  - Nutrition.tsx: use servings/loggedAt instead of quantity/date, null coalescing for nullable fields
  - Sleep.tsx: use sleepScore/sleepQuality/sleepDuration instead of score/quality/duration
  - Workout.tsx: use startTime instead of date, handle null exerciseName
  - Dashboard.tsx: use sleepScore/sleepQuality, fix meal date reference
  - HeartRate.tsx: use avgHr instead of maxHr
  - Insights.tsx: use sleepScore, add format import, use startTime for workout date
- [x] Fix server/reminderHandler.ts: use sql template literal for timestamp comparison (gte on PgTimestamp)
- [x] All 16 tests passing after fixes

## Phase 16: Vercel Auto-Deploy
- [x] Create api/index.ts — Express app wrapped as Vercel serverless entry
- [x] Create build-vercel-full.mjs — esbuild-only build script (no tsc, avoids type conflicts)
- [x] Update vercel.json — correct functions config, rewrites, build command
- [x] Install Vercel CLI and authenticate (kingtmc314)
- [x] Set all 12 environment variables on Vercel production
- [x] Deploy to Vercel — https://bodyfit-ai-hub.vercel.app ✅
- [x] Health check verified: GET /api/health → {"ok":true,"version":"1.0.0"}
- [x] Frontend verified: / returns HTML
- [x] Auto-deploy enabled: every push to main branch triggers redeploy

## Phase 17: Disable Google Sheets Import
- [x] Remove sheetsRouter from server/routers.ts (pullFromSheets, pushToSheets, syncFromSheets)
- [x] Remove trpc.sheets references from Sleep.tsx, HeartRate.tsx, BodyComposition.tsx
- [x] Remove unused syncing state and RefreshCw imports from all three pages
- [x] All data now flows exclusively through Supabase (write → Supabase → read from Supabase)

## Phase 18: CSV Bulk Import (Garmin / Apple Health)
- [x] Research Garmin and Apple Health CSV export column formats
- [x] Add server-side CSV parse + import tRPC procedures (body, sleep, heartrate, workout)
- [x] Build Import UI page with file upload, auto-detect format, column preview, progress bar
- [x] Add Import nav item to sidebar
- [x] Write vitest tests for CSV parsing logic (35/35 passing)
- [x] Deploy to Vercel (auto-deploy triggered via GitHub push)

## Phase 19: Health Data Visualization Dashboard
- [x] Add tRPC chartsRouter with bodyHistory, sleepHistory, heartRateHistory, workoutHistory, calorieHistory procedures
- [x] Build Trends.tsx page with Recharts line/area/bar charts for all 5 data categories
- [x] Add date range selector (7d / 30d / 90d / 1y)
- [x] Add nav item "Trends" (TrendingUp icon) to AppLayout sidebar
- [x] Register /trends route in App.tsx
- [x] Add trends translation key to en.json ("Trends") and zh.json ("趨勢分析")
- [x] Push to GitHub and deploy to Vercel (auto-deploy triggered via GitHub push 5bec830)

## Phase 20: Personal Health Goals
- [x] Add health_goals table to drizzle/schema.ts (userId, goalType, targetValue, unit, notes)
- [x] Generate and apply migration SQL to Supabase
- [x] Add goalsRouter with getGoals, setGoal, deleteGoal procedures
- [x] Build Goals.tsx page with form inputs for all 10 goal types (snake_case enum matching server)
- [x] Integrate goal reference lines into Trends charts (weight, body fat, muscle mass, sleep duration, sleep score, resting HR, HRV, daily calories, daily protein, workout duration)
- [x] Add Goals nav item to AppLayout sidebar (Target icon)
- [x] Add /goals route to App.tsx
- [x] Fix GoalType enum: use server snake_case values (body_fat_pct, muscle_mass, resting_hr, etc.)
- [x] Push to GitHub and deploy to Vercel

## Phase 21: Remove Login & Fix Data Display
- [x] Update userId=42 to userId=2 in all health tables via SQL script
- [x] Convert all protectedProcedure to publicProcedure with hardcoded OWNER_USER_ID=2
- [x] Remove login button and auth UI from AppLayout/Home — shows 'kingmath' as fixed user
- [x] Remove Google Sheets bulkImport procedures from server routers
- [x] Clean up Home.tsx — removed useAuth, getLoginUrl imports
- [x] Fix fitness.test.ts — updated UNAUTHORIZED test to reflect public procedure behavior
- [x] 35/35 tests passing, 0 TypeScript errors
- [x] Push to GitHub and deploy to Vercel

## Phase 22: Goal Progress Rings, Achievement Notifications & Trends Badges

- [x] Dashboard: GoalRing SVG component with animated stroke, 🎯 on hit, % progress, green ring on goal achieved
- [x] Dashboard: Fetches goals + latest body/sleep/HR data; shows rings for weight, body fat, muscle, resting HR, sleep score, calories
- [x] Trends: GoalBadge component — shows '🎯 Goal hit!' (emerald) or 'X% to goal' (amber/muted) on each chart card
- [x] Trends: Badges on Weight, Body Fat, Sleep Score, Sleep Duration, Resting HR, HRV, Workout Duration, Daily Calories
- [x] BodyComposition.tsx: checkGoalAchievement fires on add/update — toasts for weight, body fat, muscle mass
- [x] HeartRate.tsx: checkGoalAchievement fires on add/update — toasts for resting HR, HRV
- [x] Sleep.tsx: checkGoalAchievement fires on add/update — toasts for sleep score, sleep duration
- [x] 35/35 tests passing, 0 TypeScript errors
- [x] Push to GitHub and deploy to Vercel
