-- Core schema: people, catalogue, sales.
-- Structure and RLS *enablement* live here; the policies themselves are in
-- supabase/policies/ so they can be re-applied without a new migration.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------- enums

create type public.user_role as enum ('admin', 'seller');
create type public.payment_method as enum ('cash', 'mobile_money', 'bank_transfer');

-- ---------------------------------------------------------------- profiles

create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  full_name   text not null default '',
  role        public.user_role not null default 'seller',
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table public.profiles is 'Application profile for each auth user.';

-- Mirror new auth users into profiles.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''))
  on conflict (id) do nothing;
  return new;
end;
$fn$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Read the caller's role without recursing through profiles' own RLS.
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

-- ---------------------------------------------------------------- products

create table public.products (
  id          uuid primary key default gen_random_uuid(),
  sku         text not null unique,
  name_en     text not null,
  name_fr     text not null,
  category    text not null default 'uniform',
  size        text,
  unit_price  numeric(12, 2) not null check (unit_price >= 0),
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index products_active_idx on public.products (is_active, category, name_en);

-- ---------------------------------------------------------------- sales

-- Receipt numbers are human-facing and must never be reused.
create sequence public.receipt_seq start 1;

create or replace function public.next_receipt_no()
returns text
language sql
volatile
as $fn$
  select 'R-' || to_char(now(), 'YYYY') || '-' ||
         lpad(nextval('public.receipt_seq')::text, 6, '0');
$fn$;

create table public.sales (
  id              uuid primary key default gen_random_uuid(),
  receipt_no      text not null unique default public.next_receipt_no(),
  sold_at         timestamptz not null default now(),
  customer_name   text not null,
  student_name    text,
  class_level     text,
  phone           text,
  payment_method  public.payment_method not null default 'cash',
  subtotal        numeric(12, 2) not null check (subtotal >= 0),
  discount        numeric(12, 2) not null default 0 check (discount >= 0),
  total           numeric(12, 2) not null check (total >= 0),
  notes           text,
  signature_url   text,
  seller_id       uuid not null references public.profiles (id),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint sales_discount_within_subtotal check (discount <= subtotal),
  constraint sales_total_matches check (total = subtotal - discount)
);

create index sales_sold_at_idx on public.sales (sold_at desc);
create index sales_seller_idx on public.sales (seller_id, sold_at desc);

create table public.sale_items (
  id          uuid primary key default gen_random_uuid(),
  sale_id     uuid not null references public.sales (id) on delete cascade,
  product_id  uuid references public.products (id) on delete restrict,
  -- Denormalised on purpose: a receipt must still read correctly after the
  -- catalogue changes price or wording.
  description text not null,
  size        text,
  unit_price  numeric(12, 2) not null check (unit_price >= 0),
  quantity    integer not null check (quantity > 0),
  line_total  numeric(12, 2) not null check (line_total >= 0),
  created_at  timestamptz not null default now(),
  constraint sale_items_line_total_matches check (line_total = unit_price * quantity)
);

create index sale_items_sale_idx on public.sale_items (sale_id);

-- ---------------------------------------------------------------- updated_at

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $fn$
begin
  new.updated_at = now();
  return new;
end;
$fn$;

create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();
create trigger products_touch before update on public.products
  for each row execute function public.touch_updated_at();
create trigger sales_touch before update on public.sales
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------- rls

alter table public.profiles   enable row level security;
alter table public.products   enable row level security;
alter table public.sales      enable row level security;
alter table public.sale_items enable row level security;
