-- Profiles: everyone reads their own row; admins read and manage all.
-- Idempotent -- safe to re-run after edits.

drop policy if exists "profiles_select_self" on public.profiles;
create policy "profiles_select_self"
  on public.profiles for select
  to authenticated
  using (id = (select auth.uid()));

-- Oversight roles (administration, maintenance, super_admin) read every profile.
drop policy if exists "profiles_select_admin" on public.profiles;
create policy "profiles_select_admin"
  on public.profiles for select
  to authenticated
  using (public.can_oversee());

-- Sellers may edit their own name but never their own role, so the role change
-- is blocked by comparing against the stored value. The stored role is read via
-- current_user_role() -- a SECURITY DEFINER helper -- NOT an inline subquery on
-- public.profiles: a subquery against this same table from within its own policy
-- makes Postgres reject every write with "infinite recursion detected in policy
-- for relation profiles", which broke profile updates for every user.
drop policy if exists "profiles_update_self" on public.profiles;
create policy "profiles_update_self"
  on public.profiles for update
  to authenticated
  using (id = (select auth.uid()))
  with check (
    id = (select auth.uid())
    and role = public.current_user_role()
  );

-- Managing other people's accounts (role, activation) is super_admin only.
drop policy if exists "profiles_update_admin" on public.profiles;
create policy "profiles_update_admin"
  on public.profiles for update
  to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

-- Rows are created by the on_auth_user_created trigger, not by clients.
-- No insert or delete policy is granted on purpose.
