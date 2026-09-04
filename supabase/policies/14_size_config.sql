-- The size set (A-FR-4.2).
--
-- Every signed-in user reads it: the size boxes have to render for the seller
-- standing at the counter, and a set nobody can see is a set nobody can sell
-- against.
--
-- Only the Super Admin writes it, exactly like the return policy and the
-- catalogue price. A seller who could add or move sizes could reshape what is
-- sellable to fit whatever they are recording, and stock is tracked per size --
-- so the set is not the seller's to change.
--
-- No insert and no delete policy: the single row is seeded by the migration and
-- there is nothing to add or remove.
--
-- Idempotent -- safe to re-run after edits.

drop policy if exists "size_config_select_all" on public.app_size_config;
create policy "size_config_select_all"
  on public.app_size_config for select
  to authenticated
  using (true);

drop policy if exists "size_config_update_super_admin" on public.app_size_config;
create policy "size_config_update_super_admin"
  on public.app_size_config for update
  to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());
