-- Orders (A-FR-9.1, A-FR-9.2, A-FR-9.3).
--
-- An order is what happens when a parent pays for a garment the shop cannot
-- hand over today -- the size is not made yet, or it is out of stock. Money is
-- taken in full at placement; the goods follow later.
--
-- The defining rule, and the reason orders are not just a flag on `sales`:
-- placing an order MUST NOT move stock. Nothing physically left the shop. The
-- stock movement belongs to the collection event (A-FR-9.7), which is why no
-- trigger here touches stock_levels or stock_movements.
--
-- Structurally an order mirrors a sale -- same customer block, same payment
-- method, same denormalised line items -- plus the three things a walk-in sale
-- has no use for: a status, an expected-ready date, and the tailor's
-- measurements.

-- ---------------------------------------------------------------- status

-- The full lifecycle is declared here even though this migration only ever
-- writes 'ordered'. Postgres cannot drop a value from an enum once it is
-- committed, so adding the rest later would mean recreating the type and
-- rewriting every dependent column. Declaring it once, now, is far cheaper --
-- the status workflow and the collection flow then need no schema change.
create type public.order_status as enum (
  'ordered',
  'in_production',
  'ready',
  'collected',
  'cancelled'
);

-- ---------------------------------------------------------------- references

-- Per-type, per-year sequential references (A-FR-9.2, and the numbering rule in
-- the spec): ORD-2026-000001, restarting at 000001 each January.
--
-- A plain sequence cannot do this. `next_receipt_no()` uses one, and as a
-- result R-2026-000123 rolls into R-2027-000124 rather than restarting -- the
-- year in that string is decorative. Here the counter is keyed by (prefix,
-- year), so a new year starts a new row at 1 and each document type counts
-- independently.
create table public.reference_counters (
  prefix     text    not null,
  year       integer not null,
  last_value bigint  not null default 0 check (last_value >= 0),
  primary key (prefix, year)
);

alter table public.reference_counters enable row level security;

-- security definer so an authenticated seller can burn a number without being
-- granted write access to the counter table itself -- the only way to touch it
-- is through this function, which hands back one number and nothing else.
--
-- The upsert takes a row lock on (prefix, year) for the duration of the
-- transaction, so two tills submitting at the same instant serialise here
-- rather than racing: no duplicates, no gaps.
create or replace function public.next_reference(p_prefix text)
returns text
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_year integer := extract(year from now())::integer;
  v_next bigint;
begin
  insert into public.reference_counters as rc (prefix, year, last_value)
  values (p_prefix, v_year, 1)
  on conflict (prefix, year)
    do update set last_value = rc.last_value + 1
  returning rc.last_value into v_next;

  return p_prefix || '-' || v_year::text || '-' || lpad(v_next::text, 6, '0');
end;
$fn$;

revoke all on function public.next_reference(text) from public;
grant execute on function public.next_reference(text) to authenticated;

-- ---------------------------------------------------------------- orders

create table public.orders (
  id                  uuid primary key default gen_random_uuid(),
  order_no            text not null unique default public.next_reference('ORD'),
  ordered_at          timestamptz not null default now(),
  -- When the shop expects the garment to be ready. Nullable: the tailor cannot
  -- always commit to a date at the counter.
  expected_ready_date date,
  status              public.order_status not null default 'ordered',
  customer_name       text not null,
  student_name        text,
  class_level         text,
  phone               text,
  payment_method      public.payment_method not null default 'cash',
  subtotal            numeric(12, 2) not null check (subtotal >= 0),
  discount            numeric(12, 2) not null default 0 check (discount >= 0),
  total               numeric(12, 2) not null check (total >= 0),
  -- Free text for the tailor: chest, waist, sleeve, "leave 2cm at the hem".
  measurements        text,
  notes               text,
  seller_id           uuid not null references public.profiles (id),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  constraint orders_discount_within_subtotal check (discount <= subtotal),
  constraint orders_total_matches check (total = subtotal - discount)
);

create index orders_ordered_at_idx on public.orders (ordered_at desc);
create index orders_seller_idx on public.orders (seller_id, ordered_at desc);
-- The open-jobs list reads "everything not yet finished, oldest first".
create index orders_status_idx on public.orders (status, ordered_at);

create table public.order_items (
  id          uuid primary key default gen_random_uuid(),
  order_id    uuid not null references public.orders (id) on delete cascade,
  product_id  uuid references public.products (id) on delete restrict,
  -- Denormalised for the same reason as sale_items: the slip printed at
  -- collection must show what was actually agreed and charged, months later,
  -- whatever the catalogue says by then.
  description text not null,
  size        text,
  unit_price  numeric(12, 2) not null check (unit_price >= 0),
  quantity    integer not null check (quantity > 0),
  line_total  numeric(12, 2) not null check (line_total >= 0),
  created_at  timestamptz not null default now(),
  constraint order_items_line_total_matches check (line_total = unit_price * quantity)
);

create index order_items_order_idx on public.order_items (order_id);

create trigger orders_touch before update on public.orders
  for each row execute function public.touch_updated_at();

-- RLS on, policies deliberately absent -- they live in supabase/policies/ and
-- are applied separately. See supabase/README.md.
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
