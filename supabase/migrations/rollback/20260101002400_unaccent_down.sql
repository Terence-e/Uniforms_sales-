-- Rollback for 20260101002400_unaccent.sql.
--
-- MANUAL ONLY -- see supabase/README.md. Run
-- 20260101002500_search_transactions_down.sql FIRST: that function calls
-- unaccent(), so dropping the extension while it exists breaks the search
-- rather than removing it.

drop extension if exists unaccent;
