-- Rollback of 20260101000600_product_prices_history.sql. Manual (see the header
-- in rollback/20260101000000_init_down.sql).

drop table if exists public.product_prices_history cascade;
