-- Bug reports.
--
-- Anyone signed in may report a problem, including Administration: their
-- read-only status covers shop records, not complaining about the software.
--
-- Only Maintenance and the Super Admin may READ them, and that is the whole
-- point of the table being RLS-guarded rather than merely unlinked from the
-- nav. A report can quote a parent's name or a wrong total, and a screenshot
-- can carry anything that was on screen -- so "not in the menu" would not be
-- protection. Server-enforced means a seller with the anon key and a URL still
-- gets nothing back.
--
-- Idempotent -- safe to re-run after edits.

drop policy if exists "bug_reports_insert_any_signed_in" on public.bug_reports;
create policy "bug_reports_insert_any_signed_in"
  on public.bug_reports for insert
  to authenticated
  with check (reporter_id = (select auth.uid()));

drop policy if exists "bug_reports_select_maintenance" on public.bug_reports;
create policy "bug_reports_select_maintenance"
  on public.bug_reports for select
  to authenticated
  using (public.is_maintenance());

-- Marking one resolved is the only edit anyone may make; the description, the
-- captured context and the screenshot are what was reported and stay that way.
drop policy if exists "bug_reports_update_maintenance" on public.bug_reports;
create policy "bug_reports_update_maintenance"
  on public.bug_reports for update
  to authenticated
  using (public.is_maintenance())
  with check (public.is_maintenance());

-- No delete policy for anyone. A report someone could quietly remove is not a
-- record of anything.
