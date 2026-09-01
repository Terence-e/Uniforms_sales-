-- Down for 20260101003100_return_policy.sql.
--
-- Run 20260101003200_record_return_policy_down.sql FIRST: record_return()
-- calls return_policy_verdict() and will block the drop.

alter table public.returns
  drop constraint if exists returns_override_needs_reason;

drop index if exists public.returns_within_policy_idx;

alter table public.returns
  drop column if exists override_reason,
  drop column if exists within_policy,
  drop column if exists policy_window_days,
  drop column if exists elapsed_days;

drop function if exists public.return_policy_verdict(
  timestamptz, public.return_kind, public.garment_condition
);

drop trigger if exists return_policy_no_insert_delete on public.return_policy;
drop trigger if exists return_policy_touch on public.return_policy;
drop function if exists public.guard_return_policy_rows();

drop table if exists public.return_policy;
