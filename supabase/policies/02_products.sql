-- Products: any signed-in staff member may read the catalogue.
-- Only admins may change it.

drop policy if exists "products_select_authenticated" on public.products;
create policy "products_select_authenticated"
  on public.products for select
  to authenticated
  using (true);

drop policy if exists "products_insert_admin" on public.products;
create policy "products_insert_admin"
  on public.products for insert
  to authenticated
  with check (public.is_admin());

drop policy if exists "products_update_admin" on public.products;
create policy "products_update_admin"
  on public.products for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Deletes are withheld: products referenced by sale_items must survive so old
-- receipts stay reproducible. Retire a product with is_active = false instead.
