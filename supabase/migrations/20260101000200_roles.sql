-- Phase 1 role model (spec A-2).
--
-- The initial schema shipped with only ('admin', 'seller'). The uniform system
-- has four roles with genuinely different permissions, and the difference is a
-- MUST, not cosmetic:
--
--   seller         operations only -- sales, production, orders, alterations,
--                  returns, exchanges, cancellations. Never prices (A-FR-2.1).
--   administration read-only everywhere. No write path at all (A-FR-2.2).
--   maintenance    full functional access, audited like anyone else.
--   super_admin    accounts, product catalogue, prices.
--
-- The old 'admin' value becomes 'super_admin' (the account/catalogue/price
-- owner); 'administration' and 'maintenance' are new. Enum values can be added
-- but never dropped, so this is a one-way, additive change.

alter type public.user_role rename value 'admin' to 'super_admin';
alter type public.user_role add value if not exists 'administration';
alter type public.user_role add value if not exists 'maintenance';

-- Predicates used by the policies. They compare the caller's role as *text* on
-- purpose: an enum value added earlier in this same transaction cannot be used
-- as an enum literal yet, but casting to text sidesteps that entirely and keeps
-- the helpers re-runnable.

create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $fn$
  select coalesce(public.current_user_role()::text = 'super_admin', false);
$fn$;

-- Kept for backward compatibility. It now means "super_admin" -- the only role
-- that may touch the catalogue, prices and accounts.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $fn$
  select public.is_super_admin();
$fn$;

-- Full read visibility over other people's transactions: the oversight roles.
-- Sellers still see their own rows through the existing self policies.
create or replace function public.can_oversee()
returns boolean
language sql
stable
security definer
set search_path = public
as $fn$
  select coalesce(
    public.current_user_role()::text = any (array['administration', 'maintenance', 'super_admin']),
    false
  );
$fn$;

-- May record operational transactions (sales, stock movements). Administration
-- is deliberately excluded -- it has no write path anywhere (A-FR-2.2).
create or replace function public.can_operate()
returns boolean
language sql
stable
security definer
set search_path = public
as $fn$
  select coalesce(
    public.current_user_role()::text = any (array['seller', 'maintenance', 'super_admin']),
    false
  );
$fn$;
