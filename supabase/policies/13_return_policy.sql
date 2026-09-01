-- The return policy windows (A-FR-8.8).
--
-- Every signed-in user reads them: the verdict banner has to render for the
-- seller standing at the counter, and a policy nobody can see is a policy
-- nobody can follow.
--
-- Only the Super Admin writes. A-FR-8.8 says the values are editable rather
-- than hardcoded precisely so the rule can be adjusted without a deployment --
-- but a seller who could widen a window to fit the return they are currently
-- recording would make the override, and the whole out-of-policy report,
-- meaningless.
--
-- No insert and no delete policy: the four rows are fixed by a trigger, and
-- there is nothing to add or remove.
--
-- Idempotent -- safe to re-run after edits.

drop policy if exists "return_policy_select_all" on public.return_policy;
create policy "return_policy_select_all"
  on public.return_policy for select
  to authenticated
  using (true);

drop policy if exists "return_policy_update_super_admin" on public.return_policy;
create policy "return_policy_update_super_admin"
  on public.return_policy for update
  to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());
