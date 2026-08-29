-- Rollback for 20260101001100_collections.sql.
--
-- MANUAL ONLY -- see supabase/README.md. Run
-- 20260101001200_collect_order_lines_down.sql first; the function depends on
-- these tables.
--
-- Caveat: dropping collections destroys the record of which garments were
-- physically handed over, to whom, and by whom. The stock movements it caused
-- are NOT reversed -- deleting the paperwork does not put the garments back on
-- the shelf, and silently crediting stock here would invent inventory that
-- does not exist. Reverse them deliberately with compensating movements if
-- that is really what you want.
--
-- The order lines it collected keep status 'collected'. Since the transition
-- trigger forbids moving out of 'collected', reopening them means editing the
-- column directly as a superuser -- do that only if you know why.
--
-- Postgres cannot remove a value from an enum, so 'collection' stays in
-- stock_movement_kind permanently. That is not reversible and is why the
-- up-migration says so.

alter table public.stock_movements drop column if exists collection_id;

drop table if exists public.collection_items;
drop table if exists public.collections;
