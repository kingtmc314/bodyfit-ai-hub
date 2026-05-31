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
