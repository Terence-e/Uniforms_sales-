-- Rollback for 20260101001700_alteration_transitions.sql.
--
-- MANUAL ONLY -- see supabase/README.md. Run this BEFORE
-- 20260101001600_alterations_down.sql.
--
-- Removing these leaves the alterations table writable with no sequence
-- enforcement, no mandatory reasons, no audit rows and no protection on the
-- agreed terms. If you are rolling back the workflow but keeping the table,
-- understand that the UI is then the only thing standing between a seller and
-- a rewritten charge.

drop trigger if exists alterations_guard_terms on public.alterations;
drop trigger if exists alterations_enforce_transition on public.alterations;

drop function if exists public.guard_alteration_terms();
drop function if exists public.enforce_alteration_transition();
drop function if exists public.alteration_status_rank(public.alteration_status);
