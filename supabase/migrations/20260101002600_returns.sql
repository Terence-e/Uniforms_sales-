-- Returns and exchanges (A-FR-8.1 to A-FR-8.6).
--
-- Wrong size is the commonest event in a uniform shop, and the shape of this
-- schema follows from one requirement above all others: A-FR-8.6, the original
-- sale is NEVER modified. A return is a separate transaction that points back
-- at the sale, so both stay visible in history and the sale keeps saying what
-- it always said.
--
-- Return and exchange are one table, not two. A return is an exchange with
-- nothing going the other way, and splitting them would duplicate the reason,
-- the refund method, the reference counter, the stock handling and the receipt
-- to no benefit. What differs is direction, and direction is a column.

-- --------------------------------------------------------------------- types

create type public.return_kind as enum (
  'return',   -- garment comes back, nothing goes out
  'exchange'  -- garment comes back, a different one goes out
);

-- Declared by the seller, never assessed by the system (A-FR-8.9). Recorded
-- exactly the way a payment method is recorded: as what someone said.
--
-- Added now although the policy windows that read it are a separate issue. It
-- is one column, and adding it later means altering a table with rows in it and
-- inventing a value for every one of them.
create type public.garment_condition as enum ('unworn', 'worn');

-- Which side of the counter a line moves. 'in' is what the parent hands back,
-- 'out' is what they take away.
create type public.return_direction as enum ('in', 'out');

-- The outgoing half of an exchange leaves stock, but it is not a sale and must
-- not be counted as one in the daily takings -- no money changed hands for that
-- garment, only for the difference.
alter type public.stock_movement_kind add value if not exists 'exchange';

-- --------------------------------------------------------------------- table

create table public.returns (
  id              uuid primary key default gen_random_uuid(),
  -- RTN-2026-000001. Its own series, so a return is never mistaken for a sale
  -- at a glance (A-FR-8.4).
  return_no       text not null unique default public.next_reference('RTN'),
  kind            public.return_kind not null,

  -- A-FR-8.3: every return references the original sale. `restrict` rather than
  -- `cascade` because deleting a sale that has been returned against would
  -- destroy the other half of the audit trail.
  sale_id         uuid not null references public.sales (id) on delete restrict,

  -- A-FR-8.3: mandatory, and long enough to be a reason rather than a shrug.
  reason          text not null,
  condition       public.garment_condition not null,

  -- What the parent gets back, and how (A-FR-8.5). The refund method is
  -- deliberately independent of the sale's payment method: a MoMo sale may be
  -- refunded in cash, and the daily report needs both.
  refund_amount   numeric(12, 2) not null default 0 check (refund_amount >= 0),
  refund_method   public.payment_method,

  -- What the parent pays when the new garment costs more, and how. Any method,
  -- like an ordinary sale.
  collected_amount  numeric(12, 2) not null default 0 check (collected_amount >= 0),
  collected_method  public.payment_method,

  returned_at     timestamptz not null default now(),
  notes           text,
  signature_url   text,

  -- Same split as sales (A-FR-7.9): who typed it is not necessarily who handled
  -- the money.
  seller_id       uuid not null references public.profiles (id),
  recorded_by     uuid references public.profiles (id),
  received_by     uuid references public.profiles (id),

  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  -- Money only ever moves one way. Both non-zero would mean the difference was
  -- computed twice, in opposite directions.
  constraint returns_one_direction check (
    refund_amount = 0 or collected_amount = 0
  ),
  -- An amount without a method is money that cannot be reconciled.
  constraint returns_refund_needs_method check (
    refund_amount = 0 or refund_method is not null
  ),
  constraint returns_collected_needs_method check (
    collected_amount = 0 or collected_method is not null
  ),
  -- A plain return never hands anything over, so it can never collect.
  constraint returns_plain_return_collects_nothing check (
    kind = 'exchange' or collected_amount = 0
  ),
  constraint returns_reason_meaningful check (length(btrim(reason)) >= 3)
);

create index returns_sale_idx on public.returns (sale_id);
create index returns_returned_at_idx on public.returns (returned_at desc);

