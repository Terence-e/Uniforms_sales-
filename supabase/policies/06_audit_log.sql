-- The audit log is readable by every signed-in role (A-FR-11.4) and is
-- append-only (A-FR-11.3): no insert / update / delete policy is granted to
-- anyone, so entries can only be written by trusted server code (service role)
-- and can never be edited or removed through the app.

drop policy if exists "audit_select_all" on public.audit_log;
create policy "audit_select_all"
  on public.audit_log for select
  to authenticated
  using (true);
