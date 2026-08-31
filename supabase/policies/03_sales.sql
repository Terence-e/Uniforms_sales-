-- Sales and their line items.
--
-- Every signed-in user sees ALL sales: the sales ledger is shared information,
-- so the whole team works from the same numbers and the same list regardless of
-- who recorded each sale. Read is universal; write stays gated by role. Only
-- operators (seller, maintenance, super_admin) may record a sale -- Administration
-- is read-only (A-FR-2.2). Nothing is deletable and only the super_admin may
-- amend a recorded sale -- a sales ledger that staff can quietly rewrite is not a
-- ledger.

-- ---------------------------------------------------------------- sales

-- Superseded by sales_select_all: drop the old per-owner / oversight split so a
-- re-run of this file leaves exactly one, shared select policy in place.
drop policy if exists "sales_select_own" on public.sales;
drop policy if exists "sales_select_admin" on public.sales;

drop policy if exists "sales_select_all" on public.sales;
create policy "sales_select_all"
  on public.sales for select
  to authenticated
  using (true);

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

-- Line items inherit their parent sale's visibility. Sales are now readable by
-- every signed-in user, so their lines are too.
drop policy if exists "sale_items_select_via_sale" on public.sale_items;
create policy "sale_items_select_via_sale"
  on public.sale_items for select
  to authenticated
  using (
    exists (
      select 1 from public.sales s
      where s.id = sale_items.sale_id
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
