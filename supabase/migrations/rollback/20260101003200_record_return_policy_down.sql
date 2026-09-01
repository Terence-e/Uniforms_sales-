-- Down for 20260101003200_record_return_policy.sql.
--
-- Restores the pre-policy signature by re-running the original definition from
-- 20260101002900. Run 20260101003100_return_policy_down.sql AFTER this one:
-- this function references return_policy_verdict, which that migration drops.

drop function if exists public.record_return(
  uuid, public.return_kind, text, public.garment_condition, jsonb, jsonb,
  public.payment_method, public.payment_method, uuid, text, text, text
);

-- Re-apply 20260101002900_record_return.sql by hand to restore the previous
-- signature. It is not duplicated here: two copies of a 260-line function drift
-- apart, and the migration that owns it is the honest source.
