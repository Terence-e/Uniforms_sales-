-- Phase 2: stock levels and movement history.

create type public.stock_movement_kind as enum (
  'intake',      -- new delivery from supplier
  'sale',        -- deducted when a sale is recorded
  'return',      -- customer returned an item
  'adjustment'   -- stocktake correction, damage, loss
);

create table public.stock_levels (
  product_id    uuid primary key references public.products (id) on delete cascade,
  quantity      integer not null default 0,
  reorder_level integer not null default 0 check (reorder_level >= 0),
  updated_at    timestamptz not null default now()
);

create table public.stock_movements (
  id           uuid primary key default gen_random_uuid(),
  product_id   uuid not null references public.products (id) on delete restrict,
  kind         public.stock_movement_kind not null,
  -- Signed: positive adds to stock, negative removes. Never zero.
  quantity     integer not null check (quantity <> 0),
  sale_id      uuid references public.sales (id) on delete set null,
  note         text,
  created_by   uuid not null references public.profiles (id),
  created_at   timestamptz not null default now()
);

create index stock_movements_product_idx on public.stock_movements (product_id, created_at desc);

-- Movements are the ledger; stock_levels is the running balance.
create or replace function public.apply_stock_movement()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
begin
  insert into public.stock_levels (product_id, quantity)
  values (new.product_id, new.quantity)
  on conflict (product_id) do update
    set quantity = public.stock_levels.quantity + excluded.quantity,
        updated_at = now();
  return new;
end;
$fn$;

create trigger stock_movements_apply
  after insert on public.stock_movements
  for each row execute function public.apply_stock_movement();

create trigger stock_levels_touch before update on public.stock_levels
  for each row execute function public.touch_updated_at();

alter table public.stock_levels    enable row level security;
alter table public.stock_movements enable row level security;
