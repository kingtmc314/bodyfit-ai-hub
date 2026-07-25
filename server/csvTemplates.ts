/**
 * CSV Template definitions for each import data type.
 * Each template includes a header row + 1-2 example rows.
 */

export const CSV_TEMPLATES: Record<string, { filename: string; content: string }> = {
  body: {
    filename: "template_body_composition.csv",
    content: [
      "date,weight,bmi,body_fat_pct,muscle_mass,fat_mass,visceral_fat",
      "2026-01-15,75.5,24.2,18.5,58.2,14.0,8",
      "2026-01-22,74.8,24.0,18.1,58.5,13.5,7",
    ].join("\n"),
  },
  sleep: {
    filename: "template_sleep.csv",
    content: [
      "date,duration,sleep_score,quality,deep_sleep_hours,rem_sleep_hours,bedtime,wake_time",
      "2026-01-15,7.5,78,Good,1.8,1.5,23:00,06:30",
      "2026-01-16,6.8,65,Fair,1.2,1.1,23:30,06:18",
    ].join("\n"),
  },
  heartrate: {
    filename: "template_heartrate.csv",
    content: [
      "date,resting_hr,hrv,max_hr,avg_hr",
      "2026-01-15,52,45,142,68",
      "2026-01-16,54,42,138,65",
    ].join("\n"),
  },
  workout: {
    filename: "template_workout.csv",
    content: [
      "date,activity_type,duration_minutes,calories,avg_heart_rate,notes",
      "2026-01-15,Strength Training,60,320,135,Upper body day",
      "2026-01-16,Cycling,45,280,142,Indoor bike",
    ].join("\n"),
  },
  nutrition: {
    filename: "template_nutrition.csv",
    content: [
      "date,calories,protein,carbs,fat,fiber,water_ml",
      "2026-01-15,2100,165,210,65,28,2500",
      "2026-01-16,1950,155,195,60,25,2200",
    ].join("\n"),
  },
  running: {
    filename: "template_running.csv",
    content: [
      "date,run_type,distance_km,hour,minutes,second,avg_pace,best_pace,avg_heart_rate,max_heart_rate,avg_cadence,max_cadence,avg_stride_length,avg_vertical_ratio,vertical_oscillation_cm,avg_ground_contact_time_ms,calories,notes",
      "2026-01-15,Easy,10.5,0,55,30,5.29,4.45,145,168,172,185,1.08,8.2,9.1,245,520,Morning easy run",
      "2026-01-16,Interval,8.0,0,38,15,4.47,3.55,162,182,180,195,1.15,7.8,8.5,228,420,Track intervals",
    ].join("\n"),
  },
};
