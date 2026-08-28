-- In-app notifications, one row per recipient. Text is not stored: rows carry a
-- `type` + `data` and the UI renders the (bilingual) label, so notifications
-- respect P-5 like everything else. Created server-side (service role) only.

create table public.notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles (id) on delete cascade,
  type        text not null,
  data        jsonb not null default '{}',
  link        text,               -- internal path to the linked feature
  is_read     boolean not null default false,
  created_at  timestamptz not null default now()
);

create index notifications_user_idx
  on public.notifications (user_id, is_read, created_at desc);

alter table public.notifications enable row level security;
