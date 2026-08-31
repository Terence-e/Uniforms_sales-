-- Rollback for 20260101000800_orders.sql.
--
-- MANUAL ONLY -- apply by hand (psql or the SQL editor), never with `db push`
-- or `db reset`. See supabase/README.md.
--
-- Caveat: dropping public.orders destroys every order placed, including money
-- already taken at the counter. Export public.orders and public.order_items
-- before running this on anything but a scratch database.
--
-- Revert supabase/policies/08_orders.sql (drop its policies) before running
-- this, otherwise the drops below fail on dependent objects.

drop trigger if exists orders_touch on public.orders;

drop table if exists public.order_items;
drop table if exists public.orders;

drop function if exists public.next_reference(text);
drop table if exists public.reference_counters;

-- Dropping the type is only safe once no column references it; the table drops
-- above take care of that.
drop type if exists public.order_status;
