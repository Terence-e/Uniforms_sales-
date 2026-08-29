-- Price history is visible to the oversight roles (administration, maintenance,
-- super_admin) and is append-only: no insert/update/delete policy is granted, so
-- rows are only ever written by the Super-Admin catalogue action (service role)
-- and can never be edited or removed.

drop policy if exists "product_prices_select_oversight" on public.product_prices_history;
create policy "product_prices_select_oversight"
  on public.product_prices_history for select
  to authenticated
  using (public.can_oversee());
