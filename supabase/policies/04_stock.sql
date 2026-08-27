-- Stock. All staff can see what is on hand; only operators (seller, maintenance,
-- super_admin) record movements -- Administration is read-only (A-FR-2.2).
-- stock_levels is written by the apply_stock_movement trigger, never directly.

drop policy if exists "stock_levels_select_authenticated" on public.stock_levels;
create policy "stock_levels_select_authenticated"
  on public.stock_levels for select
  to authenticated
  using (true);

drop policy if exists "stock_movements_select_authenticated" on public.stock_movements;
create policy "stock_movements_select_authenticated"
  on public.stock_movements for select
  to authenticated
  using (true);

-- Sellers may only record the 'sale' movements that accompany their own sale.
drop policy if exists "stock_movements_insert_sale" on public.stock_movements;
create policy "stock_movements_insert_sale"
  on public.stock_movements for insert
  to authenticated
  with check (
    public.can_operate()
    and created_by = (select auth.uid())
    and kind = 'sale'
    and exists (
      select 1 from public.sales s
      where s.id = stock_movements.sale_id
        and s.seller_id = (select auth.uid())
    )
  );

-- Intake, returns and stocktake corrections are an operator action.
drop policy if exists "stock_movements_insert_admin" on public.stock_movements;
create policy "stock_movements_insert_admin"
  on public.stock_movements for insert
  to authenticated
  with check (public.can_operate() and created_by = (select auth.uid()));

-- The ledger is append-only: no update or delete policy for anyone. Correct a
-- mistake with a compensating 'adjustment' movement.
