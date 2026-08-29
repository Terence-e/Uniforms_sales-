-- Audit log (spec A-11). Append-only: no update/delete policy is ever granted,
-- for any role including Super Admin (A-FR-11.3). Readable by every role
-- (A-FR-11.4). Rows are written server-side with the service role -- including
-- for signed-out events like failed logins, which have no actor.

create table public.audit_log (
  id          uuid primary key default gen_random_uuid(),
  actor_id    uuid references public.profiles (id) on delete set null,
  action      text not null,          -- e.g. login_failed, login_blocked, login_success
  entity      text,                   -- optional target descriptor
  ip          text,                   -- best-effort client IP
  meta        jsonb not null default '{}',
  created_at  timestamptz not null default now()
);

create index audit_log_created_idx on public.audit_log (created_at desc);
create index audit_log_action_created_idx on public.audit_log (action, created_at desc);

alter table public.audit_log enable row level security;
