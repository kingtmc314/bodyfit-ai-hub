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

## v3.5.1 Chinese Filename Upload Fix (2026-06-01)
- [x] Fix storage.ts normalizeKey: percent-encode non-ASCII chars in all path segments so Forge presign never rejects Chinese filenames
- [x] Fix uploadAttachment in routers.ts: use safe ASCII-only storage key (nanoid + ext), keep original Chinese filename in DB for display
- [x] Update version to v3.5.1

## v3.5.2 Sleep Dialog Missing Fields Fix (2026-06-01)
- [x] Add bedtime and waketime fields to sleep add/update backend procedures (routers.ts)
- [x] Add 就寢時間 and 起床時間 time inputs to Sleep dialog UI
- [x] Populate bedtime/waketime when opening edit dialog from table row
- [x] Pass bedtime/waketime in handleSubmit payload
- [x] Update version to v3.5.2

## v3.5.3 Nutrition Chart Date Fix (2026-06-01)
- [x] Fix addMealLog: date input was ignored, loggedAt used defaultNow() (UTC time), causing chart grouping to assign HK records to wrong day
- [x] Fix: extract date from input, set loggedAt = HK noon UTC (date + T12:00:00+08:00)
- [x] Backfill: ran SQL to fix all 15 existing meal_logs records (set loggedAt to HK noon of createdAt date)
- [x] Update version to v3.5.3

## v3.5.4 Meal Log Date Field Migration (2026-06-01)
- [x] Schema: add logDate date column to meal_logs, keep loggedAt for backward compat
- [x] Migration: backfill logDate from loggedAt (HK date)
- [x] Routers: update getMealLogs, getMealLogsRange, addMealLog, updateMealLog, calorieHistory to use logDate
- [x] Frontend: add date picker to Log Meal dialog (defaults to selectedDate)
- [x] Frontend: add date picker to Edit Meal dialog (pre-filled from record date)
- [x] Update version to v3.5.4

## v3.5.5 Nutrition Date Improvements (2026-06-01)
- [x] Fix Trends Nutrition chart: use logDate instead of loggedAt for grouping (already fixed in v3.5.4 backend)
- [x] Add prev/next day navigation buttons in Nutrition page header
- [x] Fix Dashboard weekly calorie chart: use logDate instead of loggedAt for grouping
- [x] Update version to v3.5.5

## v3.6.0 User Profile & Mifflin-St Jeor TDEE (2026-06-02)
- [x] Schema: add user_profile table (userId, height, birthYear, gender, createdAt, updatedAt)
- [x] Migration: create user_profile table in DB
- [x] Router: add profile.get and profile.upsert procedures
- [x] Router: update dashboardRouter TDEE to use Mifflin-St Jeor formula (9.99×weight + 6.25×height - 4.92×age + genderOffset)
- [x] Frontend: add Personal Profile section in Goals page (height, birth year, gender)
- [x] Frontend: show BMR formula preview when all profile fields are filled
- [x] Update version to v3.6.0

## v3.6.1 Sleep Chart Y-Axis + Supplement Intake Time Fix (2026-06-02)
- [x] Reverse Y axis on sleep window chart (bedtime on top, waketime on bottom)
- [x] Add/fix intake time (進食時間) field in supplement add/edit dialog
- [x] Add dailyDose (每日劑量) field to supplement add/edit dialog
- [x] Update version to v3.6.1

## v3.6.2 Supplement Card Badge + Sleep Duration Line (2026-06-02)
- [x] Supplement inventory cards: show timeOfDay label + dailyDose badge (e.g. 「早上 · 2粒/日」)
- [x] Sleep window chart (Trends.tsx): overlay sleep duration (hours) as a secondary line using right Y axis
- [x] Update version to v3.6.2

## v3.6.3 Chart/Workout/HR Fixes (2026-06-05)
- [x] Sleep window chart: reverse Y-axis tick labels so earlier times appear at top (bedtime ~22:00 at top, waketime ~07:00 lower)
- [x] Workout log: add cardio machine exercise types (bike/cycling machine, treadmill, stair climber/elliptical, rowing machine)
- [x] Heart rate management table: add HRV column showing sleep HRV value (from sleep_logs via hrHistory map)
- [x] Fix Nutrition.tsx TS errors: fiber field in updateMealLog schema, todayHKString() calls
- [x] Update version to v3.6.3

## v3.6.4 Cardio Fields (2026-06-05)
- [x] DB schema: add avgHr (integer), calories (integer) columns to workout_sets table (duration/distance already existed)
- [x] Migration: applied SQL ALTER TABLE for new columns
- [x] tRPC: updated addSet and updateSet procedures to accept avgHr, calories, distance fields
- [x] UI: detect cardio exercises (muscleGroup==='cardio') and show duration/distance/avgHr/calories fields instead of weight/reps
- [x] History display: show cardio fields in set history rows
- [x] Update version to v3.6.4

## v3.6.5 Dashboard Cardio Calories (2026-06-05)
- [x] tRPC dashboard procedure: added CARDIO_EXERCISE_NAMES list and joined workout_sets to sum cardio calories for today
- [x] Dashboard UI: added 有氧卡路里 card (orange) to exercise summary grid (now 4 columns), shows kcal + duration in minutes
- [x] Update version to v3.6.5
- [x] Trends: add cardio history chart (weekly/monthly calories burned from cardio sets)
- [x] Blood pressure: schema, tRPC procedures, UI page with log and chart
- [x] AI health analysis: use all connected data (workout, sleep, heart rate, nutrition, supplements, blood pressure) for comprehensive analysis

