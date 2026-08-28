-- Rollback of 20260101000300_profile_avatar.sql. Manual (see the rollback header
-- in rollback/20260101000000_init_down.sql).

alter table public.profiles drop column if exists avatar_url;
