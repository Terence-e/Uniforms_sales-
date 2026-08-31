-- Alteration status workflow (A-FR-9.13).
--
--   received -> in_progress -> ready -> returned
--
-- Deliberately identical in shape to the order workflow in
-- 20260101000900_order_line_status.sql: forward one step at a time, backwards
-- one step with a mandatory reason, cancelled reachable from any live state,
-- and returned/cancelled terminal. Two job workflows in one app with different
-- strictness would be a trap for whoever maintains them -- a seller should not
-- have to remember which kind of job lets them skip a step.
--
-- Enforced here rather than in the form, for the same reason as orders: a
-- workflow the UI alone protects is not protected, since anything holding the
-- anon key can PATCH a row directly.
--
-- Separate migration from 20260101001600 because that one adds the
-- alteration_status enum, and Postgres will not let a value added in a
-- transaction be used by that same transaction.

create or replace function public.alteration_status_rank(s public.alteration_status)
returns integer
language sql
immutable
as $fn$
  select case s
    when 'received'    then 1
    when 'in_progress' then 2
    when 'ready'       then 3
    when 'returned'    then 4
    else null                       -- cancelled is not a step along the line
  end;
$fn$;

-- security definer so the audit insert cannot be refused by RLS: the audit row
-- is not the caller's to skip.
create or replace function public.enforce_alteration_transition()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_from      public.alteration_status := old.status;
  v_to        public.alteration_status := new.status;
  v_from_rank integer;
  v_to_rank   integer;
  v_reason    text := nullif(btrim(coalesce(new.status_reason, '')), '');
  -- The reason must belong to THIS move. Without this an UPDATE touching only
  -- `status` inherits whatever reason an earlier transition left behind, and
  -- the audit row then records an explanation from a different event. Same
  -- lesson as 20260101001000.
  v_fresh     boolean := new.status_reason is distinct from old.status_reason;
begin
  if v_to is not distinct from v_from then
    return new;
  end if;

  if v_from = 'returned' then
    raise exception 'A returned garment cannot change status -- it is back with its owner';
  end if;
  if v_from = 'cancelled' then
    raise exception 'A cancelled alteration cannot change status';
  end if;

  if v_to = 'cancelled' then
    if v_reason is null or not v_fresh then
      raise exception 'Cancelling an alteration requires a reason';
    end if;
  else
    v_from_rank := public.alteration_status_rank(v_from);
    v_to_rank   := public.alteration_status_rank(v_to);

    if v_to_rank = v_from_rank + 1 then
      if v_to = 'returned' then
        -- Stamped by the database, so it records when the handover was
        -- accepted rather than what a browser claimed.
        new.returned_at := now();
      end if;
    elsif v_to_rank = v_from_rank - 1 then
      if v_reason is null or not v_fresh then
        raise exception 'Moving an alteration backwards requires a reason';
      end if;
    else
      raise exception 'Illegal transition: % -> %', v_from, v_to;
    end if;
  end if;

  insert into public.audit_log (actor_id, action, entity, meta)
  values (
    auth.uid(),
    'alteration_status_changed',
    new.alteration_no,
    jsonb_build_object(
      'alteration_id', new.id,
      'alteration_no', new.alteration_no,
      'garment',       new.garment,
      'from',          v_from::text,
      'to',            v_to::text,
      'reason',        v_reason
    )
  );

  return new;
end;
$fn$;

create trigger alterations_enforce_transition
  before update of status on public.alterations
  for each row execute function public.enforce_alteration_transition();

-- ---------------------------------------------------------------- immutability

-- Moving the status, recording payment and correcting the expected date are the
-- only edits an operator may make. Without this, the RLS policy that lets a
-- seller progress their own alteration would equally let them rewrite the
-- charge after the parent has paid, or change what work was agreed after a
-- dispute starts -- which is exactly when that text matters most.
create or replace function public.guard_alteration_terms()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
begin
  if public.is_super_admin() then
    return new;
  end if;

  if new.alteration_no is distinct from old.alteration_no
     or new.received_at   is distinct from old.received_at
     or new.customer_name is distinct from old.customer_name
     or new.garment       is distinct from old.garment
     or new.work_required is distinct from old.work_required
     or new.charge        is distinct from old.charge
     or new.received_by   is distinct from old.received_by
     or new.created_at    is distinct from old.created_at then
    raise exception 'The agreed terms of an alteration cannot be edited -- only its status and payment';
  end if;

  return new;
end;
$fn$;

create trigger alterations_guard_terms
  before update on public.alterations
  for each row execute function public.guard_alteration_terms();