## v3.7.0 Multi-Feature (2026-06-05)
- [x] Workout exercise library: add Cardio sub-tab to separate cardio machines from strength exercises
- [x] Medical records: fix attachment 404 error (use signed URLs from storage)
- [x] Supplements daily plan: add one-tap "log all" button per time slot
- [x] Workout set dialog: add lbs/kg toggle for weight input
- [x] Trends: add cardio history chart (weekly/monthly calories) to workout tab
- [x] Blood pressure: add DB table (blood_pressure_logs), tRPC CRUD router, BloodPressure.tsx page with chart
- [x] AI health analysis: expanded data context to include running, steps, supplements, blood pressure, goals, body composition, cardio sets
- [x] Update version to v3.7.0

## v3.7.1 Bug Fix (2026-06-05)
- [x] Fix workout set log: when weightUnit==='lbs', convert to kg before saving to DB (was saving raw lbs value as kg)
- [x] Update version to v3.7.1

## v3.7.2 (2026-06-05)
- [x] Fix workout set save failure (root cause: MySQL backtick SQL syntax; switched to Drizzle ORM .insert() method)
- [x] Add avgHr and calories columns to workout_sets table in Supabase
- [x] Add historyUnit state to Workout.tsx for lbs/kg toggle in workout history
- [x] Add lbs/kg toggle to workout history session list (All Sessions panel)
- [x] Add blood pressure chart to Trends health tab (Heart tab)
- [x] Update version to v3.7.2

## v3.8.0 Copy Features + Physiotherapy (2026-06-05)
- [x] Workout: add Copy Set icon button on each set row (blue copy icon, pre-fills form with same reps/weight)
- [x] Nutrition: add Copy button on each meal log row (duplicates the meal to currently selected date)
- [x] Exercise library: add Physiotherapy tab (3rd mode toggle)
- [x] Add 20 PT exercises: Straight Leg Raise, Short Arc Quad, Terminal Knee Extension, Clamshell, Hip Abduction, Ankle Pumps, Heel Slides, Quad Sets, Hamstring Curl, Calf Raises, Step-ups, Balance Board, Theraband Shoulder/Ankle, Prone Hip Extension, Wall Slides, TENS Therapy, Ultrasound Therapy, IFC Therapy, Hot/Cold Pack, Traction, Parallel Bars, Hydrotherapy
- [x] Add PT equipment to EQUIPMENT_LIST: Balance Board, TENS Machine, Ultrasound Device, IFC Machine, Hot Pack, Cold Pack, Traction Table, Parallel Bars, Hydrotherapy Pool
- [x] Workout history: allow editing completed session (name, date, start/end time HH:MM, notes) via Edit button
- [x] Edit button in All Sessions history list (opens edit dialog for any past session)
- [x] updateSession procedure expanded to accept startTime, endTime, caloriesBurned
- [x] Update version to v3.8.0

## v3.9.0 (2026-06-05)
- [x] DB schema: create physio_sessions table (id, userId, date, therapist, bodyPart, durationMin, notes, createdAt)
- [x] DB schema: create physio_exercises table (id, sessionId, name, sets, reps, durationSec, equipment, notes)
- [x] Migration: applied physio tables to Supabase via node pg
- [x] tRPC: physioRouter with getSessions, addSession, updateSession, deleteSession, addExercise, deleteExercise
- [x] Frontend: PhysioTherapy.tsx page with session list, add/edit dialog, exercise log per session, pain scale, stats summary
- [x] AppLayout.tsx: add 物理治療 nav item linking to /physio (icon-badge-teal)
- [x] App.tsx: add /physio route
- [x] i18n: added physio nav key to en.json and zh.json
- [x] Workout: allow adding exercises to completed sessions (補錄動作 button shown for completed sessions)
- [x] Nutrition: cross-day copy — dropdown with 複製到今天 / 複製到當前日期
- [x] Update version to v3.9.0

## v3.9.1 (2026-06-05)
- [x] Bug fix: updateSession now recalculates duration and caloriesBurned when startTime/endTime are changed (volume-adjusted MET formula)
- [x] Bug fix: Steps.tsx edit mode now auto-recalculates calories when steps change (same formula as new entry)

## v3.9.2 (2026-06-05)
- [x] Workout: PR badge — added getExercisePRs query (returns max weight per exercise across all sessions)
- [x] Workout: PR badge — frontend shows 🏆 PR in amber next to set weight when it matches the all-time max
- [x] Steps: calcStepsCalories updated to steps × 0.0004 × kg + floors × 0.17 × kg
- [x] Steps: auto-recalc now triggers on floorsClimbed change too
- [x] Steps: backfillCalories now recalculates ALL records (not just 0/null) using new formula
- [x] Update version to v3.9.2

## v3.9.3 (2026-06-05)
- [x] Workout: added getPRHistory server query (returns each exercise's PR weight, reps, date, session name)
- [x] Workout: added "個人最佳" (PR) tab in Workout page (4th tab with 🏆 icon)
- [x] Workout: PR tab UI — cards with exercise name, muscle group badge, PR weight (kg/lbs toggle), reps, date; search + sort by weight/name/date
- [x] Steps: stepGoal and floorGoal stored in localStorage (bf-step-goal, bf-floor-goal), default 10000/10
- [x] Steps: added 設定目標 button in header; goal dialog with validation
- [x] Steps: achievement stats banner showing 7-day and 30-day goal hit rate
- [x] Steps: goal ring and log table row highlighting use dynamic stepGoal/floorGoal
- [x] Update version to v3.9.3
