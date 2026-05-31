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

## Phase 23: Sleep Stage Data Fix
- [x] Diagnosed: deepSleep/remSleep/lightSleep are null in DB — Google Sheets import never mapped those columns
- [x] Fixed sleepDuration normalization in server sleepHistory procedure (minutes → hours when > 24)
- [x] Fixed Sleep.tsx chartData, stat card, log table to normalize duration display
- [x] Added stress field to sleepHistory chart procedure and Trends.tsx SleepCharts data mapping
- [x] 35/35 tests passing, 0 TypeScript errors

## Phase 24: Image Import & Enhanced CSV Import
- [x] Added Nutrition CSV import type to csvImport.ts (ParsedNutritionRow, parseNutritionRow, detectDataType update)
- [x] Added nutrition to importData and preview procedures in routers.ts
- [x] Added imageImport router to routers.ts (extract + save procedures using LLM vision)
- [x] Rewrote Import.tsx with two tabs: CSV Import and Image Import (AI)
- [x] Image Import: drag-drop upload, base64 to LLM vision, structured JSON extraction, preview grid, date/type selector, save to Supabase
- [x] CSV Import: added Nutrition tab to format guide, added nutrition to dataType selector
- [x] Fixed preview dataType enum to include nutrition
- [x] 35/35 tests passing, 0 TypeScript errors
- [x] Push to GitHub and deploy to Vercel

## Phase 25: Inline Import (Photo + CSV) on Body, HeartRate, Sleep Pages
- [x] Create shared QuickImportModal component (photo tab + CSV tab, specific to data type)
- [x] BodyComposition.tsx: add "匯入" button in header → opens QuickImportModal for body data
- [x] HeartRate.tsx: add "匯入" button in header → opens QuickImportModal for heartrate data
- [x] Sleep.tsx: add "匯入" button in header → opens QuickImportModal for sleep data
- [x] Photo tab: drag-drop image upload → AI vision extracts data → preview → save
- [x] CSV tab: paste or upload CSV → auto-detect/force type → preview rows → import
- [x] Run tests, save checkpoint, push to GitHub

## Phase 25b: Fix AI Analysis
- [x] Diagnose why AI analysis (Insights page / food photo analysis) fails
- [x] Check invokeLLM helper and BUILT_IN_FORGE_API_KEY env var
- [x] Fix the LLM call — check image URL format, response parsing, error handling
- [x] Test AI analysis end-to-end

## Phase 25: QuickImportModal + Inline Import Buttons
- [x] Fixed QuickImportModal TS errors (base64 not imageBase64, save uses structured fields not extractedData)
- [x] Added 匯入 button to BodyComposition.tsx header (opens QuickImportModal with dataType="body")
- [x] Added 匯入 button to HeartRate.tsx header (opens QuickImportModal with dataType="heartrate")
- [x] Added 匯入 button to Sleep.tsx header (opens QuickImportModal with dataType="sleep")
- [x] Fixed AI analysis DB errors (added missing columns via migrate-v2.mjs script)
- [x] 35/35 tests passing, 0 TypeScript errors

## Phase 26: Exercise Library - Images & Muscle Diagrams
- [x] Created ExerciseDetailModal component with wger SVG muscle diagrams (front/back body outline + highlighted overlays)
- [x] Primary muscles shown in red, secondary in orange using wger static SVG overlays
- [x] Equipment emoji icons, muscle group badge, instructions text, 加入訓練 button
- [x] Made exercise cards clickable to open detail modal
- [x] + button still works (stops propagation) to add to active session

## Phase 27: Hong Kong Timezone Fix
- [x] Create shared HK timezone utility (formatHKDate, formatHKDateTime, toHKDateString)
- [x] Fix all date displays in Dashboard, BodyComposition, HeartRate, Sleep, Workout, Nutrition, Trends pages
- [x] Fix chart X-axis date labels to use HK timezone (formatHKChartDate in all chart data)
- [x] Fix server-side date comparisons to use HK timezone for today queries
- [x] Fix date input defaults to use HK current date (todayHKString)
- [x] Fix Insights.tsx date display (weeklyVolume chart, insight history timestamps)
- [x] Fix ProgressPhotos.tsx default date to use todayHKString
- [x] Fix QuickImportModal photo tab: render extracted fields from imageImport.extract response correctly
- [x] Fix QuickImportModal Save button: enabled when any extracted field has non-null value
- [x] Run tests, save checkpoint, push to GitHub

