-- Audit log expansion (spec A-11 / A-FR-11.2, A-FR-11.3, A-FR-11.4).
--
-- The first cut of audit_log carried only login events (actor_id, action, ip,
-- meta). A-FR-11.2 requires every entry to name a target and record the value
-- before and after; A-FR-11.4 requires the viewer to work for EVERY role,
-- including ones that cannot read public.profiles. So we:
--
--   * add the spec columns: target_table, target_id, previous_value, new_value;
--   * denormalise the actor's name onto the row (actor_name) so the log shows
--     who did what without a profiles join -- and so history is frozen: renaming
--     or deleting a user later never rewrites past entries;
--   * drop the actor_id -> profiles FK, so deleting a user can never mutate the
--     ledger (an immutable log must not be edited by a cascade elsewhere);
--   * enforce append-only at the table level with a trigger that rejects UPDATE
--     and DELETE for everyone -- service role and Super Admin included (A-FR-11.3).

alter table public.audit_log
  add column if not exists actor_name     text,
  add column if not exists target_table   text,
  add column if not exists target_id      text,
  add column if not exists previous_value jsonb,
  add column if not exists new_value      jsonb;

-- The ledger is frozen history: a deleted user must not blank out or cascade
-- into past entries. Keep actor_id as a bare uuid, with no foreign key.
alter table public.audit_log
  drop constraint if exists audit_log_actor_id_fkey;

create index if not exists audit_log_actor_idx
  on public.audit_log (actor_id, created_at desc);

-- Append-only, enforced for EVERY caller including the service role and the
-- Super Admin (A-FR-11.3). RLS already grants no update/delete to app roles;
-- this trigger closes the gap for anything that holds the service key too.
create or replace function public.audit_log_reject_change()
returns trigger
language plpgsql
as $fn$
begin
  raise exception 'audit_log is append-only: % is not permitted', tg_op
    using errcode = 'insufficient_privilege';
end;
$fn$;

drop trigger if exists audit_log_no_update on public.audit_log;
create trigger audit_log_no_update
  before update on public.audit_log
  for each row execute function public.audit_log_reject_change();

drop trigger if exists audit_log_no_delete on public.audit_log;
create trigger audit_log_no_delete
  before delete on public.audit_log
  for each row execute function public.audit_log_reject_change();
