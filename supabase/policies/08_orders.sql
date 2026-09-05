-- Orders and their line items.
--
-- Read is universal, matching sales (03_sales.sql): the open-jobs list is the
-- Seller's landing screen and must show EVERY order, and Administration sees the
-- same list read-only (A-FR-9.16, A-FR-9.22). Orders were previously scoped to
-- their own seller, which hid any order recorded by another account from the
-- Seller -- the whole team works one shared ledger, exactly as it does for sales.
--
-- Write stays gated by role: only operators (seller, maintenance, super_admin)
-- place an order or move a line along; only the super_admin amends the order row;
-- nothing is deletable.
--
-- Idempotent -- safe to re-run after edits.

-- ---------------------------------------------------------------- orders

-- Superseded by orders_select_all: drop the old per-owner / oversight split.
drop policy if exists "orders_select_own" on public.orders;
drop policy if exists "orders_select_admin" on public.orders;

drop policy if exists "orders_select_all" on public.orders;
create policy "orders_select_all"
  on public.orders for select
  to authenticated
  using (true);

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

-- Lines inherit the order's visibility. Orders are readable by every signed-in
-- user now, so their lines are too.
drop policy if exists "order_items_select_via_order" on public.order_items;
create policy "order_items_select_via_order"
  on public.order_items for select
  to authenticated
  using (
    exists (
      select 1 from public.orders o
      where o.id = order_items.order_id
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

-- Any operator moves any order line through the workflow -- it is one shared
-- shop, and the open-jobs card advances a job in one tap regardless of who first
-- recorded it (A-FR-9.20). This grants UPDATE on the whole row, which RLS cannot
-- narrow to a column -- guard_order_item_contents() stops a price rewrite and
-- enforce_order_line_transition() stops an illegal jump, which is what keeps it
-- safe.
drop policy if exists "order_items_update_own" on public.order_items;
create policy "order_items_update_own"
  on public.order_items for update
  to authenticated
  using (public.can_operate())
  with check (public.can_operate());

drop policy if exists "order_items_update_admin" on public.order_items;
create policy "order_items_update_admin"
  on public.order_items for update
  to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());