## Phase 28: Date Verification, Server HK Today Fix, Version Number
- [x] Verify date display on Vercel: HeartRate page confirmed showing correct dates (23/05/2026 etc)
- [x] Server-side today queries already use HK timezone (todayHK() + T00:00:00+08:00 from Phase 27)
- [x] Add version number v1.0.1 to sidebar footer (hidden when sidebar collapsed)
- [x] Set GitHub repo to public so Vercel auto-deploy works for all future pushes
- [x] Run tests, save checkpoint, push to GitHub

## Phase 29: Mobile Nav Sticky Fix & Workout Records Display
- [x] Fix mobile top nav bar to be sticky: added overflow-y-auto h-svh to SidebarInset so sticky top-0 works correctly
- [x] Investigated workout records: only 1 session in DB (Leg Day today), Dashboard correctly shows it; screenshot was from a different app (lifemanage)
- [x] Run tests, save checkpoint, push to GitHub

## Phase 30: Running Analysis Tab
- [x] Add running_logs table to drizzle schema and database
- [x] Add server procedures: running.getLogs, running.getStats, running.getAIAnalysis
- [x] Fix workout getSessions: 90-day window, no endDate cutoff, HK timezone boundaries
- [x] Run tests, save checkpoint, push to GitHub

## Phase 30b: Running Data in AI Health Analysis (Insights)
- [x] Add running.getLogs and running.getStats procedures using actual running_logs table schema
- [x] Add Running tab to Insights page with: monthly distance chart, recent runs pace/HR chart, training type breakdown, AI analysis button
- [x] AI analysis: sends all running data to LLM for comprehensive analysis (pace, HR, cadence, training type)
- [x] Run tests (35/35 pass), save checkpoint, push to GitHub

## Phase 31: Fix Date Storage Root Cause
- [x] Change all date columns from PostgreSQL date type to text in drizzle/schema.ts
- [x] Execute SQL migration: ALTER TABLE ... ALTER COLUMN date TYPE text USING TO_CHAR(date, 'YYYY-MM-DD')
- [x] Verify existing data is preserved correctly after migration (heart_rate_logs shows '2026-05-23' etc.)
- [x] Run tests (35/35 pass), save checkpoint, push to GitHub

## Phase 32: Running Log Page (Manual Entry)
- [x] Add running.addLog, running.updateLog, running.deleteLog tRPC procedures to routers.ts
- [x] Create Running.tsx page with: stat cards (total distance, avg pace, avg HR, total runs), trend chart, log table with CRUD
- [x] Add 記錄跑步 button to open add/edit dialog (date, distance, duration, pace, HR, cadence, notes)
- [x] Add 跑步記錄 nav item to AppLayout sidebar (with Footprints icon)
- [x] Register /running route in App.tsx
- [x] Fix getStats monthly query to work with text date type
- [x] 35/35 tests pass

## Phase 33: Fix AI Food Photo Analysis
- [x] Update analyzeFoodPhoto in routers.ts to use structured image_url content block instead of [IMAGE:url] placeholder
- [x] TypeScript check: 0 errors
- [x] 35/35 tests pass

## Phase 34: Running Shoe Selector + AI Coach on Running Page
- [x] Add running.getActiveShoes tRPC query (SELECT from running_shoes WHERE status != 'Retired')
- [x] Replace free-text shoe input in Running.tsx dialog with Select dropdown from Shoe Locker (17 active shoes)
- [x] Add AI Coach tab to Running.tsx with weeks selector and getAIAnalysis mutation
- [x] Display AI analysis result with Streamdown markdown renderer
- [x] Add maxCadence, avgStrideLengthM, avgVerticalRatio, verticalOscillationCm fields to dialog form

## Phase 35: Running CSV Import on Import Page
- [x] Add ParsedRunningRow interface and parseRunningRow() function to csvImport.ts
- [x] Update detectDataType() to recognize running CSV (Garmin activity export)
- [x] Update ImportDataType to include "running"
- [x] Add running import handler in csvImport router (importData procedure)
- [x] Add running type card to DATA_TYPE_INFO in Import.tsx
- [x] Add running to TYPE_LABELS in Import.tsx
- [x] Add running SelectItem to manual data type selector in Import.tsx

