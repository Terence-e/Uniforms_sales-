#!/usr/bin/env node
/**
 * Verifies that a database restore is intact (spec A-NFR-6: "verified restorable
 * before go-live. This is money data.").
 *
 * It prints two things for a database:
 *   1. A FINGERPRINT -- a row count per table plus a few money/stock checksums.
 *      Run it against the source and against the restored copy; the two outputs
 *      should be identical. `diff` them, or just read them side by side.
 *   2. INVARIANTS -- integrity checks that must hold in any healthy database
 *      (totals that must equal their parts, stock that must equal its ledger).
 *      Any non-zero count is a corrupted restore; the script exits non-zero.
 *
 * A matching fingerprint says "all the rows came back"; the invariants say "and
 * the money still adds up". Both passing is what "verified restorable" means.
 *
 * Usage:
 *   node scripts/verify-restore.mjs [postgres-connection-uri]
 *   npm run verify:restore -- "postgresql://...restored-db..."
 *
 * With no argument it uses SUPABASE_DB_URL from .env.local (the live database),
 * so you can snapshot the source before a restore drill.
 */

import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
loadEnvFile(join(root, '.env.local'));

const dbUrl = process.argv[2] || process.env.SUPABASE_DB_URL;
if (!dbUrl) {
  console.error(
    'No database URL.\n' +
      'Pass one:  node scripts/verify-restore.mjs "postgresql://…"\n' +
      'or set SUPABASE_DB_URL in .env.local (Supabase → Project Settings → Database).'
  );
  process.exit(1);
}

// Every table that holds real data. Kept explicit rather than read from
// information_schema so a table that failed to restore shows up as an ERROR
// row here instead of silently dropping out of the count.
const TABLES = [
  'profiles',
  'products',
  'sales',
  'sale_items',
  'stock_levels',
  'stock_movements',
  'orders',
  'order_items',
  'collections',
  'collection_items',
  'alterations',
  'returns',
  'return_items',
  'notifications',
  'audit_log',
  'product_prices_history',
  'reference_counters',
  'return_policy',
  'app_size_config',
  'bug_reports'
];

const fingerprintSql =
  `\\pset pager off\n` +
  `\\echo == FINGERPRINT (row counts) ==\n` +
  TABLES.map(
    (t) => `select '${t}' as table, count(*) as rows from public.${t};`
  ).join('\n') +
  `\n\\echo == CHECKSUMS (money + stock) ==\n` +
  `select
     coalesce(sum(total), 0)      as sales_total_sum,
     coalesce(sum(subtotal), 0)   as sales_subtotal_sum,
     coalesce(sum(discount), 0)   as sales_discount_sum,
     count(*) filter (where cancelled_at is not null) as sales_cancelled
   from public.sales;\n` +
  `select coalesce(sum(quantity), 0) as stock_movement_qty_sum,
          count(distinct (product_id, size)) as stock_buckets
   from public.stock_movements;\n`;

// Each of these must return 0. They are the invariants a healthy database can
// never violate, so a non-zero count after a restore means the restore is bad
// (or the source was already corrupt -- run it on the source too).
const invariantSql =
  `\\echo\n\\echo == INVARIANTS (each must be 0) ==\n` +
  `select 'sale total <> subtotal - discount' as invariant,
          count(*) as violations
     from public.sales where total <> subtotal - discount
   union all
   select 'sale_item line_total <> unit_price * quantity',
          count(*) from public.sale_items where line_total <> unit_price * quantity
   union all
   select 'order_item line_total <> unit_price * quantity',
          count(*) from public.order_items where line_total <> unit_price * quantity
   union all
   select 'stock_levels quantity <> sum(movements) for (product,size)',
          count(*) from public.stock_levels sl
          where sl.quantity <> coalesce((
            select sum(sm.quantity) from public.stock_movements sm
            where sm.product_id = sl.product_id and sm.size = sl.size
          ), 0)
   union all
   select 'sale_items orphaned (no parent sale)',
          count(*) from public.sale_items si
          where not exists (select 1 from public.sales s where s.id = si.sale_id)
   union all
   select 'stock_movements with unknown product',
          count(*) from public.stock_movements sm
          where not exists (select 1 from public.products p where p.id = sm.product_id)
   order by 1;`;

const psql = (label, sql) => {
  const res = spawnSync('psql', [dbUrl, '-v', 'ON_ERROR_STOP=1', '-f', '-'], {
    input: sql,
    encoding: 'utf8'
  });
  if (res.error?.code === 'ENOENT') {
    console.error(
      'psql was not found on PATH. Install the PostgreSQL client tools, or run\n' +
        'the SQL in scripts/verify-restore.mjs from the Supabase SQL editor.'
    );
    process.exit(1);
  }
  if (res.status !== 0) {
    console.error(res.stderr || `psql failed running ${label}`);
    process.exit(res.status ?? 1);
  }
  return res.stdout;
};

console.log(`\nVerifying: ${dbUrl.replace(/:[^:@/]+@/, ':****@')}\n`);
console.log(psql('fingerprint', fingerprintSql));
const invariants = psql('invariants', invariantSql);
console.log(invariants);

// Parse the invariant counts: any number > 0 in the "violations" column fails.
// psql aligned output puts the count as the last whitespace-separated token on
// each data row; sum every integer we see under the invariants block.
const failing = invariants
  .split('\n')
  .map((line) => line.trim())
  .filter((line) => /\|\s*\d+\s*$/.test(line)) // "text | 0"
  .map((line) => Number(line.split('|').pop().trim()))
  .filter((n) => Number.isFinite(n) && n > 0);

if (failing.length > 0) {
  console.error(
    `\nFAIL — ${failing.length} invariant(s) violated. This database is NOT intact.\n`
  );
  process.exit(1);
}
console.log('PASS — all invariants hold. Compare the fingerprint against the source.\n');

function loadEnvFile(path) {
  let text;
  try {
    text = readFileSync(path, 'utf8');
  } catch {
    return;
  }
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (!m) continue;
    let val = m[2];
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (process.env[m[1]] === undefined) process.env[m[1]] = val;
  }
}
