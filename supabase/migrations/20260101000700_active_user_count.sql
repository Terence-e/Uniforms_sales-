-- Shared active-user count.
--
-- The dashboard shows every signed-in user the same "active users" figure, in
-- the same spirit as the shared sales ledger. A plain count over public.profiles
-- would be scoped by RLS -- a seller can only see their own row, so they would
-- read "1". This SECURITY DEFINER helper returns the true team size WITHOUT
-- exposing any profile data (names, roles, emails stay private): callers get a
-- single integer and nothing else.

create or replace function public.count_active_users()
returns integer
language sql
stable
security definer
set search_path = public
as $fn$
  select count(*)::int from public.profiles where is_active = true;
$fn$;

grant execute on function public.count_active_users() to authenticated;
