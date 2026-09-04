-- Configurable size set (Phase 1 change: sizes leave the product).
--
-- A product used to be a garment PLUS a size. It is now just the garment; the
-- size is chosen at the point of sale, order or exchange from a set the Super
-- Admin defines here. A-FR-4.2 always asked for this to be a data change rather
-- than a code change -- "the school has not finally confirmed whether sizes will
-- be numeric, letter-based or measurement-based" -- and this is that data.
--
-- Two shapes, one row:
--   letters  -- an explicit, ordered list: S, M, L, XL (or 6e, 5e, ...).
--   metrics  -- a numeric range with a step: 20..46 by 2 -> 20,22,...,46.
--
-- The picker at the counter also allows a free-typed custom size, so a one-off
-- never needs a settings change; this table is only the predefined set that
-- shows as boxes.

create type public.size_mode as enum ('letters', 'metrics');

-- Single-row table: the `id boolean primary key default true check (id)` trick
-- makes exactly one row possible -- a second insert collides on the primary
-- key, and the check keeps it from being flipped to a second value. The whole
-- shop shares one size set, so a table that can hold two configurations is a
-- table that can disagree with itself.
create table public.app_size_config (
  id          boolean primary key default true check (id),
  mode        public.size_mode not null default 'metrics',

  -- Used when mode = 'letters'. Ordered as entered: sizes are not sortable in
  -- general (S < M < L is not lexical, and 'XL' is not after 'L' alphabetically),
  -- so the array order IS the display order.
  letters     text[] not null default '{}',

  -- Used when mode = 'metrics'. The boxes are min, min+step, ... up to max.
  metric_min  integer not null default 20,
  metric_max  integer not null default 46,
  metric_step integer not null default 2 check (metric_step >= 1),

  updated_at  timestamptz not null default now(),
  updated_by  uuid references public.profiles (id),

  constraint size_metric_range  check (metric_min <= metric_max),
  constraint size_metric_bounds check (metric_min >= 0),
  -- Whichever mode is active must actually describe a set. An empty letter list
  -- in letters mode would render no boxes at all.
  constraint size_letters_present check (mode <> 'letters' or array_length(letters, 1) >= 1)
);

comment on table public.app_size_config is
  'Single-row size set shown as boxes at sale / order / exchange (A-FR-4.2).';

create trigger app_size_config_touch before update on public.app_size_config
  for each row execute function public.touch_updated_at();

-- The seed matches the school's working assumption: numeric 20-46. Letters stay
-- empty until someone switches mode and fills them in.
insert into public.app_size_config (id) values (true);

-- RLS on; policies live in supabase/policies/14_size_config.sql (read for all,
-- write for the Super Admin only, exactly like the return policy).
alter table public.app_size_config enable row level security;
