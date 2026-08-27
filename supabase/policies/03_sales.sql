-- Sales and their line items.
--
-- A seller sees and creates only their own sales; oversight roles see
-- everything. Only operators (seller, maintenance, super_admin) may record a
-- sale -- Administration is read-only (A-FR-2.2). Nothing is deletable and only
-- the super_admin may amend a recorded sale -- a sales ledger that staff can
-- quietly rewrite is not a ledger.

-- ---------------------------------------------------------------- sales

drop policy if exists "sales_select_own" on public.sales;
create policy "sales_select_own"
  on public.sales for select
  to authenticated
  using (seller_id = (select auth.uid()));

drop policy if exists "sales_select_admin" on public.sales;
create policy "sales_select_admin"
  on public.sales for select
  to authenticated
  using (public.can_oversee());

drop policy if exists "sales_insert_own" on public.sales;
create policy "sales_insert_own"
  on public.sales for insert
  to authenticated
  with check (seller_id = (select auth.uid()) and public.can_operate());

drop policy if exists "sales_update_admin" on public.sales;
create policy "sales_update_admin"
  on public.sales for update
  to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

-- ---------------------------------------------------------------- sale_items

-- Line items inherit their parent sale's visibility.
drop policy if exists "sale_items_select_via_sale" on public.sale_items;
create policy "sale_items_select_via_sale"
  on public.sale_items for select
  to authenticated
  using (
    exists (
      select 1 from public.sales s
      where s.id = sale_items.sale_id
        and (s.seller_id = (select auth.uid()) or public.can_oversee())
    )
  );

drop policy if exists "sale_items_insert_via_sale" on public.sale_items;
create policy "sale_items_insert_via_sale"
  on public.sale_items for insert
  to authenticated
  with check (
    public.can_operate()
    and exists (
      select 1 from public.sales s
      where s.id = sale_items.sale_id
        and s.seller_id = (select auth.uid())
    )
  );

drop policy if exists "sale_items_update_admin" on public.sale_items;
create policy "sale_items_update_admin"
  on public.sale_items for update
  to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());
