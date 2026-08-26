-- Sample catalogue for local development. Loaded by `supabase db reset`.

insert into public.products (sku, name_en, name_fr, category, size, unit_price)
values
  ('SHT-WHT-S',  'White shirt',       'Chemise blanche',    'uniform',  'S',   6500),
  ('SHT-WHT-M',  'White shirt',       'Chemise blanche',    'uniform',  'M',   7000),
  ('SHT-WHT-L',  'White shirt',       'Chemise blanche',    'uniform',  'L',   7500),
  ('TRS-NVY-S',  'Navy trousers',     'Pantalon bleu',      'uniform',  'S',   9000),
  ('TRS-NVY-M',  'Navy trousers',     'Pantalon bleu',      'uniform',  'M',   9500),
  ('TRS-NVY-L',  'Navy trousers',     'Pantalon bleu',      'uniform',  'L',  10000),
  ('SKT-NVY-M',  'Navy skirt',        'Jupe bleue',         'uniform',  'M',   8500),
  ('SWT-NVY-M',  'Navy sweater',      'Pull bleu',          'uniform',  'M',  12000),
  ('TIE-STD',    'School tie',        'Cravate scolaire',   'accessory', null, 2500),
  ('BDG-STD',    'School badge',      'Badge scolaire',     'accessory', null,  1000),
  ('SOC-WHT',    'White socks (pair)','Chaussettes (paire)','accessory', null, 1500),
  ('BAG-STD',    'School bag',        'Sac d''école',       'accessory', null, 15000)
on conflict (sku) do nothing;

insert into public.stock_levels (product_id, quantity, reorder_level)
select id, 40, 10 from public.products
on conflict (product_id) do nothing;
