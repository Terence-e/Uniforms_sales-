-- The return policy engine (A-FR-8.7 to A-FR-8.11).
--
-- #38 recorded returns. This decides whether they were within policy -- and
-- then lets them happen anyway. That is the whole design: the policy is
-- enforced by visibility, not by refusal (A-FR-8.11). Blocking Mr. Ateba over a
-- manufacturing defect would push the transaction off the system and back onto
-- paper, which is the outcome that costs the school most. So nothing here ever
-- rejects a return. It records what the rule said and who set it aside.

-- ------------------------------------------------------------------ settings
--
-- One row per (kind, condition), rather than four named columns or four keys in
-- a generic settings bag.
--
-- Four columns would need renaming every time a kind or condition is added; a
-- generic key/value bag gives up the type. A row per combination keeps
-- window_days a real integer with a real constraint, and makes the primary key
-- say exactly what the spec's table says.
create table public.return_policy (
  kind        public.return_kind not null,
  condition   public.garment_condition not null,

  -- NULL means never within policy -- deliberately distinct from 0, which would
  -- mean "same day only". The spec's fourth cell is "Not permitted", and that
  -- is a different statement from a zero-length window.
  --
  -- It still does not block. A worn refund is simply always an override, which
  -- is precisely the visibility A-FR-8.12 asks for.
  window_days integer check (window_days is null or window_days >= 0),

  updated_at  timestamptz not null default now(),
  updated_by  uuid references public.profiles (id),

  primary key (kind, condition)
);

-- The school's stated rule for the two exchange windows. The one-month refund
-- window and the no-refund-on-worn rule are proposed defaults pending
-- confirmation (A-17) -- which is exactly why they are seeded here as data the
-- Super Admin can change, rather than written into a query somewhere.
insert into public.return_policy (kind, condition, window_days) values
  ('exchange', 'unworn', 90),   -- 3 months, the school's rule
  ('exchange', 'worn',    7),   -- 1 week, the school's rule
  ('return',   'unworn', 30),   -- 1 month, proposed default
  ('return',   'worn',  null);  -- not permitted, proposed default

create trigger return_policy_touch before update on public.return_policy
  for each row execute function public.touch_updated_at();

-- Exactly these four rows. Deleting one would make the verdict for that
-- combination unanswerable, and inserting a fifth would mean a kind or
-- condition the enum does not have.
create or replace function public.guard_return_policy_rows()
returns trigger
language plpgsql
as $fn$
begin
  raise exception 'The return policy has one row per kind and condition. Change window_days instead.';
end;
$fn$;

create trigger return_policy_no_insert_delete
  before insert or delete on public.return_policy
  for each row execute function public.guard_return_policy_rows();

-- --------------------------------------------------------------- the verdict
--
-- One function, used by the screen that shows the verdict before anything is
-- entered (A-FR-8.10) and by record_return() when it stamps the row. Two
-- implementations of a rule are two chances for the warning and the record to
-- disagree about what happened.
--
-- Elapsed time runs from the original sale, always (A-FR-8.13). Swapping a
-- garment does not restart the clock, or a garment could be exchanged for ever.
create or replace function public.return_policy_verdict(
  p_sold_at   timestamptz,
  p_kind      public.return_kind,
  p_condition public.garment_condition
)
returns table (elapsed_days integer, window_days integer, within_policy boolean)
language sql
stable
security definer
set search_path = public, pg_temp
as $fn$
  select
    -- Whole days since the sale. floor, not round: a garment sold 47.9 days ago
    -- is 47 days old, and rounding up would put a sale outside a window it is
    -- still inside.
    floor(extract(epoch from (now() - p_sold_at)) / 86400)::integer,
    rp.window_days,
    -- NULL window is never within policy. A NULL comparison would make this
    -- NULL, which reads as "unknown" and would let the caller treat it as
    -- neither in nor out.
    case
      when rp.window_days is null then false
      else floor(extract(epoch from (now() - p_sold_at)) / 86400)::integer <= rp.window_days
    end
  from public.return_policy rp
  where rp.kind = p_kind
    and rp.condition = p_condition;
$fn$;

-- ------------------------------------------------------- stamped on the return
--
-- The verdict is stored, not recomputed later. The windows are editable, so a
-- return judged in-policy today would silently become an override the moment
-- the Super Admin shortens a window -- and the audit trail would rewrite itself
-- retroactively. What was true when the decision was made is what gets kept.
alter table public.returns
  add column elapsed_days       integer,
  add column policy_window_days integer,
  add column within_policy      boolean,
  -- Separate from `reason`, which every return already requires. Reusing it
  -- would make an override indistinguishable from an ordinary explanation, and
  -- A-FR-8.12 needs to count exactly the overrides.
  add column override_reason    text;

-- NOT VALID: the returns recorded before this migration have no verdict, and
-- inventing one would be a guess stored as fact. Binds every future write.
alter table public.returns
  add constraint returns_override_needs_reason check (
    within_policy is not false
    or (override_reason is not null and length(btrim(override_reason)) >= 3)
  ) not valid;

create index returns_within_policy_idx
  on public.returns (within_policy, returned_at desc)
  where within_policy is false;

alter table public.return_policy enable row level security;