## Phase 36: Fix HRV Chart Data Source
- [x] Confirmed HRV data is in sleep_logs.hrv (not heart_rate_logs.hrv)
- [x] Trends.tsx already maps r.hrv from sleepHistory query
- [x] Added hrv column to sleep_logs table (already existed in DB from other webapp)
- [x] Updated sleep CSV import to map HRV column

## Phase 37: DB Schema Audit & Fix
- [x] Confirmed sleep_logs already has hrv, lightSleep, awakeDuration columns (from other webapp)
- [x] Confirmed running_logs has all expected columns including windSpeed, apparentTemp, status, shoesId
- [x] drizzle/schema.ts already has all columns (lightSleep, awakeDuration, hrv in sleepLogs; all running fields)
- [x] Updated sleep CSV import (parseSleepRow) to map hrv, lightSleep, awakeDuration
- [x] Updated sleep bulkImport CSV handler to include hrv, lightSleep, awakeDuration
- [x] Running.tsx dialog form now includes maxCadence, avgStrideLengthM, avgVerticalRatio, verticalOscillationCm
- [x] 35/35 tests passing, 0 TypeScript errors

## Phase 38: Sleep Page Full Update
- [x] Rewrite Sleep.tsx with all DB fields (hrv, restingHr, pulseOx, respiration, bodyBattery, bedtime, waketime)
- [x] Remove Sleep Stages chart (no data in DB: deepSleep/remSleep all null)
- [x] Add Bedtime & Waketime comparison chart with midnight reference line (ComposedChart)
- [x] Add Sleep Score & Duration dual-axis comparison chart
- [x] Add Body Battery & HRV chart
- [x] Add Blood Ox & Respiration chart
- [x] Update log table to show all 11 columns (date, score, quality, duration, HRV, resting HR, blood ox, respiration, body battery, bedtime, waketime)
- [x] Update dialog form: removed deepSleep/remSleep/stress, added HRV field
- [x] 6 stat cards: score, duration, HRV, resting HR, body battery, pulse ox
- [x] heartRateHistory procedure: HRV from sleep_logs.hrv (merged with HR data by date)
- [x] 35/35 tests pass, 0 TypeScript errors

## Phase 39: Comprehensive Bug Fix
- [x] Remove stress field from drizzle/schema.ts (sleepLogs)
- [x] Remove stress from server/routers.ts (sleep add, update, bulkImport, CSV import, image import AI schema - 7 locations)
- [x] Fix bulkImport syntax error (missing closing parenthesis for z.array())
- [x] Remove stress from server/csvImport.ts (ParsedSleepRow interface + parseSleepRow function)
- [x] Remove stress from server/sheetsService.ts (SLEEP_COLUMNS, readSheetData, writeRowToSheet) - replace with HRV
- [x] Remove stress from client/src/pages/Trends.tsx (sleep chartData mapping)
- [x] Remove stress from client/src/components/QuickImportModal.tsx (FIELD_LABELS)
- [x] Remove stress from client/src/pages/Import.tsx (ExtractedData type)
- [x] HeartRate.tsx: removed Max HR column from table and dialog form
- [x] Confirmed sleep_logs columns are camelCase (sleepScore, sleepDuration, hrv, restingHr etc.)
- [x] Confirmed sleep.getAll correctly normalizes sleepDuration (minutes to hours when > 24)
- [x] HRV chart uses sleep_logs.hrv via heartRateHistory JOIN
- [x] 35/35 tests pass, 0 TypeScript errors

## Phase 40: i18n Expansion & Trends Charts Enhancement
- [x] Add bedtime/waketime columns to sleep_logs via migration script (confirmed already exist)
- [x] Add bedtime/waketime to sleepHistory chartsRouter query
- [x] Replace Sleep Stages Breakdown chart in Trends.tsx with 4 meaningful charts:
  - HRV Trend (line chart from sleep_logs.hrv)
  - Bedtime & Waketime (ComposedChart with midnight reference line)
  - Blood Ox & Respiration Rate (dual-line chart)
  - Body Battery (area chart)
