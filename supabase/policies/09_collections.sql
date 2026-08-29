-- Collections and the lines they cover.
--
-- Read-only from the client. Nothing inserts here directly: collect_order_lines()
-- is security definer and does the writing, because one collection spans four
-- tables and must not be able to half-happen. Granting insert as well would
-- offer a second, unsafe route to the same thing.
--
-- Visibility follows the order, exactly as order_items do: a seller sees slips
-- against their own orders, oversight roles see all.
--
-- Idempotent -- safe to re-run after edits.

-- ---------------------------------------------------------------- collections

drop policy if exists "collections_select_via_order" on public.collections;
create policy "collections_select_via_order"
  on public.collections for select
  to authenticated
  using (
    exists (
      select 1 from public.orders o
      where o.id = collections.order_id
        and (o.seller_id = (select auth.uid()) or public.can_oversee())
    )
  );

-- ---------------------------------------------------------- collection_items

drop policy if exists "collection_items_select_via_collection" on public.collection_items;
create policy "collection_items_select_via_collection"
  on public.collection_items for select
  to authenticated
  using (
    exists (
      select 1
      from public.collections c
      join public.orders o on o.id = c.order_id
      where c.id = collection_items.collection_id
        and (o.seller_id = (select auth.uid()) or public.can_oversee())
    )
  );
