-- Migration: Rename all camelCase column names to snake_case
-- This fixes Drizzle ORM generating quoted identifiers ("userId") that Supabase rejects
-- Run this once to migrate the database schema

-- users table
ALTER TABLE users RENAME COLUMN "openId" TO open_id;
ALTER TABLE users RENAME COLUMN "loginMethod" TO login_method;
ALTER TABLE users RENAME COLUMN "createdAt" TO created_at;
ALTER TABLE users RENAME COLUMN "updatedAt" TO updated_at;
ALTER TABLE users RENAME COLUMN "lastSignedIn" TO last_signed_in;

-- user_profile table
ALTER TABLE user_profile RENAME COLUMN "userId" TO user_id;
ALTER TABLE user_profile RENAME COLUMN "createdAt" TO created_at;
ALTER TABLE user_profile RENAME COLUMN "updatedAt" TO updated_at;

-- food_items table
ALTER TABLE food_items RENAME COLUMN "nameZh" TO name_zh;
ALTER TABLE food_items RENAME COLUMN "servingSize" TO serving_size;
ALTER TABLE food_items RENAME COLUMN "servingUnit" TO serving_unit;
ALTER TABLE food_items RENAME COLUMN "isCustom" TO is_custom;
ALTER TABLE food_items RENAME COLUMN "userId" TO user_id;
ALTER TABLE food_items RENAME COLUMN "createdAt" TO created_at;

-- meal_logs table
ALTER TABLE meal_logs RENAME COLUMN "userId" TO user_id;
ALTER TABLE meal_logs RENAME COLUMN "foodItemId" TO food_item_id;
ALTER TABLE meal_logs RENAME COLUMN "foodName" TO food_name;
ALTER TABLE meal_logs RENAME COLUMN "mealType" TO meal_type;
ALTER TABLE meal_logs RENAME COLUMN "servingSize" TO serving_size;
ALTER TABLE meal_logs RENAME COLUMN "logDate" TO log_date;
ALTER TABLE meal_logs RENAME COLUMN "loggedAt" TO logged_at;
ALTER TABLE meal_logs RENAME COLUMN "photoUrl" TO photo_url;
ALTER TABLE meal_logs RENAME COLUMN "createdAt" TO created_at;

-- exercises table
ALTER TABLE exercises RENAME COLUMN "nameZh" TO name_zh;
ALTER TABLE exercises RENAME COLUMN "muscleGroup" TO muscle_group;
ALTER TABLE exercises RENAME COLUMN "secondaryMuscles" TO secondary_muscles;
ALTER TABLE exercises RENAME COLUMN "imageUrl" TO image_url;
ALTER TABLE exercises RENAME COLUMN "isCustom" TO is_custom;
ALTER TABLE exercises RENAME COLUMN "userId" TO user_id;
ALTER TABLE exercises RENAME COLUMN "createdAt" TO created_at;

-- workout_sessions table
ALTER TABLE workout_sessions RENAME COLUMN "userId" TO user_id;
ALTER TABLE workout_sessions RENAME COLUMN "startTime" TO start_time;
ALTER TABLE workout_sessions RENAME COLUMN "endTime" TO end_time;
ALTER TABLE workout_sessions RENAME COLUMN "totalVolume" TO total_volume;
ALTER TABLE workout_sessions RENAME COLUMN "caloriesBurned" TO calories_burned;
ALTER TABLE workout_sessions RENAME COLUMN "createdAt" TO created_at;
ALTER TABLE workout_sessions RENAME COLUMN "updatedAt" TO updated_at;

-- workout_sets table
ALTER TABLE workout_sets RENAME COLUMN "sessionId" TO session_id;
ALTER TABLE workout_sets RENAME COLUMN "exerciseId" TO exercise_id;
ALTER TABLE workout_sets RENAME COLUMN "exerciseName" TO exercise_name;
ALTER TABLE workout_sets RENAME COLUMN "setNumber" TO set_number;
ALTER TABLE workout_sets RENAME COLUMN "isPersonalRecord" TO is_personal_record;
ALTER TABLE workout_sets RENAME COLUMN "avgHr" TO avg_hr;
ALTER TABLE workout_sets RENAME COLUMN "createdAt" TO created_at;

