-- BodyFit AI Hub v3.14.0
-- The product no longer includes fasting, supplements, medical records, or physiotherapy.
-- Drop children first so no unrelated public tables are affected.

DROP TABLE IF EXISTS public.medical_attachments;
DROP TABLE IF EXISTS public.medical_visits;
DROP TABLE IF EXISTS public.medical_conditions;

DROP TABLE IF EXISTS public.supplement_stock_adjustments;
DROP TABLE IF EXISTS public.supplement_purchases;
DROP TABLE IF EXISTS public.supplement_logs;
DROP TABLE IF EXISTS public.supplements;

DROP TABLE IF EXISTS public.physio_exercises;
DROP TABLE IF EXISTS public.physio_sessions;

DROP TABLE IF EXISTS public.fasting_logs;
