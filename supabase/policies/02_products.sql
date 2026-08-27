-- Products: any signed-in staff member may read the catalogue.
-- Only the super_admin may change it -- prices are super_admin only (A-FR-2.1),
-- and the seller can never modify a price in the catalogue or on the sale screen.

drop policy if exists "products_select_authenticated" on public.products;
create policy "products_select_authenticated"
  on public.products for select
  to authenticated
  using (true);

drop policy if exists "products_insert_admin" on public.products;
create policy "products_insert_admin"
  on public.products for insert
  to authenticated
  with check (public.is_super_admin());

drop policy if exists "products_update_admin" on public.products;
create policy "products_update_admin"
  on public.products for update
  to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

-- Deletes are withheld: products referenced by sale_items must survive so old
-- receipts stay reproducible. Retire a product with is_active = false instead.