-- body_composition table
ALTER TABLE body_composition RENAME COLUMN "userId" TO user_id;
ALTER TABLE body_composition RENAME COLUMN "bodyFatPct" TO body_fat_pct;
ALTER TABLE body_composition RENAME COLUMN "muscleMass" TO muscle_mass;
ALTER TABLE body_composition RENAME COLUMN "fatMass" TO fat_mass;
ALTER TABLE body_composition RENAME COLUMN "visceralFat" TO visceral_fat;
ALTER TABLE body_composition RENAME COLUMN "createdAt" TO created_at;
ALTER TABLE body_composition RENAME COLUMN "updatedAt" TO updated_at;

-- heart_rate_logs table
ALTER TABLE heart_rate_logs RENAME COLUMN "userId" TO user_id;
ALTER TABLE heart_rate_logs RENAME COLUMN "restingHr" TO resting_hr;
ALTER TABLE heart_rate_logs RENAME COLUMN "highHr" TO high_hr;
ALTER TABLE heart_rate_logs RENAME COLUMN "avgHr" TO avg_hr;
ALTER TABLE heart_rate_logs RENAME COLUMN "zone1Minutes" TO zone1_minutes;
ALTER TABLE heart_rate_logs RENAME COLUMN "zone2Minutes" TO zone2_minutes;
ALTER TABLE heart_rate_logs RENAME COLUMN "zone3Minutes" TO zone3_minutes;
ALTER TABLE heart_rate_logs RENAME COLUMN "zone4Minutes" TO zone4_minutes;
ALTER TABLE heart_rate_logs RENAME COLUMN "zone5Minutes" TO zone5_minutes;
ALTER TABLE heart_rate_logs RENAME COLUMN "createdAt" TO created_at;
ALTER TABLE heart_rate_logs RENAME COLUMN "updatedAt" TO updated_at;

-- sleep_logs table
ALTER TABLE sleep_logs RENAME COLUMN "userId" TO user_id;
ALTER TABLE sleep_logs RENAME COLUMN "sleepScore" TO sleep_score;
ALTER TABLE sleep_logs RENAME COLUMN "bodyBattery" TO body_battery;
ALTER TABLE sleep_logs RENAME COLUMN "pulseOx" TO pulse_ox;
ALTER TABLE sleep_logs RENAME COLUMN "sleepQuality" TO sleep_quality;
ALTER TABLE sleep_logs RENAME COLUMN "sleepDuration" TO sleep_duration;
ALTER TABLE sleep_logs RENAME COLUMN "deepSleep" TO deep_sleep;
ALTER TABLE sleep_logs RENAME COLUMN "remSleep" TO rem_sleep;
ALTER TABLE sleep_logs RENAME COLUMN "lightSleep" TO light_sleep;
ALTER TABLE sleep_logs RENAME COLUMN "awakeDuration" TO awake_duration;
ALTER TABLE sleep_logs RENAME COLUMN "restingHr" TO resting_hr;
ALTER TABLE sleep_logs RENAME COLUMN "createdAt" TO created_at;
ALTER TABLE sleep_logs RENAME COLUMN "updatedAt" TO updated_at;

-- progress_photos table
ALTER TABLE progress_photos RENAME COLUMN "userId" TO user_id;
ALTER TABLE progress_photos RENAME COLUMN "photoUrl" TO photo_url;
ALTER TABLE progress_photos RENAME COLUMN "fileKey" TO file_key;
ALTER TABLE progress_photos RENAME COLUMN "bodyFatPct" TO body_fat_pct;
ALTER TABLE progress_photos RENAME COLUMN "createdAt" TO created_at;

-- ai_insights table
ALTER TABLE ai_insights RENAME COLUMN "userId" TO user_id;
ALTER TABLE ai_insights RENAME COLUMN "generatedAt" TO generated_at;
ALTER TABLE ai_insights RENAME COLUMN "weekStart" TO week_start;
ALTER TABLE ai_insights RENAME COLUMN "weekEnd" TO week_end;

-- health_goals table
ALTER TABLE health_goals RENAME COLUMN "userId" TO user_id;
ALTER TABLE health_goals RENAME COLUMN "goalType" TO goal_type;
ALTER TABLE health_goals RENAME COLUMN "targetValue" TO target_value;
ALTER TABLE health_goals RENAME COLUMN "isActive" TO is_active;
ALTER TABLE health_goals RENAME COLUMN "createdAt" TO created_at;
ALTER TABLE health_goals RENAME COLUMN "updatedAt" TO updated_at;

-- favourite_exercises table
ALTER TABLE favourite_exercises RENAME COLUMN "userId" TO user_id;
ALTER TABLE favourite_exercises RENAME COLUMN "createdAt" TO created_at;