- [x] Apply useTranslation i18n to Running.tsx (all UI strings)
- [x] Apply useTranslation i18n to Login.tsx (all UI strings)
- [x] Apply useTranslation i18n to Import.tsx (CsvImportTab + ImageImportTab + wrapper)
- [x] Update en.json with csv_import, image_import, ai_extract, ai_extract_desc, select_file, or, drop_here keys
- [x] Update zh.json with matching Chinese translations for all new import keys
- [x] 35/35 tests passing, 0 TypeScript errors
- [x] Save checkpoint and push to GitHub

## Phase 41: Exercise Detail Modal Enhancement
- [x] Generate comprehensive bilingual descriptions for 59 exercises (steps, tips, common mistakes, difficulty)
- [x] Create client/src/data/exerciseDescriptions.ts with full data for all exercises
- [x] Update ExerciseDetailModal: step-by-step instructions, pro tips, common mistakes sections
- [x] Add difficulty badge (Beginner/Intermediate/Advanced) to exercise modal header
- [x] Add ScrollArea for scrollable modal content (max-h-[90vh])
- [x] Implement fuzzy name matching for exercise lookup (case-insensitive, partial, word-based)
- [x] Dark mode support for all new sections (yellow/red tinted backgrounds)
- [x] 35/35 tests passing, 0 TypeScript errors

## Phase 42: Exercise Favourites Feature
- [x] Add favourite_exercises table to schema.ts (userId, exerciseName, createdAt)
- [x] Execute migration SQL to create the table
- [x] Add tRPC procedures: toggleFavourite, getFavourites
- [x] Add star button to exercise cards in Workout.tsx (toggle on/off, optimistic update)
- [x] Add "我的常用動作" section at top of exercise library (shows when user has favourites)
- [x] Write vitest tests for favourite procedures

## Phase 42: Exercise Demo Images & Equipment Icons
- [x] Build exercise image mapping (free-exercise-db GitHub raw URLs) for all 59 exercises
- [x] Add image carousel (before/after position) to ExerciseDetailModal
- [x] Add equipment icon illustrations (barbell, dumbbell, cable, machine, bodyweight, etc.)
- [x] Lazy-load images with skeleton placeholder

## Phase 43: Running Race Events & PB Cards
- [x] Add race_events table to schema.ts (name, date, distance, location, targetTime, notes, result, actualTime)
- [x] Execute migration SQL for race_events table
- [x] Add running.getRaceEvents, addRaceEvent, updateRaceEvent, deleteRaceEvent tRPC procedures
- [x] Add running.getPBs procedure (best time per distance from running_logs)
- [x] Add running.getRaceAIAnalysis procedure (LLM analysis of training vs race goals)
- [x] Add "賽事" tab to Running.tsx with:
  - Race schedule table with countdown timer (days to race)
  - Add/Edit/Delete race event dialog
  - PB Cards section (5K, 10K, HM, FM best times)
  - AI Race Analysis button (training readiness, predicted finish time, recommendations)

## Phase 44: Exercise Favourites
- [x] Add favourite_exercises table to schema.ts
- [x] Execute migration SQL
- [x] Add workout.toggleFavourite, getFavourites tRPC procedures
- [x] Star button on exercise cards (optimistic toggle)
- [x] "我的常用動作" section at top of exercise library

## Phase 45: Sleep Chart - Bedtime/Waketime Range Bar (陰陽鐲 style)
- [x] Replace bedtime/waketime line chart with horizontal sleep window range bar chart
- [x] Each day shows a bar from bedtime to waketime (handles midnight crossover)
- [x] Color gradient: deep blue for sleep, orange for wake transition
- [x] Show average bedtime/waketime reference lines

## Phase 46: Running - Shoe Locker Tab
- [x] Add "跑鞋" tab to Running.tsx
- [x] Show all shoes with photo, name, brand, status badge (In Use / Not Yet Opened / Retired)
- [x] Show mileage per shoe (calculated from running_logs where running_shoes matches)
- [x] Add/Edit/Delete shoe dialog (shoes_name, brand, model, status, purchase_date, price, photo_url, notes)
- [x] Mileage progress bar (warn at 500km, retire at 800km)
- [x] Filter by status tabs (All / In Use / Not Yet Opened / Retired)

## Phase 47: Running - Race Events Tab (uses existing races table)
- [x] Add "賽事" tab to Running.tsx
- [x] Race schedule table: race_name, date, distance_km, location, countdown (days), registration, bib_no
- [x] Countdown timer component (days until race, color-coded: red <30d, yellow <90d, green >90d)
- [x] Add/Edit/Delete race dialog (uses existing races table columns)
- [x] PB Cards section: best finish_time per distance category (5K, 10K, HM, FM) from races table
- [x] AI Race Analysis: LLM analysis of upcoming races vs recent training, predicted finish time

