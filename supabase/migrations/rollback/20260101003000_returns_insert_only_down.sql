-- Down for 20260101003000_returns_insert_only.sql.
--
-- Restores the grants to what the default privileges would have given. RLS
-- still refuses the edit -- neither table has an UPDATE or DELETE policy -- so
-- this reopens the privilege, not the ability.

grant update, delete on public.returns      to authenticated;
grant update, delete on public.return_items to authenticated;
