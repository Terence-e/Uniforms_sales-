-- Profile avatar. Stored inline on the row as a (small, client-compressed) data
-- URL -- no storage bucket for this scale. Editable by the owner via the
-- existing profiles_update_self policy (role stays unchanged).

alter table public.profiles add column if not exists avatar_url text;
