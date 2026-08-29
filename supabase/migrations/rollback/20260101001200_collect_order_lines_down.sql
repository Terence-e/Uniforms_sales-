-- Rollback for 20260101001200_collect_order_lines.sql.
--
-- MANUAL ONLY -- see supabase/README.md. Run this BEFORE
-- 20260101001100_collections_down.sql.
--
-- Dropping this function removes the only path that records a collection
-- atomically. Nothing else writes collections, collection_items and the
-- matching stock movement together, so with it gone the collection screen
-- stops working rather than degrading into partial writes.

drop function if exists public.collect_order_lines(uuid, uuid[], text, uuid);
