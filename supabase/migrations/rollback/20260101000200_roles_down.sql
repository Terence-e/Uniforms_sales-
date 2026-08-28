-- Rollback of 20260101000200_roles.sql.
--
-- DO NOT run this with `supabase db push` -- it is a hand-applied rollback (see
-- the header of 20260101000000_init_down.sql). This is the FIRST file to run
-- when unwinding, because the RLS policies depend on the helpers it removes.
--
-- Two things make this migration only partly reversible:
--
--   1. The RLS policies in supabase/policies/ call is_super_admin(),
--      can_oversee() and can_operate(). Postgres refuses to drop a function a
--      live policy still references, so those policies must be reverted to their
--      pre-roles form (or dropped) BEFORE running this file. There is no
--      versioned "old" copy -- the policy files were edited in place -- so
--      restore them from git history (the commit before the roles work) first.
--
--   2. Postgres cannot DROP a value from an enum. Removing 'administration' and
--      'maintenance' means recreating the type with only its original values,
--      which fails if any profile still holds one of them. Reassign those
--      accounts (e.g. to 'seller') first; the failure below is the safety net.

-- --- 1. drop the helpers this migration added -------------------------------
-- These error out if a policy still depends on them -- that is the reminder to
-- revert the policy files first (see note 1 above).
drop function if exists public.can_operate();
drop function if exists public.can_oversee();
drop function if exists public.is_super_admin();

-- --- 2. recreate user_role with its original two values ----------------------
-- Functions that reference the type must go before the type can be swapped.
drop function if exists public.is_admin();
drop function if exists public.current_user_role();

-- The column default references the type; detach it for the duration.
alter table public.profiles alter column role drop default;

alter type public.user_role rename to user_role__old;

create type public.user_role as enum ('admin', 'seller');

-- Map the old values onto the restored set: super_admin -> admin. Any row still
-- holding 'administration' or 'maintenance' maps to NULL, which trips the column's
-- NOT NULL constraint and aborts the rollback -- reassign those accounts first.
alter table public.profiles
  alter column role type public.user_role
  using (
    case role::text
      when 'super_admin' then 'admin'
      when 'seller'      then 'seller'
      else null
    end::public.user_role
  );

alter table public.profiles alter column role set default 'seller';

drop type public.user_role__old;

-- --- 3. restore the helpers exactly as init.sql shipped them ------------------
create or replace function public.current_user_role()
returns public.user_role
language sql
stable
security definer
set search_path = public
as $fn$
  select role from public.profiles where id = auth.uid();
$fn$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $fn$
  select coalesce(public.current_user_role() = 'admin', false);
$fn$;
