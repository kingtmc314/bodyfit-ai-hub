# BodyFit AI Hub — Project TODO

## Core Infrastructure
- [x] Project scaffold: React 19 + Tailwind 4 + Express + tRPC + Drizzle + Supabase PostgreSQL
- [x] Manus OAuth login
- [x] Account merging: all OAuth providers (Google, GitHub, Manus) for kingsleytsemc314@gmail.com → same user row (ID 2)
- [x] Duplicate user row (ID 13) deleted from database
- [x] HK timezone (UTC+8) used throughout: all dates stored as UTC, displayed in HK time
- [x] i18n: Traditional Chinese / English toggle
- [x] Dark/light theme toggle
- [x] Responsive sidebar navigation (desktop + mobile hamburger)
- [x] Version number displayed in sidebar footer

## Owner-Only Write Access (v2.7.0+)
- [x] ownerProcedure in server/_core/trpc.ts: checks ctx.user.role === 'admin'
- [x] All mutation procedures use ownerProcedure
- [x] useIsOwner() hook in client/src/contexts/OwnerContext.tsx
- [x] Read-only banner shown to non-owner visitors
- [x] Login button shown to unauthenticated visitors (sidebar + banner)
- [x] All Add/Edit/Delete/Save buttons hidden for non-owner visitors across all pages

## Nutrition Page
- [x] Log meals with calories, protein, carbs, fat
- [x] Daily macro progress rings
- [x] Weekly calorie intake bar chart (HK timezone)
- [x] getMealLogs uses HK midnight boundaries
- [x] Workout calories burned deducted from daily net balance
- [x] Net calorie balance card (intake - burned)

## Workout Page
- [x] Start/finish workout session with gym name
- [x] Add exercises from built-in library + custom exercises
- [x] Per-exercise set tracking (reps × weight)
- [x] Total volume per exercise shown in session card header
- [x] Live calories estimate shown in active session header
- [x] Calories burned shown in workout history cards (orange badge)
- [x] AI exercise analysis (analyzeExercise procedure + Sparkles button per exercise)
- [x] Session duration calculated on finish
- [x] Custom exercise creation with muscle group + equipment tags
- [x] Custom exercises show muscle/equipment badges in session
- [x] Fix: exerciseId nullable in workout_sets (allows built-in exercises without DB row)
- [x] Fix: Add Exercise dialog clears search when opened

## Running Page
- [x] Log runs with distance, pace, duration, HR, calories, cadence
- [x] Screenshot import (Garmin/Strava/NRC) via AI extraction
- [x] Shoe tracking (add/edit/retire/delete)
- [x] Race tracking (upcoming + past races)
- [x] Running stats and charts

## Steps Page
- [x] Daily step count logging
- [x] Weekly steps chart
- [x] Stair/floor tracking

## Body Composition Page
- [x] Weight, body fat %, muscle mass logging
- [x] Progress charts

## Heart Rate Page
- [x] Resting HR and max HR logging
- [x] HR history chart

## Sleep Page
- [x] Sleep duration, quality, bedtime/wake time logging
- [x] Sleep history chart

## Supplements Page
- [x] Supplement tracking (name, dose, frequency)
- [x] Purchase log

## Medical Page
- [x] Medical conditions and notes

## Progress Photos Page
- [x] Photo upload and gallery
- [x] Before/after comparison

## Goals Page
- [x] Set and track fitness goals (weight, body fat, muscle, HR, sleep, calories)
- [x] Goal progress rings on Dashboard

## Dashboard Page
- [x] Today's calorie summary
- [x] Weekly calorie chart (HK timezone)
- [x] Streak counter
- [x] Quick stats cards (weight, sleep, HR)
- [x] Goal progress section
- [x] Recent workout sessions

## Trends / Charts Page
- [x] Body composition trends (weight, body fat, muscle)
- [x] Sleep trends
- [x] HR trends
- [x] Calorie trends
- [x] Workout volume trends
- [x] All charts use HK timezone date labels (AT TIME ZONE 'Asia/Hong_Kong')

## Insights Page
- [x] AI health analysis (invokeLLM)

## Import Page
- [x] CSV import for historical data (Garmin/Apple Health)
- [x] Image/screenshot import with AI extraction

## HK Timezone Fixes
- [x] calorieHistory date grouping uses AT TIME ZONE 'Asia/Hong_Kong'
- [x] bodyHistory, sleepHistory, heartRateHistory, workoutHistory use daysAgoHK + HK timezone
- [x] Nutrition.tsx weekChartData uses toHKDateString
- [x] Dashboard.tsx weekCalories uses toHKDateString
- [x] Trends.tsx uses formatHKChartDate
- [x] getMealLogs/getMealLogsRange use HK midnight boundaries (UTC+8)

