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

-- Status now lives on the lines, not the order, so operators need no update
-- rights here: moving a line is an order_items update. The order row itself
-- stays super_admin-only, matching sales.
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

-- Operators move their own order lines through the workflow. This grants UPDATE
-- on the whole row, which RLS cannot narrow to a single column -- the
-- guard_order_item_contents() trigger is what stops a seller rewriting the
-- price after the parent has paid, and enforce_order_line_transition() is what
-- stops an illegal jump. Together they make this policy safe.
drop policy if exists "order_items_update_own" on public.order_items;
create policy "order_items_update_own"
  on public.order_items for update
  to authenticated
  using (
    public.can_operate()
    and exists (
      select 1 from public.orders o
      where o.id = order_items.order_id
        and (o.seller_id = (select auth.uid()) or public.can_oversee())
    )
  )
  with check (
    public.can_operate()
    and exists (
      select 1 from public.orders o
      where o.id = order_items.order_id
        and (o.seller_id = (select auth.uid()) or public.can_oversee())
    )
  );

drop policy if exists "order_items_update_admin" on public.order_items;
create policy "order_items_update_admin"
  on public.order_items for update
  to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());
