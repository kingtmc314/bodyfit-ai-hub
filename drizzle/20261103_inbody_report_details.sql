-- Additive only. Legacy Drizzle snapshots are malformed; no legacy migration is replayed.
-- Existing body metrics and records remain unchanged. Store image bytes in object storage,
-- and only the reviewed report data and source reference in Supabase JSONB.
ALTER TABLE public.body_composition ADD COLUMN IF NOT EXISTS report_details jsonb;
