-- Collections and the lines they cover.
--
-- Read-only from the client. Nothing inserts here directly: collect_order_lines()
-- is security definer and does the writing, because one collection spans four
-- tables and must not be able to half-happen. Granting insert as well would
-- offer a second, unsafe route to the same thing.
--
-- Visibility follows the order, exactly as order_items do: orders are readable
-- by every signed-in user (08_orders.sql), so the slips against them are too --
-- the collection history is shared like the sales ledger.
--
-- Idempotent -- safe to re-run after edits.

-- ---------------------------------------------------------------- collections

drop policy if exists "collections_select_via_order" on public.collections;
create policy "collections_select_via_order"
  on public.collections for select
  to authenticated
  using (
    -- Orders are readable by every signed-in user (08_orders.sql), so the slips
    -- against them are too -- the collection history is shared like the ledger.
    exists (
      select 1 from public.orders o
      where o.id = collections.order_id
    )
  );

-- ---------------------------------------------------------- collection_items

drop policy if exists "collection_items_select_via_collection" on public.collection_items;
create policy "collection_items_select_via_collection"
  on public.collection_items for select
  to authenticated
  using (
    exists (
      select 1 from public.collections c
      where c.id = collection_items.collection_id
    )
  );
