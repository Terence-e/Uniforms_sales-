-- The document ledger: every printed document in one list (A-FR-7.1, A-FR-7.12).
--
-- Five documents exist, each with its own reference series -- SAL, ORD, COL,
-- ALT, RTN -- and until now each was reachable only through the screen that
-- created it. There was no answer to "show me everything issued this week".
--
-- This is NOT a second search. A-FR-7.6 makes search the primary way to find a
-- transaction when a parent turns up without their paper; search answers "where
-- is this one". This answers "what has been issued", which is a browsing
-- question and wants a date range and a type filter rather than a search term.
--
-- One function rather than five queries merged in the application, for the same
-- reason search_transactions is one function: merging in JavaScript would mean
-- fetching every row of all five tables in order to sort and paginate them,
-- which is exactly what pagination exists to avoid.
--
-- SECURITY INVOKER -- the default, and load-bearing. The listing runs as the
-- caller, so RLS decides what each role can see, with no permission logic
-- duplicated here.

create or replace function public.list_documents(
  p_kinds  text[]  default null,   -- null = all five
  p_from   date    default null,
  p_to     date    default null,
  p_limit  integer default 25,
  p_offset integer default 0
)
returns table (
  kind          text,
  id            uuid,
  reference     text,
  issued_at     timestamptz,
  customer_name text,
  -- What the document is worth, in its own terms: a sale's total, an
  -- alteration's charge, the value of goods on a collection slip. Comparable
  -- down a column only within a kind, which is why the kind is always shown.
  amount        numeric,
  -- Signed for returns: negative is money going back to the parent, positive is
  -- a difference collected. Zero on an even swap.
  reprint_count bigint,
  total_count   bigint
)
language sql
stable
set search_path = public, pg_temp
as $fn$
with
  wanted as (
    select case
      when p_kinds is null or cardinality(p_kinds) = 0
        then array['sale', 'order', 'collection', 'alteration', 'return']
      else p_kinds
    end as kinds
  ),

  -- Every document, flattened to the same shape. The union is over the five
  -- reference series named in A-FR-7.1, in one place, so adding a sixth
  -- document type later is one more branch here rather than a new screen.
  docs as (
    select 'sale'::text as kind, s.id, s.receipt_no as reference,
           s.sold_at as issued_at, s.customer_name, s.total as amount
    -- Cross joined rather than `= any((select kinds from wanted))`: a
    -- parenthesised subquery makes Postgres read ANY in its set form and
    -- compare text against text[]. Joining the single-row CTE keeps w.kinds a
    -- plain array reference.
    from public.sales s, wanted w
    where 'sale' = any(w.kinds)

    union all
    select 'order', o.id, o.order_no, o.ordered_at, o.customer_name, o.total
    from public.orders o, wanted w
    where 'order' = any(w.kinds)

    union all
    -- The parent's name lives on the order, not the slip. Joined rather than
    -- denormalised so a corrected name on the order is corrected here too.
    select 'collection', c.id, c.col_no, c.collected_at, o.customer_name,
           -- collection_items only links to the order line; the money lives on
           -- order_items. Joined through rather than duplicated onto the slip,
           -- so a line's value has one home.
           (
             select coalesce(sum(oi.line_total), 0)
             from public.collection_items ci
             join public.order_items oi on oi.id = ci.order_item_id
             where ci.collection_id = c.id
           )
    from public.collections c
    join public.orders o on o.id = c.order_id
    cross join wanted w
    where 'collection' = any(w.kinds)

    union all
    select 'alteration', a.id, a.alteration_no, a.received_at, a.customer_name, a.charge
    from public.alterations a, wanted w
    where 'alteration' = any(w.kinds)

    union all
    -- Signed: a refund is money leaving, a collected difference is money
    -- arriving. Showing both as positive would make the column unreadable.
    select 'return', r.id, r.return_no, r.returned_at, s.customer_name,
           r.collected_amount - r.refund_amount
    from public.returns r
    join public.sales s on s.id = r.sale_id
    cross join wanted w
    where 'return' = any(w.kinds)
  ),

  filtered as (
    select *
    from docs d
    where (p_from is null or d.issued_at >= p_from::timestamptz)
      -- p_to is a DATE and the column is a timestamptz, so "to 3 March" has to
      -- mean the end of 3 March. Comparing against the bare date would silently
      -- exclude everything issued that day.
      and (p_to is null or d.issued_at < (p_to + 1)::timestamptz)
  ),

  counted as (
    select f.*, count(*) over () as total_count
    from filtered f
    order by f.issued_at desc
    limit greatest(p_limit, 1)
    offset greatest(p_offset, 0)
  )

select
  c.kind, c.id, c.reference, c.issued_at, c.customer_name, c.amount,
  -- How many duplicates of this document exist (A-FR-7.12). Counted from the
  -- audit log rather than a column on the row, because the log is already the
  -- record of every reprint and a counter would be a second version of the
  -- same fact, free to drift from it.
  --
  -- Correlated per row rather than joined and grouped: only the page's worth of
  -- rows survives the LIMIT above, so this runs 25 times, not once per document
  -- in the database.
  (
    select count(*)
    from public.audit_log al
    where al.action = 'document_reprinted'
      and al.target_id = c.id::text
  ) as reprint_count,
  c.total_count
from counted c
order by c.issued_at desc;
$fn$;

revoke all on function public.list_documents(text[], date, date, integer, integer) from public;
grant execute on function public.list_documents(text[], date, date, integer, integer) to authenticated;
