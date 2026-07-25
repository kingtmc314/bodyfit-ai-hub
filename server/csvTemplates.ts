/**
 * CSV Template definitions for each import data type.
 * Column names match the actual Supabase table columns (snake_case).
 *
 * Table references:
 *   body        → body_composition
 *   sleep       → sleep_logs
 *   heartrate   → heart_rate_logs
 *   workout     → workout_sessions + workout_sets (flattened)
 *   nutrition   → meal_logs
 *   running     → running_logs
 */

export const CSV_TEMPLATES: Record<string, { filename: string; content: string }> = {
  // ─── body_composition ────────────────────────────────────────────────────────
  // Columns: date, weight, body_fat_pct, muscle_mass, fat_mass, visceral_fat, bmi, bmr, notes
  body: {
    filename: "template_body_composition.csv",
    content: [
      "date,weight,body_fat_pct,muscle_mass,fat_mass,visceral_fat,bmi,bmr,notes",
      "2026-01-15,75.5,18.5,58.2,14.0,8,24.2,1750,",
      "2026-01-22,74.8,18.1,58.5,13.5,7,24.0,1745,",
    ].join("\n"),
  },

  // ─── sleep_logs ──────────────────────────────────────────────────────────────
  // Columns: date, sleep_duration, sleep_score, sleep_quality, deep_sleep, rem_sleep,
  //          light_sleep, awake_duration, hrv, resting_hr, body_battery, pulse_ox,
  //          respiration, bedtime, waketime, notes
  sleep: {
    filename: "template_sleep.csv",
    content: [
      "date,sleep_duration,sleep_score,sleep_quality,deep_sleep,rem_sleep,light_sleep,awake_duration,hrv,resting_hr,body_battery,pulse_ox,respiration,bedtime,waketime,notes",
      "2026-01-15,7.5,78,Good,1.8,1.5,3.8,0.4,45,52,72,97,14.2,23:00,06:30,",
      "2026-01-16,6.8,65,Fair,1.2,1.1,4.0,0.5,42,54,65,96,13.8,23:30,06:18,",
    ].join("\n"),
  },

  // ─── heart_rate_logs ─────────────────────────────────────────────────────────
  // Columns: date, resting_hr, high_hr, hrv, avg_hr,
  //          zone1, zone2, zone3, zone4, zone5,
  //          zone1_minutes, zone2_minutes, zone3_minutes, zone4_minutes, zone5_minutes, notes
  heartrate: {
    filename: "template_heartrate.csv",
    content: [
      "date,resting_hr,high_hr,hrv,avg_hr,zone1,zone2,zone3,zone4,zone5,zone1_minutes,zone2_minutes,zone3_minutes,zone4_minutes,zone5_minutes,notes",
      "2026-01-15,52,142,45,68,95,115,135,155,175,30,20,10,5,2,",
      "2026-01-16,54,138,42,65,95,115,135,155,175,25,18,8,4,1,",
    ].join("\n"),
  },

  // ─── workout_sessions (flattened with one set per row) ───────────────────────
  // workout_sessions: name, start_time, end_time, duration, calories_burned, notes
  // workout_sets: exercise_name, set_number, reps, weight, duration, distance, avg_hr, calories
  workout: {
    filename: "template_workout.csv",
    content: [
      "date,session_name,duration,calories_burned,exercise_name,set_number,reps,weight,notes",
      "2026-01-15,Push Day,3600,320,Bench Press,1,8,80,",
      "2026-01-15,Push Day,3600,320,Bench Press,2,8,80,",
      "2026-01-15,Push Day,3600,320,Overhead Press,1,10,50,",
      "2026-01-16,Cardio,2700,280,Treadmill,1,,,,",
    ].join("\n"),
  },

  // ─── meal_logs ───────────────────────────────────────────────────────────────
  // Columns: log_date, meal_type, food_name, servings, serving_size, calories,
  //          protein, carbs, fat, fiber, notes
  // meal_type: breakfast | lunch | dinner | snack
  nutrition: {
    filename: "template_nutrition.csv",
    content: [
      "log_date,meal_type,food_name,servings,serving_size,calories,protein,carbs,fat,fiber,notes",
      "2026-01-15,breakfast,Oatmeal,1,80,300,10,55,5,6,",
      "2026-01-15,lunch,Chicken Rice,1,350,520,38,60,10,2,",
      "2026-01-15,dinner,Salmon,1,200,350,40,0,18,0,",
      "2026-01-16,breakfast,Eggs,2,60,180,14,1,12,0,",
    ].join("\n"),
  },

  // ─── running_logs ────────────────────────────────────────────────────────────
  // Columns match running_logs table exactly
  running: {
    filename: "template_running.csv",
    content: [
      "date,running_type,running_shoes,distance_km,hour,minutes,second,average_pace,best_pace,average_heart_rate,maximum_heart_rate,average_cadence,max_cadence,avg_stride_length_m,avg_vertical_ratio,vertical_oscillation_cm,avg_ground_contact_time_ms,calories,temperature,humidity,notes",
      "2026-01-15,Easy,,10.5,0,55,30,5:29,4:45,145,168,172,185,1.08,8.2,9.1,245,520,18,65,Morning easy run",
      "2026-01-16,Interval,,8.0,0,38,15,4:47,3:55,162,182,180,195,1.15,7.8,8.5,228,420,17,60,Track intervals",
    ].join("\n"),
  },
};
