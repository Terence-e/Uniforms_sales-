-- In-app bug reports (spec A-13, Phase 1 observability).
--
-- Sentry catches crashes. This catches everything else: "the total came out
-- wrong", "the receipt printed the wrong parent name". Those never throw, so
-- no amount of error tracking will ever see them -- the only witness is the
-- person at the counter, and the only way to hear about it is to make telling
-- someone take ten seconds.
--
-- The context fields exist because a user will not think to include them and
-- should not have to. "It broke" plus the URL, the browser and a screenshot is
-- a report someone can act on; "it broke" alone is not.

create table public.bug_reports (
  id          uuid primary key default gen_random_uuid(),
  reported_at timestamptz not null default now(),

  -- Nulled rather than cascaded if the account is later removed: the report is
  -- evidence about the software, and it stays true after the reporter leaves.
  reporter_id uuid references public.profiles (id) on delete set null,
  -- Denormalised on purpose, for the same reason. Six months on, "who reported
  -- this" should still answer even if the row it pointed at is gone.
  reporter_name text,

  description text not null check (length(btrim(description)) > 0),

  -- Captured automatically at submit. The user is describing what went wrong,
  -- not filling in a support form.
  page_url    text,
  user_agent  text,

  -- A data URL, matching how avatars are stored (profiles.avatar_url): this
  -- project has no storage bucket, and adding one means a second policy surface
  -- to keep applied. Compressed client-side and capped below.
  --
  -- Screenshots are far larger than avatars, so nothing that lists reports may
  -- select this column -- see listBugReports(), which does not.
  screenshot  text check (screenshot is null or length(screenshot) <= 1500000),

  -- Maintenance works through the pile; the flag is the only mutable field.
  resolved_at timestamptz,
  resolved_by uuid references public.profiles (id) on delete set null,

  created_at  timestamptz not null default now()
);

create index bug_reports_reported_idx on public.bug_reports (reported_at desc);
-- The dashboard opens on "what is still outstanding".
create index bug_reports_open_idx on public.bug_reports (reported_at desc)
  where resolved_at is null;

-- Roles are seller / administration / maintenance / super_admin. There are
-- helpers for admin and operator, but nothing yet asks "is this the person who
-- fixes the software", which is exactly who may read these.
create or replace function public.is_maintenance()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $fn$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid())
      and p.is_active
      and p.role in ('maintenance', 'super_admin')
  );
$fn$;

-- RLS on, policies deliberately absent -- they live in supabase/policies/ and
-- are applied separately. See supabase/README.md.
alter table public.bug_reports enable row level security;
