import pg from 'pg';
import { config } from 'dotenv';
config();

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.SUPABASE_DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const renames = [
  // users table
  ['users', 'openId', 'open_id'],
  ['users', 'loginMethod', 'login_method'],
  ['users', 'createdAt', 'created_at'],
  ['users', 'updatedAt', 'updated_at'],
  ['users', 'lastSignedIn', 'last_signed_in'],

  // user_profile table
  ['user_profile', 'userId', 'user_id'],
  ['user_profile', 'createdAt', 'created_at'],
  ['user_profile', 'updatedAt', 'updated_at'],

  // food_items table
  ['food_items', 'nameZh', 'name_zh'],
  ['food_items', 'servingSize', 'serving_size'],
  ['food_items', 'servingUnit', 'serving_unit'],
  ['food_items', 'isCustom', 'is_custom'],
  ['food_items', 'userId', 'user_id'],
  ['food_items', 'createdAt', 'created_at'],

  // meal_logs table
  ['meal_logs', 'userId', 'user_id'],
  ['meal_logs', 'foodItemId', 'food_item_id'],
  ['meal_logs', 'foodName', 'food_name'],
  ['meal_logs', 'mealType', 'meal_type'],
  ['meal_logs', 'servingSize', 'serving_size'],
  ['meal_logs', 'logDate', 'log_date'],
  ['meal_logs', 'loggedAt', 'logged_at'],
  ['meal_logs', 'photoUrl', 'photo_url'],
  ['meal_logs', 'createdAt', 'created_at'],

  // exercises table
  ['exercises', 'nameZh', 'name_zh'],
  ['exercises', 'muscleGroup', 'muscle_group'],
  ['exercises', 'secondaryMuscles', 'secondary_muscles'],
  ['exercises', 'imageUrl', 'image_url'],
  ['exercises', 'isCustom', 'is_custom'],
  ['exercises', 'userId', 'user_id'],
  ['exercises', 'createdAt', 'created_at'],

  // workout_sessions table
  ['workout_sessions', 'userId', 'user_id'],
  ['workout_sessions', 'startTime', 'start_time'],
  ['workout_sessions', 'endTime', 'end_time'],
  ['workout_sessions', 'totalVolume', 'total_volume'],
  ['workout_sessions', 'caloriesBurned', 'calories_burned'],
  ['workout_sessions', 'createdAt', 'created_at'],
  ['workout_sessions', 'updatedAt', 'updated_at'],

  // workout_sets table
  ['workout_sets', 'sessionId', 'session_id'],
  ['workout_sets', 'exerciseId', 'exercise_id'],
  ['workout_sets', 'exerciseName', 'exercise_name'],
  ['workout_sets', 'setNumber', 'set_number'],
  ['workout_sets', 'isPersonalRecord', 'is_personal_record'],
  ['workout_sets', 'avgHr', 'avg_hr'],
  ['workout_sets', 'createdAt', 'created_at'],

  // body_composition table
  ['body_composition', 'userId', 'user_id'],
  ['body_composition', 'bodyFatPct', 'body_fat_pct'],
  ['body_composition', 'muscleMass', 'muscle_mass'],
  ['body_composition', 'fatMass', 'fat_mass'],
  ['body_composition', 'visceralFat', 'visceral_fat'],
  ['body_composition', 'createdAt', 'created_at'],
  ['body_composition', 'updatedAt', 'updated_at'],

  // heart_rate_logs table
  ['heart_rate_logs', 'userId', 'user_id'],
  ['heart_rate_logs', 'restingHr', 'resting_hr'],
  ['heart_rate_logs', 'highHr', 'high_hr'],
  ['heart_rate_logs', 'avgHr', 'avg_hr'],
  ['heart_rate_logs', 'zone1Minutes', 'zone1_minutes'],
  ['heart_rate_logs', 'zone2Minutes', 'zone2_minutes'],
  ['heart_rate_logs', 'zone3Minutes', 'zone3_minutes'],
  ['heart_rate_logs', 'zone4Minutes', 'zone4_minutes'],
  ['heart_rate_logs', 'zone5Minutes', 'zone5_minutes'],
  ['heart_rate_logs', 'createdAt', 'created_at'],
  ['heart_rate_logs', 'updatedAt', 'updated_at'],

  // sleep_logs table
  ['sleep_logs', 'userId', 'user_id'],
  ['sleep_logs', 'sleepScore', 'sleep_score'],
  ['sleep_logs', 'bodyBattery', 'body_battery'],
  ['sleep_logs', 'pulseOx', 'pulse_ox'],
  ['sleep_logs', 'sleepQuality', 'sleep_quality'],
  ['sleep_logs', 'sleepDuration', 'sleep_duration'],
  ['sleep_logs', 'deepSleep', 'deep_sleep'],
  ['sleep_logs', 'remSleep', 'rem_sleep'],
  ['sleep_logs', 'lightSleep', 'light_sleep'],
  ['sleep_logs', 'awakeDuration', 'awake_duration'],
  ['sleep_logs', 'restingHr', 'resting_hr'],
  ['sleep_logs', 'createdAt', 'created_at'],
  ['sleep_logs', 'updatedAt', 'updated_at'],

  // progress_photos table
  ['progress_photos', 'userId', 'user_id'],
  ['progress_photos', 'photoUrl', 'photo_url'],
  ['progress_photos', 'fileKey', 'file_key'],
  ['progress_photos', 'bodyFatPct', 'body_fat_pct'],
  ['progress_photos', 'createdAt', 'created_at'],

  // ai_insights table
  ['ai_insights', 'userId', 'user_id'],
  ['ai_insights', 'generatedAt', 'generated_at'],
  ['ai_insights', 'weekStart', 'week_start'],
  ['ai_insights', 'weekEnd', 'week_end'],

  // health_goals table
  ['health_goals', 'userId', 'user_id'],
  ['health_goals', 'goalType', 'goal_type'],
  ['health_goals', 'targetValue', 'target_value'],
  ['health_goals', 'isActive', 'is_active'],
  ['health_goals', 'createdAt', 'created_at'],
  ['health_goals', 'updatedAt', 'updated_at'],

  // favourite_exercises table
  ['favourite_exercises', 'userId', 'user_id'],
  ['favourite_exercises', 'createdAt', 'created_at'],

  // daily_steps table
  ['daily_steps', 'userId', 'user_id'],
  ['daily_steps', 'createdAt', 'created_at'],
  ['daily_steps', 'updatedAt', 'updated_at'],

  // medical_conditions table
  ['medical_conditions', 'userId', 'user_id'],
  ['medical_conditions', 'createdAt', 'created_at'],
  ['medical_conditions', 'updatedAt', 'updated_at'],

  // medical_visits table
  ['medical_visits', 'userId', 'user_id'],
  ['medical_visits', 'createdAt', 'created_at'],

  // medical_attachments table
  ['medical_attachments', 'userId', 'user_id'],
  ['medical_attachments', 'createdAt', 'created_at'],

  // supplements table
  ['supplements', 'userId', 'user_id'],
  ['supplements', 'createdAt', 'created_at'],
  ['supplements', 'updatedAt', 'updated_at'],

  // supplement_logs table
  ['supplement_logs', 'userId', 'user_id'],
  ['supplement_logs', 'createdAt', 'created_at'],

  // supplement_purchases table
  ['supplement_purchases', 'userId', 'user_id'],
  ['supplement_purchases', 'createdAt', 'created_at'],
  ['supplement_purchases', 'updatedAt', 'updated_at'],

  // supplement_stock_adjustments table
  ['supplement_stock_adjustments', 'userId', 'user_id'],
  ['supplement_stock_adjustments', 'createdAt', 'created_at'],

  // running_log_photos table
  ['running_log_photos', 'userId', 'user_id'],
  ['running_log_photos', 'createdAt', 'created_at'],

  // step_log_photos table
  ['step_log_photos', 'userId', 'user_id'],
  ['step_log_photos', 'createdAt', 'created_at'],

  // custom_exercises table
  ['custom_exercises', 'userId', 'user_id'],
  ['custom_exercises', 'createdAt', 'created_at'],

  // blood_pressure_logs table
  ['blood_pressure_logs', 'userId', 'user_id'],
  ['blood_pressure_logs', 'createdAt', 'created_at'],

  // physio_sessions table
  ['physio_sessions', 'userId', 'user_id'],
  ['physio_sessions', 'createdAt', 'created_at'],
  ['physio_sessions', 'updatedAt', 'updated_at'],

  // physio_exercises table
  ['physio_exercises', 'createdAt', 'created_at'],

  // fasting_logs table
  ['fasting_logs', 'userId', 'user_id'],
  ['fasting_logs', 'createdAt', 'created_at'],
  ['fasting_logs', 'updatedAt', 'updated_at'],

  // food_favorites table
  ['food_favorites', 'userId', 'user_id'],
  ['food_favorites', 'foodName', 'food_name'],
  ['food_favorites', 'servingSize', 'serving_size'],
  ['food_favorites', 'servingUnit', 'serving_unit'],
  ['food_favorites', 'createdAt', 'created_at'],

  // food_analysis_history table
  ['food_analysis_history', 'userId', 'user_id'],
  ['food_analysis_history', 'photoUrl', 'photo_url'],
  ['food_analysis_history', 'analysisResult', 'analysis_result'],
  ['food_analysis_history', 'totalCalories', 'total_calories'],
  ['food_analysis_history', 'analyzedAt', 'analyzed_at'],
];

let successCount = 0;
let skipCount = 0;
let errorCount = 0;

for (const [table, oldName, newName] of renames) {
  try {
    await pool.query(`ALTER TABLE ${table} RENAME COLUMN "${oldName}" TO ${newName}`);
    console.log(`✓ ${table}.${oldName} → ${newName}`);
    successCount++;
  } catch (err) {
    if (err.message.includes('does not exist') || err.message.includes('already exists')) {
      console.log(`⚠ SKIP ${table}.${oldName} (${err.message.split('\n')[0]})`);
      skipCount++;
    } else {
      console.error(`✗ ERROR ${table}.${oldName}: ${err.message}`);
      errorCount++;
    }
  }
}

await pool.end();
console.log(`\nDone: ${successCount} renamed, ${skipCount} skipped, ${errorCount} errors`);
