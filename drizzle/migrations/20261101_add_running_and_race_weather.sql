-- v3.14.2: Complete weather context for running logs and races.
-- All changes are additive and idempotent; no historical health or running data is deleted.
ALTER TABLE running_logs
  ADD COLUMN IF NOT EXISTS wind_speed REAL,
  ADD COLUMN IF NOT EXISTS apparent_temp REAL,
  ADD COLUMN IF NOT EXISTS precipitation REAL,
  ADD COLUMN IF NOT EXISTS weather_code INTEGER,
  ADD COLUMN IF NOT EXISTS weather_condition TEXT,
  ADD COLUMN IF NOT EXISTS weather_location TEXT,
  ADD COLUMN IF NOT EXISTS weather_observed_at TEXT,
  ADD COLUMN IF NOT EXISTS weather_source TEXT;

ALTER TABLE races
  ADD COLUMN IF NOT EXISTS temperature REAL,
  ADD COLUMN IF NOT EXISTS humidity REAL,
  ADD COLUMN IF NOT EXISTS wind_speed REAL,
  ADD COLUMN IF NOT EXISTS apparent_temp REAL,
  ADD COLUMN IF NOT EXISTS precipitation REAL,
  ADD COLUMN IF NOT EXISTS weather_code INTEGER,
  ADD COLUMN IF NOT EXISTS weather_condition TEXT,
  ADD COLUMN IF NOT EXISTS weather_location TEXT,
  ADD COLUMN IF NOT EXISTS weather_observed_at TEXT,
  ADD COLUMN IF NOT EXISTS weather_source TEXT;