## v2.9.0 Changes (2026-05-31)
- [x] Delete duplicate user row ID 13 (same email as owner ID 2)
- [x] Add Login button for unauthenticated visitors (sidebar + read-only banner)
- [x] Comprehensive todo.md audit and cleanup
- [x] Bump version to v2.9.0
- [x] All 35 tests pass

## v3.1.0 Changes (2026-05-31)
- [x] Remove all login/auth guards - all pages publicly visible (OwnerContext always returns isOwner=true)
- [x] Add tRPC procedure `dashboard.getDailyCaloriesBurned` aggregating workout, running, steps/stairs calories
- [x] Update Dashboard hero card to show net calories (intake minus burned) with breakdown
- [x] Add today's exercise summary card on Dashboard showing workout/running/steps calories burned
- [x] Add floating FAB quick-add button on Dashboard (log food, log workout, log weight, log sleep)

## v3.3.0 Planned Features
- [x] Steps calorie backfill: server procedure to recalculate calories for steps records with 0 calories using date-specific body weight
- [x] Steps page: add "重新計算卡路里" button to trigger backfill
- [x] Running page: add pace zone distribution bar chart (5 zones)
- [x] Running page: add heart rate zone analysis chart (5 HR zones)
- [x] Dynamic TDEE calorie target: adjust daily calorie goal based on exercise burned (BMR + activity + exercise)
- [x] Dashboard net calorie card: show TDEE-adjusted target instead of fixed 2000 kcal

## v3.3.1 Bug Fix (2026-05-31)
- [x] Fix supplements update SQL error: explicitly destructure known fields instead of spreading `...rest` which could include `userId` in SET clause

## v3.3.2 Bug Fix (2026-06-01)
- [x] Fix supplements add/update: empty string "" passed to PostgreSQL date columns (purchaseDate, expiryDate) causes "Failed query" — convert empty strings to null in backend and to undefined in frontend payload

## v3.4.0 Changes (2026-06-01)
- [x] Update version to v3.4.0
- [x] Fix Medical: endDate/followUpDate empty string → null/undefined in backend and frontend
- [x] Fix Running shoes: purchaseDate/retirementDate/firstUseDate already handled correctly in frontend (|| undefined)
- [x] Steps calorie backfill: confirmed working (dev server was temporarily down, all 4 records now have calories)
- [x] Fix TypeScript errors: runningLogs.userId does not exist → removed userId filter (single-user app)
- [x] Fix Workout finishSession: add totalVolume and exerciseCount to return value

## v3.4.2 Sleep restingHr Fix (2026-06-01)
- [x] Fix sleep add/update/bulkImport: restingHr was destructured as _rhr and discarded, never stored in DB
- [x] Confirmed HRV values (59-61ms) are real Garmin data, not a display bug

## v3.4.1 TypeScript Fix (2026-06-01)
- [x] Fix api/index.ts: add explicit Request/Response types to Express route handlers to fix Vercel TypeScript warnings
- [x] Add api/**/* to tsconfig.json include so local tsc also checks api/ directory
- [x] Fix server/routers.ts updateShoe: date fields empty string → null in backend raw SQL

## v3.4.3 CSV/Image Import Field Fixes (2026-06-01)
- [x] Fix CSV import sleep: restingHr was stored as notes text instead of restingHr DB column
- [x] Fix imageImport.save sleep: restingHr field was missing from schema and DB insert
- [x] Update version to v3.4.3 in AppLayout sidebar

## v3.4.4 Supplement Stock History Fix (2026-06-01)
- [x] Fix 庫存記錄 showing 0 records: addLog now writes intake adjustment to supplement_stock_adjustments
- [x] Fix deleteLog: also writes intake_reversal adjustment to supplement_stock_adjustments
- [x] Update version to v3.4.4 in AppLayout sidebar

## v3.4.5 Supplement Log Edit Feature (2026-06-01)
- [x] Add updateLog procedure to supplements router (with stock adjustment on quantity change)
- [x] Add Edit button (pencil icon) to intake log table rows
- [x] Add Edit Log dialog with date, quantity, time of day, notes fields
- [x] Fix deleteLog to also invalidate stockHistory cache
- [x] Update version to v3.4.5 in AppLayout sidebar

## v3.5.0 Supplement Enhancements (2026-06-01)
- [x] Backend: bulkLogToday procedure — log all active supplements with today's schedule in one call
- [x] Backend: backfillStockHistory procedure — rebuild stock adjustments from existing intake logs
- [x] Frontend: 今日計劃 tab — add 一鍵全部記錄 button
- [x] Frontend: 庫存記錄 tab — color-coded type labels (進食/補貨/手動/修改/還原)
- [x] Frontend: 庫存記錄 tab — add 回填歷史庫存記錄 button
- [x] Update version to v3.5.0
