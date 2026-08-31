-- Prices come from the catalogue; reductions go through the discount (A-FR-6.6,
-- A-FR-6.7).
--
-- This is a security rule as much as a correctness one. A seller who can type
-- over a line price can undercharge a friend and leave nothing behind; a
-- discount with a mandatory reason leaves exactly that trace, which is the
-- whole point of routing every reduction through one field.
--
-- Enforced in the database rather than the form because the acceptance
-- criterion is explicit that a DIRECT API CALL setting a line price must be
-- rejected. A check inside createSale cannot do that: a PostgREST insert into
-- sale_items never reaches the action, it goes straight to the table with the
-- seller's own token, which RLS already permits.

-- ---------------------------------------------------------------- sale lines

-- A sale line must name a catalogue product. Without one there is no price to
-- check against, which is precisely the hole this migration closes.
--
-- Deliberately NOT applied to order_items: ordering a size the catalogue does
-- not carry is the entire reason orders exist, and an alteration is someone
-- else's garment. Only a SALE is constrained to the catalogue.
alter table public.sale_items
  alter column product_id set not null;

-- security definer so the check cannot be dodged by a caller who can insert a
-- sale line but cannot read the products table.
create or replace function public.enforce_sale_line_price()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_catalogue numeric(12, 2);
begin
  select p.unit_price into v_catalogue
  from public.products p
  where p.id = new.product_id;

  if v_catalogue is null then
    raise exception 'Unknown product on sale line';
  end if;

  if new.unit_price <> v_catalogue then
    raise exception
      'A sale line must be priced from the catalogue (expected %, got %). Use the discount field to reduce a sale.',
      v_catalogue, new.unit_price;
  end if;

  return new;
end;
$fn$;

-- INSERT only. The stored price is deliberately denormalised so a receipt still
-- reads correctly after the catalogue changes -- checking on UPDATE would make
-- every later catalogue change retroactively invalidate old rows, which is the
-- opposite of what that denormalisation is for.
create trigger sale_items_enforce_price
  before insert on public.sale_items
  for each row execute function public.enforce_sale_line_price();

-- ---------------------------------------------------------------- discount

alter table public.sales
  add column discount_reason text;

-- NOT VALID on purpose.
--
-- Two sales already carry a discount recorded before reasons were required.
-- Validating against them would either fail this migration or force a
-- backfilled reason -- and a made-up explanation stored as fact is worse than
-- an honest gap. NOT VALID binds every future insert and update while leaving
-- those two rows as they are.
alter table public.sales
  add constraint sales_discount_needs_reason check (
    discount = 0
    or (discount_reason is not null and length(btrim(discount_reason)) >= 3)
  ) not valid;
