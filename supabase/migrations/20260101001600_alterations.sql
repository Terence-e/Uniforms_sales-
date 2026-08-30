-- Alterations (A-FR-9.12, A-FR-9.13, A-FR-9.14, A-FR-9.15).
--
-- A parent brings in a garment THEY ALREADY OWN to be resized or repaired. The
-- school holds it, does the work, and gives it back.
--
-- The defining constraint is the mirror image of collection: because the
-- garment belongs to the parent, no step of this workflow may touch stock. It
-- never entered inventory, so it can never leave it. There is deliberately no
-- product_id on this table and nothing anywhere in the alteration code writes
-- stock_movements -- if you are adding a stock write here, the requirement says
-- you are wrong.
--
-- Tracked as an open job alongside orders, but with its own vocabulary. A
-- garment is RECEIVED from its owner and RETURNED to them; it was never
-- ordered and is never collected. Reusing order_status would print the wrong
-- noun on every alteration.

create type public.alteration_status as enum (
  'received',
  'in_progress',
  'ready',
  'returned',
  'cancelled'
);

create table public.alterations (
  id                  uuid primary key default gen_random_uuid(),
  -- Same per-year counter as ORD and COL: ALT-2026-000001, restarting each
  -- January. This doubles as the deposit slip's reference -- intake happens
  -- exactly once, unlike collection which can repeat, so a separate slip table
  -- would hold precisely one row per alteration and buy nothing.
  alteration_no       text not null unique default public.next_reference('ALT'),
  received_at         timestamptz not null default now(),
  expected_ready_date date,
  status              public.alteration_status not null default 'received',
  -- The reason behind the current status when one was required. History lives
  -- in audit_log; this exists so the trigger can insist a reason was supplied.
  status_reason       text,

  -- The parent is the customer; the student is who the garment is for. Both
  -- are searchable from the open-jobs list.
  customer_name       text not null check (length(btrim(customer_name)) > 0),
  student_name        text,
  class_level         text,
  phone               text,

  -- What was handed over. Free text and no product reference on purpose: this
  -- garment is not a catalogue item, it is one specific object belonging to one
  -- specific family, possibly bought years ago or somewhere else entirely.
  garment             text not null check (length(btrim(garment)) > 0),
  size                text,
  -- Mandatory (A-FR-9.12): a garment held with no record of what was asked for
  -- is a dispute waiting to happen.
  work_required       text not null check (length(btrim(work_required)) > 0),

  -- Zero when the school does the work for free, which happens.
  charge              numeric(12, 2) not null default 0 check (charge >= 0),
  payment_method      public.payment_method,
  -- Nullable on purpose, and it is the payment TIMING that this records rather
  -- than the schema assuming one. Some shops take the money at intake, some on
  -- return; both are recordable here, and the deposit slip prints "paid" or
  -- "due on return" from whether this is set.
  paid_at             timestamptz,

  notes               text,
  received_by         uuid not null references public.profiles (id),
  -- Stamped by the transition trigger when the garment goes back to its owner.
  returned_at         timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),

  constraint alterations_paid_needs_method check (
    paid_at is null or payment_method is not null
  ),
  -- Nothing was charged, so nothing can have been paid.
  constraint alterations_free_is_unpaid check (charge > 0 or paid_at is null)
);

create index alterations_received_idx on public.alterations (received_at desc);
create index alterations_receiver_idx on public.alterations (received_by, received_at desc);
-- The open-jobs list reads "everything not yet finished, oldest first".
create index alterations_status_idx on public.alterations (status, received_at);

create trigger alterations_touch before update on public.alterations
  for each row execute function public.touch_updated_at();

-- RLS on, policies deliberately absent -- they live in supabase/policies/ and
-- are applied separately. See supabase/README.md.
alter table public.alterations enable row level security;
