-- Rollback of 20260101000500_audit_log.sql. Manual (see the header in
-- rollback/20260101000000_init_down.sql).

drop table if exists public.audit_log cascade;
