-- Rollback of 20260101000000_init.sql.
--
-- DO NOT run this with `supabase db push` -- it is a hand-applied rollback, not
-- a forward migration. Apply it yourself (psql or the SQL editor) when you need
-- to unwind the migration, and only after its later siblings have been rolled
-- back first:
--
--     20260101000200_roles_down.sql
--     20260101000100_stock_down.sql
--     20260101000000_init_down.sql   <- this file, last
--
-- Everything is dropped in reverse dependency order.

-- The only trigger that lives outside public (drop before its function).
drop trigger if exists on_auth_user_created on auth.users;

-- Tables take their own triggers, indexes and the receipt default with them.
drop table if exists public.sale_items cascade;
drop table if exists public.sales cascade;
drop table if exists public.products cascade;
drop table if exists public.profiles cascade;

drop sequence if exists public.receipt_seq;

-- is_admin() reads current_user_role(): drop the caller first.
drop function if exists public.next_receipt_no();
drop function if exists public.touch_updated_at();
drop function if exists public.is_admin();
drop function if exists public.current_user_role();
drop function if exists public.handle_new_user();

drop type if exists public.payment_method;
drop type if exists public.user_role;

-- pgcrypto is deliberately left installed: it is commonly shared across schemas
-- and dropping it here could break unrelated objects.
