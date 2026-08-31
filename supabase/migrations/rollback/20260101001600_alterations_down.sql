-- Rollback for 20260101001600_alterations.sql.
--
-- MANUAL ONLY -- see supabase/README.md. Run
-- 20260101001700_alteration_transitions_down.sql first; its triggers depend on
-- this table.
--
-- Caveat: dropping this table destroys the record of every garment the school
-- is holding on behalf of a family, including what work was agreed and what was
-- paid. Those garments are other people's property. Export public.alterations
-- before running this anywhere real -- the audit_log rows survive, but they
-- record transitions, not the intake terms.
--
-- Postgres cannot remove a value from an enum, but the type itself can go once
-- no column references it, which the table drop below takes care of.

drop table if exists public.alterations;
drop type if exists public.alteration_status;