## Phase 48: Exercise Demo Images
- [x] Build exercise image mapping using free-exercise-db GitHub raw URLs
- [x] Add image display (before/after position photos) to ExerciseDetailModal
- [x] Lazy-load with skeleton placeholder
- [x] Equipment type icon badge (barbell, dumbbell, cable, machine, bodyweight)

## Phase 49: Exercise Favourites
- [x] Add favourite_exercises table to schema + migration
- [x] Add workout.toggleFavourite, getFavourites tRPC procedures
- [x] Star button on exercise cards (optimistic toggle, auth-gated)
- [x] "我的常用動作" collapsible section at top of exercise library

## Phase 45: Shoe Locker, Race Events, Exercise Favourites, Demo Images & Import Enhancement
- [x] Add running_shoes table (shoes CRUD: addShoe, updateShoe, deleteShoe, getShoes, getActiveShoes)
- [x] Add race_events table (races CRUD: addRace, updateRace, deleteRace, getRaces, getPBs, analyzeRace)
- [x] Add favourite_exercises table (toggleFavourite, getFavourites procedures)
- [x] Running.tsx: add Shoe Locker tab with mileage progress bar, status badges, PB cards
- [x] Running.tsx: add Race Events tab with countdown timer, AI analysis per race, add/edit/delete dialogs
- [x] Workout.tsx: add star button to exercise cards (toggle favourite), "我的最愛" section at top
- [x] ExerciseDetailModal: add demo images (Wikimedia Commons) for key exercises (Bench Press, Deadlift, etc.)
- [x] Import.tsx: add camera capture button, image remove button (×), Chinese UI text, larger preview
- [x] Version bump to v1.2.0

## Phase 46: Shoe Locker Redesign & Race Tab Overhaul
- [x] Shoe status logic: retirement_date → Retired; firstusedate → Active; purchase_date only → Not Yet Opened (bilingual)
- [x] Running log shoe selector: show 使用中/未開封 badge next to shoe name
- [x] Shoe Locker card redesign: large photo, status badge overlay, mileage bar (custom max_km), sessions/price/$/km stats, run history modal, dates row
- [x] Running page header: 4 stat cards (total shoes, finished races, total activities, latest resting HR) + Next Race countdown + HR Zones
- [x] Race tab: PB cards moved here (removed from shoe tab), completed race rich cards with all fields, upcoming countdown list
- [x] AI coach enhanced: race history, time predictions for upcoming races, pace/shoe/weather strategy
- [x] Fix shoe mileage: use both shoes_id FK and running_shoes text matching for total_km
- [x] addLog/updateLog: auto-populate shoes_id by looking up shoes_name in running_shoes table
- [x] addShoe/updateShoe: add maxKm field (custom replacement distance, default 800 km)
- [x] Add max_km column to running_shoes table
- [x] Add getShoeRunHistory procedure (view all runs for a specific shoe)
- [x] Add getRacesEnriched procedure (lookup running performance by date+distance from running_logs)
- [x] Fix AI food photo analysis: convert /manus-storage/ relative path to S3 signed URL before LLM call
- [x] Version bump to v1.3.0

## Phase 47: Completed Race Cards with All Running Log Fields + Sorting
- [x] Add sorting to Shoe Locker: By Status / By Mileage / By Name / By Purchase Date
- [x] Add sorting to Race Events: By Date / By Distance / By Name
- [x] Redesign upcoming race cards as compact grid (3 per row on desktop)
- [x] Completed race cards: show ALL running_logs fields from getRacesEnriched (avg pace, best pace, avg HR, max HR, avg cadence, max cadence, calories, running shoes, biomechanics section, weather section)
- [x] Remove per-race AI Analysis button (AI analysis now consolidated in AI Coach tab)
- [x] AI Coach tab description updated to mention race analysis, biomechanics, shoe recommendations
- [x] Add i18n keys: sort_by_status/mileage/name/purchase/date/distance, best_pace, biomechanics, stride_length, vertical_ratio, vertical_oscillation, ground_contact, weather_conditions, feels_like, ai_coach_desc, no_runs_for_shoe, run_history, close
- [x] Version bump to v1.4.0
- [x] 35/35 tests passing, 0 TypeScript errors

