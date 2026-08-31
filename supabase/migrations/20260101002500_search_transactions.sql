-- Unified search across sales, orders and alterations (A-FR-7.6).
--
-- "Most parents arrive without their paper receipt", so the reference number is
-- the least likely thing anyone will have. One box takes a reference, a
-- student's name, a parent's name or a phone number and finds the transaction
-- whichever of the three it is.
--
-- A single function rather than three queries merged in the application,
-- because the issue asks for pagination: merging in JavaScript would mean
-- fetching every matching row from all three tables in order to sort and count
-- them, which is precisely what pagination exists to avoid.
--
-- SECURITY INVOKER -- the default, and load-bearing here. The search runs as
-- the caller, so RLS decides what it can see: a seller finds their own
-- transactions and an oversight role finds everything, with no permission
-- logic repeated in this function.

create or replace function public.search_transactions(
  p_term   text,
  p_kinds  text[]    default null,   -- null = all three
  p_stage  text      default null,   -- waiting | in_progress | ready
  p_from   date      default null,
  p_to     date      default null,
  p_limit  integer   default 20,
  p_offset integer   default 0
)
returns table (
  kind          text,
  id            uuid,
  reference     text,
  occurred_at   timestamptz,
  customer_name text,
  student_name  text,
  phone         text,
  status        text,
  amount        numeric,
  match_rank    integer,
  total_count   bigint
)
language sql
stable
set search_path = public, extensions, pg_temp
as $fn$
with
  -- Digits only, so "+237 6 77 00 00 00" finds "677000000". Nobody types a
  -- Cameroonian number the same way twice.
  needle as (
    select
      nullif(btrim(coalesce(p_term, '')), '')                as raw,
      unaccent(lower(btrim(coalesce(p_term, ''))))           as folded,
      nullif(regexp_replace(coalesce(p_term, ''), '\D', '', 'g'), '') as digits
  ),

  rows as (
    -- ------------------------------------------------------------- sales
    select
      'sale'::text                                   as kind,
      s.id,
      s.receipt_no                                   as reference,
      s.sold_at                                      as occurred_at,
      s.customer_name,
      s.student_name,
      s.phone,
      null::text                                     as status,
      s.total                                        as amount,
      -- A reference match beats a name match: typing a receipt number means
      -- you want that record, not everything that mentions it.
      case when n.raw is not null and s.receipt_no ilike '%' || n.raw || '%'
           then 0 else 1 end                         as match_rank
    from public.sales s cross join needle n
    where (p_kinds is null or 'sale' = any (p_kinds))
      and (p_from is null or s.sold_at >= p_from)
      and (p_to   is null or s.sold_at < (p_to + 1))
      -- A sale has no status, so a stage filter can only exclude it.
      and p_stage is null
      and (
        n.raw is null
        or s.receipt_no ilike '%' || n.raw || '%'
        or unaccent(lower(s.customer_name)) like '%' || n.folded || '%'
        or unaccent(lower(coalesce(s.student_name, ''))) like '%' || n.folded || '%'
        or (n.digits is not null
            and regexp_replace(coalesce(s.phone, ''), '\D', '', 'g') like '%' || n.digits || '%')
      )

    union all

    -- ------------------------------------------------------------ orders
    select
      'order'::text,
      o.id,
      o.order_no,
      o.ordered_at,
      o.customer_name,
      o.student_name,
      o.phone,
      -- The least advanced line still live: an order with one shirt ready and
      -- one in production is in production, which is the work still to do.
      (
        select oi.status::text
        from public.order_items oi
        where oi.order_id = o.id
          and oi.status is not null
          and oi.status <> 'cancelled'
        order by public.order_status_rank(oi.status)
        limit 1
      ),
      o.total,
      case when n.raw is not null and o.order_no ilike '%' || n.raw || '%'
           then 0 else 1 end
    from public.orders o cross join needle n
    where (p_kinds is null or 'order' = any (p_kinds))
      and (p_from is null or o.ordered_at >= p_from)
      and (p_to   is null or o.ordered_at < (p_to + 1))
      and (
        p_stage is null
        or exists (
          select 1 from public.order_items oi
          where oi.order_id = o.id
            and case oi.status
                  when 'ordered'       then 'waiting'
                  when 'in_production' then 'in_progress'
                  when 'ready'         then 'ready'
                end = p_stage
        )
      )
      and (
        n.raw is null
        or o.order_no ilike '%' || n.raw || '%'
        or unaccent(lower(o.customer_name)) like '%' || n.folded || '%'
        or unaccent(lower(coalesce(o.student_name, ''))) like '%' || n.folded || '%'
        or (n.digits is not null
            and regexp_replace(coalesce(o.phone, ''), '\D', '', 'g') like '%' || n.digits || '%')
      )

    union all

    -- ------------------------------------------------------- alterations
    select
      'alteration'::text,
      a.id,
      a.alteration_no,
      a.received_at,
      a.customer_name,
      a.student_name,
      a.phone,
      a.status::text,
      a.charge,
      case when n.raw is not null and a.alteration_no ilike '%' || n.raw || '%'
           then 0 else 1 end
    from public.alterations a cross join needle n
    where (p_kinds is null or 'alteration' = any (p_kinds))
      and (p_from is null or a.received_at >= p_from)
      and (p_to   is null or a.received_at < (p_to + 1))
      and (
        p_stage is null
        or case a.status
             when 'received'    then 'waiting'
             when 'in_progress' then 'in_progress'
             when 'ready'       then 'ready'
           end = p_stage
      )
      and (
        n.raw is null
        or a.alteration_no ilike '%' || n.raw || '%'
        or unaccent(lower(a.customer_name)) like '%' || n.folded || '%'
        or unaccent(lower(coalesce(a.student_name, ''))) like '%' || n.folded || '%'
        or (n.digits is not null
            and regexp_replace(coalesce(a.phone, ''), '\D', '', 'g') like '%' || n.digits || '%')
      )
  )

select
  kind, id, reference, occurred_at, customer_name, student_name, phone,
  status, amount, match_rank,
  -- Counted over the whole result set before the window is taken, so the page
  -- can say "12 results" while showing 20 of them.
  count(*) over () as total_count
from rows
-- References first, then newest: a parent at the counter is nearly always
-- asking about something recent.
order by match_rank, occurred_at desc
limit greatest(1, least(coalesce(p_limit, 20), 100))
offset greatest(0, coalesce(p_offset, 0));
$fn$;

revoke all on function public.search_transactions(text, text[], text, date, date, integer, integer) from public;
grant execute on function public.search_transactions(text, text[], text, date, date, integer, integer) to authenticated;
