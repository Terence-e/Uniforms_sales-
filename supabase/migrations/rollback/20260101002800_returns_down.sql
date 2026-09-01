-- Down for 20260101002800_returns.sql.
--
-- Run 20260101002900_record_return_down.sql FIRST: record_return() depends on
-- the types dropped here and will block them.
--
-- The 'exchange' value added to stock_movement_kind is NOT removed, because
-- Postgres cannot remove an enum value. Nothing is stranded by leaving it: with
-- returns gone, no row can carry it.

drop trigger if exists return_items_enforce_returnable on public.return_items;
drop function if exists public.enforce_returnable_quantity();

drop trigger if exists sales_guard_immutable on public.sales;
drop function if exists public.guard_sale_immutable();

drop trigger if exists returns_touch on public.returns;

-- Dropped before the tables it points at.
alter table public.stock_movements drop column if exists return_id;

drop table if exists public.return_items;
drop table if exists public.returns;

drop type if exists public.return_direction;
drop type if exists public.garment_condition;
drop type if exists public.return_kind;
