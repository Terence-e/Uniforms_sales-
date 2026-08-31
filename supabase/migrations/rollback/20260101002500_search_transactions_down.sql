-- Rollback for 20260101002500_search_transactions.sql.
--
-- MANUAL ONLY -- see supabase/README.md. Run this BEFORE
-- 20260101002400_unaccent_down.sql.
--
-- Nothing is lost but the ability to search: this function only reads. The
-- screens that call it will fail, which is the intended signal that the search
-- is gone rather than merely returning nothing.

drop function if exists public.search_transactions(text, text[], text, date, date, integer, integer);
