-- BodyFit AI Hub v3.14.1
-- Non-destructive additions for route-aware shoe performance, workout templates,
-- and saved running-lab weather comparisons. All existing health records remain intact.

ALTER TABLE public.running_logs
  ADD COLUMN IF NOT EXISTS route_type text;

ALTER TABLE public.workout_sessions
  ADD COLUMN IF NOT EXISTS template_key text,
  ADD COLUMN IF NOT EXISTS planned_exercises json;

CREATE TABLE IF NOT EXISTS public.running_lab_scenarios (
  id serial PRIMARY KEY,
  user_id integer NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  running_scenario text NOT NULL,
  easy_run_distance text,
  temperature_c real NOT NULL,
  humidity_pct integer NOT NULL,
  wind_kph real NOT NULL,
  baseline_pace_sec_per_km real,
  baseline_finish_seconds real NOT NULL,
  weather_pace_sec_per_km real NOT NULL,
  weather_finish_seconds real NOT NULL,
  weather_load_percent real NOT NULL,
  created_at timestamp DEFAULT now() NOT NULL,
  updated_at timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_running_logs_route_type
  ON public.running_logs (route_type);

CREATE INDEX IF NOT EXISTS idx_running_lab_scenarios_user_created
  ON public.running_lab_scenarios (user_id, created_at DESC);
