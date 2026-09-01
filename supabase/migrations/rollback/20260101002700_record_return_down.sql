-- Down for 20260101002700_record_return.sql.

drop function if exists public.record_return(
  uuid, public.return_kind, text, public.garment_condition, jsonb, jsonb,
  public.payment_method, public.payment_method, uuid, text, text
);
