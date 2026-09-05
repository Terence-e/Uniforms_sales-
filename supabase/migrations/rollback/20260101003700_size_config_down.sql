-- Down for 20260101003700_size_config.sql.
--
-- Drop the policies first (they live in supabase/policies/14_size_config.sql and
-- are applied out-of-band), then the table, then the enum. The enum can only be
-- dropped once nothing references it, which is why the table goes first.

drop policy if exists "size_config_select_all" on public.app_size_config;
drop policy if exists "size_config_update_super_admin" on public.app_size_config;

drop trigger if exists app_size_config_touch on public.app_size_config;
drop table if exists public.app_size_config;

drop type if exists public.size_mode;