create table public.return_items (
  id            uuid primary key default gen_random_uuid(),
  return_id     uuid not null references public.returns (id) on delete cascade,
  direction     public.return_direction not null,

  -- Which line of the original sale this gives back. Required on the way in and
  -- forbidden on the way out: you can only return something that was sold, and
  -- what you take away is a fresh catalogue pick, not a line of the old sale.
  sale_item_id  uuid references public.sale_items (id) on delete restrict,

  product_id    uuid not null references public.products (id) on delete restrict,
  description   text not null,
  size          text,
  unit_price    numeric(12, 2) not null check (unit_price >= 0),
  quantity      integer not null check (quantity > 0),
  line_total    numeric(12, 2) not null check (line_total >= 0),

  constraint return_items_in_needs_sale_line check (
    (direction = 'in' and sale_item_id is not null)
    or (direction = 'out' and sale_item_id is null)
  ),
  constraint return_items_total_matches check (
    line_total = unit_price * quantity
  )
);

create index return_items_return_idx on public.return_items (return_id);
create index return_items_sale_item_idx on public.return_items (sale_item_id);

-- Links a stock movement to the return that caused it, the way sale_id already
-- links one to its sale. Without this a returned garment's movement row has no
-- explanation attached to it.
alter table public.stock_movements
  add column return_id uuid references public.returns (id) on delete set null;

create trigger returns_touch before update on public.returns
  for each row execute function public.touch_updated_at();

-- ------------------------------------------------------- the sale is frozen
--
-- A-FR-8.6 says the original sale is never modified. Enforced here rather than
-- by convention, because the acceptance criterion is about what the data says
-- afterwards -- and a direct PostgREST update with a seller's own token never
-- passes through any Server Action that could check it.
--
-- Only the money and the identity of the sale are frozen. Notes stay editable:
-- nothing in the spec forbids correcting a spelling, and freezing everything
-- would make the row unmaintainable for no gain.
create or replace function public.guard_sale_immutable()
returns trigger
language plpgsql
as $fn$
begin
  if new.receipt_no    is distinct from old.receipt_no
     or new.subtotal   is distinct from old.subtotal
     or new.discount   is distinct from old.discount
     or new.total      is distinct from old.total
     or new.payment_method is distinct from old.payment_method
     or new.sold_at    is distinct from old.sold_at
     or new.seller_id  is distinct from old.seller_id
  then
    raise exception
      'A sale cannot be altered once recorded. Record a return or exchange against it instead.';
  end if;
  return new;
end;
$fn$;

create trigger sales_guard_immutable
  before update on public.sales
  for each row execute function public.guard_sale_immutable();

-- --------------------------------------------- you cannot give back more than you bought
--
-- Without this, a return refunds money for goods that were never sold -- either
-- by returning a quantity larger than the sale line, or by returning the same
-- line twice across two separate returns.
--
-- security definer so the check still runs for a caller who may insert a return
-- line but cannot read every sale line.
create or replace function public.enforce_returnable_quantity()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_sold      integer;
  v_sale_id   uuid;
  v_returned  integer;
  v_this_sale uuid;
begin
  if new.direction <> 'in' then
    return new;
  end if;

  select si.quantity, si.sale_id into v_sold, v_sale_id
  from public.sale_items si
  where si.id = new.sale_item_id;

  if v_sold is null then
    raise exception 'That sale line does not exist';
  end if;

  -- The line has to belong to the sale this return is against, or a return
  -- could quietly refund against someone else's purchase.
  select r.sale_id into v_this_sale
  from public.returns r
  where r.id = new.return_id;

  if v_this_sale is distinct from v_sale_id then
    raise exception 'That line belongs to a different sale';
  end if;

  -- Everything already given back against this line, in any earlier return.
  select coalesce(sum(ri.quantity), 0) into v_returned
  from public.return_items ri
  where ri.sale_item_id = new.sale_item_id
    and ri.direction = 'in'
    and ri.id is distinct from new.id;

  if v_returned + new.quantity > v_sold then
    raise exception
      'Only % of that item remain returnable (% sold, % already returned).',
      v_sold - v_returned, v_sold, v_returned;
  end if;

  return new;
end;
$fn$;

create trigger return_items_enforce_returnable
  before insert or update on public.return_items
  for each row execute function public.enforce_returnable_quantity();

-- ----------------------------------------------------------------- RLS

alter table public.returns      enable row level security;
alter table public.return_items enable row level security;
