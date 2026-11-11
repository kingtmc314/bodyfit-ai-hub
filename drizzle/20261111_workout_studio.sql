-- Additive migration only. No existing workout, location or calorie value is changed.
-- Existing Drizzle snapshots are malformed; this narrow SQL is reviewed against live schema.
ALTER TABLE public.workout_sessions ADD COLUMN IF NOT EXISTS location text;
ALTER TABLE public.workout_sessions ADD COLUMN IF NOT EXISTS calorie_details jsonb;
