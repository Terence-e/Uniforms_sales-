-- Rollback of 20260101000700_active_user_count.sql. Manual (see the header in
-- rollback/20260101000000_init_down.sql).

drop function if exists public.count_active_users();
