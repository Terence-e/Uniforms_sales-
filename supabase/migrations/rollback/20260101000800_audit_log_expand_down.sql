-- Rollback of 20260101000800_audit_log_expand.sql. Manual (see the header in
-- rollback/20260101000000_init_down.sql).

drop trigger if exists audit_log_no_update on public.audit_log;
drop trigger if exists audit_log_no_delete on public.audit_log;
drop function if exists public.audit_log_reject_change();

drop index if exists public.audit_log_actor_idx;

alter table public.audit_log
  drop column if exists actor_name,
  drop column if exists target_table,
  drop column if exists target_id,
  drop column if exists previous_value,
  drop column if exists new_value;

-- Note: the actor_id -> profiles FK is not recreated here; existing rows may now
-- reference deleted users, which a re-added FK would reject.
