-- Rollback for 20260101001400_record_production_batch.sql.
--
-- MANUAL ONLY -- see supabase/README.md. Run this BEFORE
-- 20260101001300_production_entry_down.sql.
--
-- Dropping this function removes the only path that records a production batch
-- atomically and writes its audit row. With it gone the production screen stops
-- working rather than degrading into partial batches.

drop function if exists public.record_production_batch(jsonb, date, text, text);
