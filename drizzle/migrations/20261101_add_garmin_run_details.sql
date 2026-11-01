-- v3.14.2: Preserve reviewed Garmin multi-screenshot metrics with the related run.
-- Non-destructive: existing running records remain unchanged.
ALTER TABLE running_logs
  ADD COLUMN IF NOT EXISTS garmin_details JSONB,
  ADD COLUMN IF NOT EXISTS laps JSONB;
