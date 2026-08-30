-- Rollback for 20260101001900_bug_reports.sql.
--
-- MANUAL ONLY -- see supabase/README.md.
--
-- Caveat: dropping bug_reports destroys everything users took the trouble to
-- report, including anything not yet acted on. Export it first if this is not
-- a scratch database -- these are the failures Sentry never saw, so there is no
-- second copy anywhere.

drop table if exists public.bug_reports;

-- Dropped last: the policies in 11_bug_reports.sql reference it, so revert
-- those first or this fails on a dependent object.
drop function if exists public.is_maintenance();
