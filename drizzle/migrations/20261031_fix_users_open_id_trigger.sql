-- BodyFit AI Hub v3.14.0
-- `users.open_id` is the canonical post-migration field. Remove the stale trigger
-- that still referenced the retired camelCase `NEW."openId"` record field.
DROP TRIGGER IF EXISTS sync_open_id_trigger ON public.users;
DROP FUNCTION IF EXISTS public.sync_open_id();
