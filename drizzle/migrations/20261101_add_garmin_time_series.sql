-- v3.14.4: preserve Garmin FIT/CSV per-sample running data beside the existing reviewed summary.
-- Non-destructive: existing running records remain unchanged and receive NULL until an original file is imported.
ALTER TABLE running_logs
  ADD COLUMN IF NOT EXISTS time_series JSONB;
