-- Orders and their line items.
--
-- Mirrors the sales policies exactly (03_sales.sql): a seller sees and creates
-- only their own orders, oversight roles see everything, only operators may
-- place one, and nothing is deletable. An order carries money taken at the
-- counter, so it is as much a ledger row as a sale is.
--
-- Idempotent -- safe to re-run after edits.

-- ---------------------------------------------------------------- orders

drop policy if exists "orders_select_own" on public.orders;
create policy "orders_select_own"
  on public.orders for select
  to authenticated
  using (seller_id = (select auth.uid()));

drop policy if exists "orders_select_admin" on public.orders;
create policy "orders_select_admin"
  on public.orders for select
  to authenticated
  using (public.can_oversee());

drop policy if exists "orders_insert_own" on public.orders;
create policy "orders_insert_own"
  on public.orders for insert
  to authenticated
  with check (seller_id = (select auth.uid()) and public.can_operate());

-- Status transitions (Ordered -> In production -> Ready -> Collected) are a
-- separate issue; operators will need update rights when that lands. Until
-- then only the super_admin may amend a placed order, matching sales.
drop policy if exists "orders_update_admin" on public.orders;
create policy "orders_update_admin"
  on public.orders for update
  to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

-- ---------------------------------------------------------------- order_items

drop policy if exists "order_items_select_via_order" on public.order_items;
create policy "order_items_select_via_order"
  on public.order_items for select
  to authenticated
  using (
    exists (
      select 1 from public.orders o
      where o.id = order_items.order_id
        and (o.seller_id = (select auth.uid()) or public.can_oversee())
    )
  );

drop policy if exists "order_items_insert_via_order" on public.order_items;
create policy "order_items_insert_via_order"
  on public.order_items for insert
  to authenticated
  with check (
    public.can_operate()
    and exists (
      select 1 from public.orders o
      where o.id = order_items.order_id
        and o.seller_id = (select auth.uid())
    )
  );

drop policy if exists "order_items_update_admin" on public.order_items;
create policy "order_items_update_admin"
  on public.order_items for update
  to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());
