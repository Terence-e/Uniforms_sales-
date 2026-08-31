-- Rollback of 20260101000100_stock.sql.
--
-- DO NOT run this with `supabase db push` -- it is a hand-applied rollback (see
-- the header of 20260101000000_init_down.sql). Apply it *before* rolling back
-- the init migration and *after* rolling back the roles migration.

-- Tables carry their triggers and indexes with them.
drop table if exists public.stock_movements cascade;
drop table if exists public.stock_levels cascade;

drop function if exists public.apply_stock_movement();

drop type if exists public.stock_movement_kind;
