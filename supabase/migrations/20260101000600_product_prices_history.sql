-- Price change history (A-FR-4.5): every price change records the old value, new
-- value, who and when. Append-only; price changes are never retroactive -- a
-- completed sale keeps the price it was sold at (sale_items denormalise price).

create table public.product_prices_history (
  id          uuid primary key default gen_random_uuid(),
  product_id  uuid not null references public.products (id) on delete cascade,
  old_price   numeric(12, 2),
  new_price   numeric(12, 2) not null,
  changed_by  uuid references public.profiles (id) on delete set null,
  note        text,
  changed_at  timestamptz not null default now()
);

create index product_prices_history_product_idx
  on public.product_prices_history (product_id, changed_at desc);

alter table public.product_prices_history enable row level security;