-- daily_steps table
ALTER TABLE daily_steps RENAME COLUMN "userId" TO user_id;
ALTER TABLE daily_steps RENAME COLUMN "createdAt" TO created_at;
ALTER TABLE daily_steps RENAME COLUMN "updatedAt" TO updated_at;

-- medical_conditions table
ALTER TABLE medical_conditions RENAME COLUMN "userId" TO user_id;
ALTER TABLE medical_conditions RENAME COLUMN "createdAt" TO created_at;
ALTER TABLE medical_conditions RENAME COLUMN "updatedAt" TO updated_at;

-- medical_visits table
ALTER TABLE medical_visits RENAME COLUMN "userId" TO user_id;
ALTER TABLE medical_visits RENAME COLUMN "createdAt" TO created_at;

-- medical_attachments table
ALTER TABLE medical_attachments RENAME COLUMN "userId" TO user_id;
ALTER TABLE medical_attachments RENAME COLUMN "createdAt" TO created_at;

-- supplements table
ALTER TABLE supplements RENAME COLUMN "userId" TO user_id;
ALTER TABLE supplements RENAME COLUMN "createdAt" TO created_at;
ALTER TABLE supplements RENAME COLUMN "updatedAt" TO updated_at;

-- supplement_logs table
ALTER TABLE supplement_logs RENAME COLUMN "userId" TO user_id;
ALTER TABLE supplement_logs RENAME COLUMN "createdAt" TO created_at;

-- supplement_purchases table
ALTER TABLE supplement_purchases RENAME COLUMN "userId" TO user_id;
ALTER TABLE supplement_purchases RENAME COLUMN "createdAt" TO created_at;
ALTER TABLE supplement_purchases RENAME COLUMN "updatedAt" TO updated_at;

-- supplement_stock_adjustments table
ALTER TABLE supplement_stock_adjustments RENAME COLUMN "userId" TO user_id;
ALTER TABLE supplement_stock_adjustments RENAME COLUMN "createdAt" TO created_at;

-- running_log_photos table
ALTER TABLE running_log_photos RENAME COLUMN "userId" TO user_id;
ALTER TABLE running_log_photos RENAME COLUMN "createdAt" TO created_at;

-- step_log_photos table
ALTER TABLE step_log_photos RENAME COLUMN "userId" TO user_id;
ALTER TABLE step_log_photos RENAME COLUMN "createdAt" TO created_at;

-- custom_exercises table
ALTER TABLE custom_exercises RENAME COLUMN "userId" TO user_id;
ALTER TABLE custom_exercises RENAME COLUMN "createdAt" TO created_at;

-- blood_pressure_logs table
ALTER TABLE blood_pressure_logs RENAME COLUMN "userId" TO user_id;
ALTER TABLE blood_pressure_logs RENAME COLUMN "createdAt" TO created_at;

-- physio_sessions table
ALTER TABLE physio_sessions RENAME COLUMN "userId" TO user_id;
ALTER TABLE physio_sessions RENAME COLUMN "createdAt" TO created_at;
ALTER TABLE physio_sessions RENAME COLUMN "updatedAt" TO updated_at;

-- physio_exercises table
ALTER TABLE physio_exercises RENAME COLUMN "createdAt" TO created_at;

-- fasting_logs table
ALTER TABLE fasting_logs RENAME COLUMN "userId" TO user_id;
ALTER TABLE fasting_logs RENAME COLUMN "createdAt" TO created_at;
ALTER TABLE fasting_logs RENAME COLUMN "updatedAt" TO updated_at;

-- food_favorites table
ALTER TABLE food_favorites RENAME COLUMN "userId" TO user_id;
ALTER TABLE food_favorites RENAME COLUMN "foodName" TO food_name;
ALTER TABLE food_favorites RENAME COLUMN "servingSize" TO serving_size;
ALTER TABLE food_favorites RENAME COLUMN "servingUnit" TO serving_unit;
ALTER TABLE food_favorites RENAME COLUMN "createdAt" TO created_at;

-- food_analysis_history table
ALTER TABLE food_analysis_history RENAME COLUMN "userId" TO user_id;
ALTER TABLE food_analysis_history RENAME COLUMN "photoUrl" TO photo_url;
ALTER TABLE food_analysis_history RENAME COLUMN "analysisResult" TO analysis_result;
ALTER TABLE food_analysis_history RENAME COLUMN "totalCalories" TO total_calories;
ALTER TABLE food_analysis_history RENAME COLUMN "analyzedAt" TO analyzed_at;
