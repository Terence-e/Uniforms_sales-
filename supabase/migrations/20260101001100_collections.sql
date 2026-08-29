-- Collection (A-FR-9.7, A-FR-9.8).
--
-- Collection is the moment the garment physically leaves the shop, and
-- therefore the only moment stock decreases. Placing the order did not move
-- stock (see 20260101000800) because nothing had left; here, something has.
--
-- The event is its own document: a COL reference that also carries the ORD it
-- closes, so a slip in a parent's hand leads back to the order and an order
-- leads forward to every slip issued against it.
--
-- Collection is per line and per visit. A parent may take two shirts today and
-- come back for the blazer on Friday: that is two collections against one
-- order, each with its own COL number, its own date and its own collector. A
-- single "collected" flag on the order could not describe that, which is the
-- same reason status moved to the line in 20260101000900.

-- The four existing kinds describe a shop where goods leave at the till. They
-- do not describe goods leaving against an order placed weeks earlier, and
-- reusing 'sale' would make the two indistinguishable in any stock report.
--
-- Postgres can add an enum value but never remove one, so this is a one-way
-- door -- the same reason order_status shipped complete in 20260101000800.
alter type public.stock_movement_kind add value if not exists 'collection';

-- ---------------------------------------------------------------- collections

create table public.collections (
  id              uuid primary key default gen_random_uuid(),
  col_no          text not null unique default public.next_reference('COL'),
  order_id        uuid not null references public.orders (id) on delete restrict,
  collected_at    timestamptz not null default now(),
  -- Free text, and deliberately not a link to anything: the person at the
  -- counter is often an aunt, an elder sibling or a driver, not the parent who
  -- placed the order (A-FR-9.7).
  collector_name  text not null check (length(btrim(collector_name)) > 0),
  -- The member of staff who physically handed the garments over. Usually the
  -- person recording it, but not always, which is why it is a separate column
  -- from created_by rather than an assumption.
  handed_over_by  uuid not null references public.profiles (id),
  created_by      uuid not null references public.profiles (id),
  created_at      timestamptz not null default now()
);

create index collections_order_idx on public.collections (order_id, collected_at desc);

create table public.collection_items (
  id             uuid primary key default gen_random_uuid(),
  collection_id  uuid not null references public.collections (id) on delete cascade,
  -- Unique: a line leaves the shop once. Without this a second slip could claim
  -- the same garment, and stock would be deducted twice for one item.
  order_item_id  uuid not null unique references public.order_items (id) on delete restrict,
  created_at     timestamptz not null default now()
);

create index collection_items_collection_idx
  on public.collection_items (collection_id);

-- A stock movement caused by a collection needs to say so. Until now the only
-- traceable cause was sale_id, so an order-driven deduction would have pointed
-- at nothing.
alter table public.stock_movements
  add column collection_id uuid references public.collections (id) on delete set null;

alter table public.collections enable row level security;
alter table public.collection_items enable row level security;