## Phase 48: Finish Time hr/min/sec + Personalized Training Plan

- [x] Add finish_hr, finish_min, finish_sec, target_hr, target_min, target_sec columns to races table (migration applied)
- [x] Update addRace/updateRace procedures to include new hr/min/sec fields
- [x] Update getPBs procedure to use finish_hr/min/sec for display
- [x] Update getRacesEnriched to return finish_hr/min/sec and target_hr/min/sec
- [x] Update race dialog form: replace single finishTime/targetTime text fields with 3 separate hr/min/sec inputs
- [x] Update completed race cards to display finish time as formatted hr:min:sec from separate fields
- [x] Update PB cards to display finish time from hr/min/sec fields
- [x] Update openEditRace to populate finishHr/finishMin/finishSec/targetHr/targetMin/targetSec
- [x] Add generateTrainingPlan tRPC procedure: aggregates all health data (running, body, sleep, HR, workout) + races + goals, generates personalized weekly training plan via LLM
- [x] Add Training Plan section to AI Coach tab with goal race selector, plan duration (weeks), generate button
- [x] Display training plan as structured weekly schedule (Mon-Sun with workout type, distance, intensity)
- [x] Update i18n en.json and zh.json with new training plan keys

## Phase 49: Large Update v1.6.0

- [x] Fix finish time display in PB cards (hr/min/sec not showing)
- [x] Fix finish time display in completed race cards header
- [x] Add sort/filter to Running Log tab
- [x] Add sort/filter to Workout page
- [x] Add sort/filter to Nutrition page
- [x] Add sort/filter to Body Composition page
- [x] Add sort/filter to Heart Rate page
- [x] Add sort/filter to Sleep page
- [x] Create Steps & Stairs page (daily steps + floors climbed)
- [x] Create Medical Records page with file upload
- [x] Create Supplements page with inventory tracking
- [x] Reorganize sidebar navigation (group tabs)
- [x] Add exercise machine/movement illustrations to Workout page
- [x] Full zh/en i18n for all new pages
- [x] Bump version to v1.6.0

## Phase 50: Data Export (CSV/PDF)

- [x] Add tRPC exportRouter with exportRunningLogs, exportBodyComposition, exportSupplementLogs procedures
- [x] Server-side CSV generation for running logs (all fields: date, distance, duration, pace, HR, cadence, shoes, notes)
- [x] Server-side CSV generation for body composition (date, weight, BMI, body fat %, fat mass, muscle mass, BMR, visceral fat)
- [x] Server-side CSV generation for supplement logs (date, supplement name, dose, unit, notes)
- [x] Server-side PDF generation for all three data types using html-to-pdf approach
- [x] Add Export button (CSV + PDF options) to Running Log tab in Running.tsx
- [x] Add Export button (CSV + PDF options) to BodyComposition.tsx
- [x] Add Export button (CSV + PDF options) to Supplements.tsx
- [x] Full zh/en i18n for export UI

## Phase 51: Supplement Reminder Notifications

- [x] Add reminder_enabled, reminder_time (HH:MM) fields to supplements table via migration
- [x] Add tRPC procedures: updateSupplementReminder (toggle + set time)
- [x] Add reminder toggle + time picker UI to Supplements.tsx per supplement
- [x] Add /api/scheduled/supplement-reminder Express handler (checks due supplements, sends notifyOwner)
- [x] Mount handler in server/_core/index.ts before Vite fallthrough
- [x] Create daily heartbeat cron job via manus-heartbeat CLI (runs at 08:00 HKT = 00:00 UTC)
- [x] Full zh/en i18n for reminder UI

## Phase 52: Weekly AI Health Summary

- [x] Add /api/scheduled/weekly-health-summary Express handler
- [x] Handler aggregates past 7 days: running stats, body metrics, sleep averages, nutrition totals, workout sessions
- [x] Handler calls invokeLLM to generate comprehensive bilingual health summary
- [x] Handler sends summary via notifyOwner with formatted title + content
- [x] Mount handler in server/_core/index.ts
- [x] Create weekly heartbeat cron job via manus-heartbeat CLI (runs Monday 09:00 HKT = Monday 01:00 UTC)
- [x] Bump version to v1.9.0
