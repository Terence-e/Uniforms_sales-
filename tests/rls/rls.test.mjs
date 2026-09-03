#!/usr/bin/env node
/**
 * Row Level Security verification (spec A-NFR-5, A-16 acceptance #15 and #16).
 *
 * The requirement is explicit: permissions are enforced on the SERVER, and the
 * system "will be tested by sending requests directly to the server, bypassing
 * the interface" (principle P-3). Hiding a button is not a permission check.
 * This script is that test. It signs in as each of the four roles over the wire
 * -- the same PostgREST endpoint the browser uses -- and, for every table,
 * attempts reads and writes it should and should not be allowed.
 *
 * How a verdict is reached, and why it is trustworthy
 * ---------------------------------------------------
 * We do NOT trust the error code the client gets back (a NOT NULL violation and
 * an RLS denial can look alike, and BEFORE triggers can fire before the RLS
 * check). Instead every probe asserts the OUTCOME: after acting as the role, a
 * separate service-role client -- which bypasses RLS -- checks whether the row
 * was actually written / changed. Took effect == the policy allowed it. That is
 * the security property the school is paying for, tested directly.
 *
 * Two acceptance criteria are called out by name in the output:
 *   #15  the Seller cannot change a price via the API           (products.update)
 *   #16  an Administration user cannot record a sale via the API (sales.insert)
 *
 * Requirements
 * ------------
 * A seeded database (npm run db:seed:users) reachable with its service-role key.
 * Because the probes write real rows, run this against a DISPOSABLE database --
 * a local `supabase start` or a throwaway project -- never production. The
 * script cleans up the rows it creates, but a money database is not the place
 * to find out it missed one.
 *
 * Env (read from .env.local if present, else the real environment):
 *   NEXT_PUBLIC_SUPABASE_URL        project URL          (required)
 *   NEXT_PUBLIC_SUPABASE_ANON_KEY   anon/public key      (required)
 *   SUPABASE_SERVICE_ROLE_KEY       service-role secret  (required)
 *   SEED_EMAIL_DOMAIN               login domain         (default: fondation-rst.cm)
 *   SEED_DEFAULT_PASSWORD           seeded password      (default: Uniforme2026!)
 *
 * Usage:  npm run test:rls        (exit code 0 = all pass, 1 = any failure)
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createClient } from '@supabase/supabase-js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
loadEnvFile(join(root, '.env.local'));

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DOMAIN = (process.env.SEED_EMAIL_DOMAIN || 'fondation-rst.cm').toLowerCase();
const PASSWORD = process.env.SEED_DEFAULT_PASSWORD || 'Uniforme2026!';

if (!URL || !ANON || !SERVICE) {
  console.error(
    'Missing env. Need NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY ' +
      'and SUPABASE_SERVICE_ROLE_KEY (see .env.local).'
  );
  process.exit(2);
}

// The four roles, in the order they appear as columns. `local` is the seeded
// mailbox from scripts/seed-users.mjs.
const ROLES = [
  { key: 'seller', label: 'Seller', local: 'ateba' },
  { key: 'administration', label: 'Admin', local: 'admin1' },
  { key: 'maintenance', label: 'Maint', local: 'maintenance1' },
  { key: 'super_admin', label: 'SuperAdmin', local: 'superadmin' }
];
const ROLE_KEYS = ROLES.map((r) => r.key);

// Expectation shorthands. Each returns a full {role: bool} map so a probe can
// never silently omit a role -- every role x table combination is stated.
const set = (...on) => Object.fromEntries(ROLE_KEYS.map((k) => [k, on.includes(k)]));
const ALL = set(...ROLE_KEYS);
const NONE = set();
const OPERATORS = set('seller', 'maintenance', 'super_admin'); // can_operate()
const OVERSIGHT = set('administration', 'maintenance', 'super_admin'); // can_oversee()
const SUPER = set('super_admin'); // is_super_admin()
const MAINT = set('maintenance', 'super_admin'); // is_maintenance()

const svc = createClient(URL, SERVICE, {
  auth: { autoRefreshToken: false, persistSession: false }
});

// --------------------------------------------------------------------------
// Sign in one authenticated client per role (the real login path).
// --------------------------------------------------------------------------
async function signInRoles() {
  const clients = {};
  for (const role of ROLES) {
    const email = `${role.local}@${DOMAIN}`;
    const client = createClient(URL, ANON, {
      auth: { autoRefreshToken: false, persistSession: false }
    });
    const { data, error } = await client.auth.signInWithPassword({ email, password: PASSWORD });
    if (error || !data.user) {
      console.error(
        `Could not sign in ${email}: ${error?.message ?? 'no user'}.\n` +
          'Seed the accounts first (npm run db:seed:users) and make sure the ' +
          'password matches SEED_DEFAULT_PASSWORD.'
      );
      process.exit(2);
    }
    clients[role.key] = { client, uid: data.user.id };
  }
  return clients;
}

// --------------------------------------------------------------------------
// Fixtures. All created with the service role so they exist regardless of RLS,
// and tagged so a re-run starts clean. Ownership is chosen to make the read
// matrix discriminating: rows owned by a NON-seller prove the seller is shut
// out while the oversight roles are not.
// --------------------------------------------------------------------------
const TAG = 'RLSVERIFY';

async function clean() {
  // Order matters for FKs: children before parents.
  await svc.from('return_items').delete().like('description', `${TAG}%`);
  await svc.from('returns').delete().like('reason', `${TAG}%`);
  await svc.from('collections').delete().like('collector_name', `${TAG}%`); // cascades to collection_items
  await svc.from('stock_movements').delete().like('note', `${TAG}%`);
  await svc.from('sale_items').delete().like('description', `${TAG}%`);
  await svc.from('order_items').delete().like('description', `${TAG}%`);
  await svc.from('sales').delete().like('customer_name', `${TAG}%`);
  await svc.from('orders').delete().like('customer_name', `${TAG}%`);
  await svc.from('alterations').delete().like('customer_name', `${TAG}%`);
  await svc.from('product_prices_history').delete().like('note', `${TAG}%`);
  await svc.from('bug_reports').delete().like('description', `${TAG}%`);
  await svc.from('notifications').delete().like('type', `${TAG}%`);
  await svc.from('audit_log').delete().like('action', `${TAG}%`);
  await svc.from('products').delete().like('sku', `${TAG}%`);
}

async function must(promise, what) {
  const { data, error } = await promise;
  if (error) throw new Error(`fixture ${what}: ${error.message}`);
  return data;
}

async function setupFixtures(clients) {
  await clean();
  const uid = Object.fromEntries(ROLE_KEYS.map((k) => [k, clients[k].uid]));

  // Remember each role's real name so the profile write probes can put it back
  // exactly, rather than leaving the accounts renamed after the run.
  const names = {};
  for (const k of ROLE_KEYS) {
    const { data } = await svc.from('profiles').select('full_name').eq('id', uid[k]).maybeSingle();
    names[k] = data?.full_name ?? '';
  }

  // A catalogue product with a stock level and one price-history row.
  const product = await must(
    svc
      .from('products')
      .insert({
        sku: `${TAG}-P`,
        name_en: 'RLS Test Garment',
        name_fr: 'Article test RLS',
        category: 'uniform',
        size: '10',
        unit_price: 1000
      })
      .select('id')
      .single(),
    'product'
  );
  await must(
    svc.from('stock_levels').upsert({ product_id: product.id, quantity: 5, reorder_level: 2 }),
    'stock_levels'
  );
  const priceHist = await must(
    svc
      .from('product_prices_history')
      .insert({ product_id: product.id, old_price: 900, new_price: 1000, note: `${TAG} seed` })
      .select('id')
      .single(),
    'price_history'
  );
  const stockMove = await must(
    svc
      .from('stock_movements')
      .insert({ product_id: product.id, kind: 'intake', quantity: 5, created_by: uid.super_admin, note: `${TAG} seed` })
      .select('id')
      .single(),
    'stock_movement'
  );

  // A sale owned by the seller, with a line -- the seller-owned parent the
  // sale_items write probe needs.
  const saleSeller = await must(
    svc
      .from('sales')
      .insert({ customer_name: `${TAG} sale`, subtotal: 1000, discount: 0, total: 1000, seller_id: uid.seller })
      .select('id')
      .single(),
    'sale'
  );
  const saleItem = await must(
    svc
      .from('sale_items')
      .insert({ sale_id: saleSeller.id, product_id: product.id, description: `${TAG} line`, size: '10', unit_price: 1000, quantity: 1, line_total: 1000 })
      .select('id')
      .single(),
    'sale_item'
  );

  // An order owned by the seller (write probes) and one owned by the super_admin
  // (read discrimination: the seller must NOT see someone else's order).
  const orderSeller = await must(
    svc
      .from('orders')
      .insert({ customer_name: `${TAG} ord-own`, subtotal: 1000, discount: 0, total: 1000, seller_id: uid.seller })
      .select('id')
      .single(),
    'order own'
  );
  const orderSellerItem = await must(
    svc
      .from('order_items')
      .insert({ order_id: orderSeller.id, product_id: product.id, description: `${TAG} ord-own-line`, unit_price: 1000, quantity: 1, line_total: 1000, status: 'ordered' })
      .select('id')
      .single(),
    'order own item'
  );
  const orderOther = await must(
    svc
      .from('orders')
      .insert({ customer_name: `${TAG} ord-other`, subtotal: 1000, discount: 0, total: 1000, seller_id: uid.super_admin })
      .select('id')
      .single(),
    'order other'
  );
  const orderOtherItem = await must(
    svc
      .from('order_items')
      .insert({ order_id: orderOther.id, product_id: product.id, description: `${TAG} ord-other-line`, unit_price: 1000, quantity: 1, line_total: 1000 })
      .select('id')
      .single(),
    'order other item'
  );

  // A collection + line against the super_admin's order (read discrimination).
  const collectionOther = await must(
    svc
      .from('collections')
      .insert({ order_id: orderOther.id, collector_name: `${TAG} collector`, handed_over_by: uid.super_admin, created_by: uid.super_admin })
      .select('id')
      .single(),
    'collection'
  );
  const collectionOtherItem = await must(
    svc
      .from('collection_items')
      .insert({ collection_id: collectionOther.id, order_item_id: orderOtherItem.id })
      .select('id')
      .single(),
    'collection item'
  );

  // An alteration taken in by the super_admin (read discrimination) and the
  // seller-owned one is created inside the write probe.
  const alterationOther = await must(
    svc
      .from('alterations')
      .insert({ customer_name: `${TAG} alt-other`, garment: 'Blazer', work_required: 'Take in the waist', received_by: uid.super_admin })
      .select('id')
      .single(),
    'alteration'
  );

  // A notification addressed to the seller only (own-row visibility).
  const notifSeller = await must(
    svc
      .from('notifications')
      .insert({ user_id: uid.seller, type: `${TAG}_note`, data: {} })
      .select('id')
      .single(),
    'notification'
  );

  // A bug report (maintenance/super_admin read only).
  const bugReport = await must(
    svc
      .from('bug_reports')
      .insert({ reporter_id: uid.seller, reporter_name: 'RLS', description: `${TAG} a bug to read` })
      .select('id')
      .single(),
    'bug_report'
  );

  // A return against the seller's sale, with a returned line (shared read).
  const ret = await must(
    svc
      .from('returns')
      .insert({ kind: 'return', sale_id: saleSeller.id, reason: `${TAG} wrong size`, condition: 'unworn', refund_amount: 0, seller_id: uid.seller })
      .select('id')
      .single(),
    'return'
  );
  const retItem = await must(
    svc
      .from('return_items')
      .insert({ return_id: ret.id, direction: 'in', sale_item_id: saleItem.id, product_id: product.id, description: `${TAG} ret-line`, size: '10', unit_price: 1000, quantity: 1, line_total: 1000 })
      .select('id')
      .single(),
    'return_item'
  );

  // An audit row (readable by all).
  await must(
    svc.from('audit_log').insert({ action: `${TAG}_seed`, entity: 'rls', meta: {} }),
    'audit'
  );

  return {
    uid,
    names,
    productId: product.id,
    priceHistId: priceHist.id,
    stockMoveId: stockMove.id,
    saleSellerId: saleSeller.id,
    saleItemId: saleItem.id,
    orderSellerId: orderSeller.id,
    orderSellerItemId: orderSellerItem.id,
    orderOtherId: orderOther.id,
    orderOtherItemId: orderOtherItem.id,
    collectionOtherId: collectionOther.id,
    collectionOtherItemId: collectionOtherItem.id,
    alterationOtherId: alterationOther.id,
    notifSellerId: notifSeller.id,
    bugReportId: bugReport.id,
    returnId: ret.id,
    returnItemId: retItem.id
  };
}

// --------------------------------------------------------------------------
// READ probes. Each names a seeded row and states who should be able to SEE it.
// A blocked read is not an error under RLS -- it is an empty result -- so we
// count rows matching the target id through the role's own client.
// --------------------------------------------------------------------------
function readChecks(fx) {
  const visible = async (client, table, filters) => {
    let q = client.from(table).select('*', { count: 'exact', head: true });
    for (const [col, val] of filters) q = q.eq(col, val);
    const { count, error } = await q;
    // A hard error (rare on select) counts as not visible.
    if (error) return false;
    return (count ?? 0) > 0;
  };

  return [
    { table: 'profiles', label: "read another user's profile", expected: OVERSIGHT, run: (c) => visible(c, 'profiles', [['id', fx.uid.super_admin]]) },
    { table: 'products', label: 'read catalogue', expected: ALL, run: (c) => visible(c, 'products', [['id', fx.productId]]) },
    { table: 'product_prices_history', label: 'read price history', expected: OVERSIGHT, run: (c) => visible(c, 'product_prices_history', [['id', fx.priceHistId]]) },
    { table: 'stock_levels', label: 'read stock levels', expected: ALL, run: (c) => visible(c, 'stock_levels', [['product_id', fx.productId]]) },
    { table: 'stock_movements', label: 'read stock movements', expected: ALL, run: (c) => visible(c, 'stock_movements', [['id', fx.stockMoveId]]) },
    { table: 'sales', label: 'read sales ledger', expected: ALL, run: (c) => visible(c, 'sales', [['id', fx.saleSellerId]]) },
    { table: 'sale_items', label: 'read sale line', expected: ALL, run: (c) => visible(c, 'sale_items', [['id', fx.saleItemId]]) },
    { table: 'orders', label: "read another seller's order", expected: OVERSIGHT, run: (c) => visible(c, 'orders', [['id', fx.orderOtherId]]) },
    { table: 'order_items', label: "read another seller's order line", expected: OVERSIGHT, run: (c) => visible(c, 'order_items', [['id', fx.orderOtherItemId]]) },
    { table: 'collections', label: "read another seller's collection", expected: OVERSIGHT, run: (c) => visible(c, 'collections', [['id', fx.collectionOtherId]]) },
    { table: 'collection_items', label: "read another seller's collection line", expected: OVERSIGHT, run: (c) => visible(c, 'collection_items', [['id', fx.collectionOtherItemId]]) },
    { table: 'alterations', label: "read another seller's alteration", expected: OVERSIGHT, run: (c) => visible(c, 'alterations', [['id', fx.alterationOtherId]]) },
    { table: 'notifications', label: "read seller's notification", expected: set('seller'), run: (c) => visible(c, 'notifications', [['id', fx.notifSellerId]]) },
    { table: 'audit_log', label: 'read audit log', expected: ALL, run: (c) => visible(c, 'audit_log', [['action', `${TAG}_seed`]]) },
    { table: 'bug_reports', label: 'read bug reports', expected: MAINT, run: (c) => visible(c, 'bug_reports', [['id', fx.bugReportId]]) },
    { table: 'returns', label: 'read returns ledger', expected: ALL, run: (c) => visible(c, 'returns', [['id', fx.returnId]]) },
    { table: 'return_items', label: 'read return line', expected: ALL, run: (c) => visible(c, 'return_items', [['id', fx.returnItemId]]) },
    { table: 'return_policy', label: 'read return policy', expected: ALL, run: (c) => visible(c, 'return_policy', [['kind', 'exchange'], ['condition', 'unworn']]) },
    { table: 'reference_counters', label: 'read reference counters', expected: NONE, run: (c) => visible(c, 'reference_counters', [['prefix', 'ORD']]) }
  ];
}

// --------------------------------------------------------------------------
// WRITE probes. `run` performs the op as the role (result ignored). `check`
// asks the service role whether it took effect for that role. `reset` restores
// baseline before each role so update probes are isolated. `cleanup` runs once
// after all roles. Insert tags carry the role so verification is unambiguous.
// --------------------------------------------------------------------------
function writeChecks(fx) {
  const rowExists = async (table, filters) => {
    let q = svc.from(table).select('*', { count: 'exact', head: true });
    for (const [col, val] of filters) q = q.eq(col, val);
    const { count } = await q;
    return (count ?? 0) > 0;
  };
  const fieldEquals = async (table, filters, col, val) => {
    let q = svc.from(table).select(col);
    for (const [c, v] of filters) q = q.eq(c, v);
    const { data } = await q.maybeSingle();
    return data ? sameValue(data[col], val) : false;
  };
  const tag = (label, roleKey) => `${TAG}-${label}-${roleKey}`;

  return [
    // ---- profiles ----
    {
      table: 'profiles',
      label: 'update own name',
      expected: ALL,
      reset: async (rk) => { await svc.from('profiles').update({ full_name: `${TAG}-base-${rk}` }).eq('id', fx.uid[rk]); },
      run: (c, rk) => c.from('profiles').update({ full_name: tag('ownname', rk) }).eq('id', fx.uid[rk]),
      check: (rk) => fieldEquals('profiles', [['id', fx.uid[rk]]], 'full_name', tag('ownname', rk)),
      cleanup: async () => { for (const r of ROLES) await svc.from('profiles').update({ full_name: fx.names[r.key] }).eq('id', fx.uid[r.key]); }
    },
    {
      table: 'profiles',
      label: "update another user's profile",
      expected: SUPER,
      reset: async () => { await svc.from('profiles').update({ full_name: fx.names.administration }).eq('id', fx.uid.administration); },
      run: (c, rk) => c.from('profiles').update({ full_name: tag('other', rk) }).eq('id', fx.uid.administration),
      check: (rk) => fieldEquals('profiles', [['id', fx.uid.administration]], 'full_name', tag('other', rk)),
      cleanup: async () => { await svc.from('profiles').update({ full_name: fx.names.administration }).eq('id', fx.uid.administration); }
    },

    // ---- products (acceptance #15: Seller cannot change a price) ----
    {
      table: 'products',
      label: 'change a price [#15]',
      expected: SUPER,
      reset: async () => { await svc.from('products').update({ unit_price: 1000 }).eq('id', fx.productId); },
      run: (c, rk) => c.from('products').update({ unit_price: 1000 + roleNum(rk) }).eq('id', fx.productId),
      check: (rk) => fieldEquals('products', [['id', fx.productId]], 'unit_price', 1000 + roleNum(rk)),
      cleanup: async () => { await svc.from('products').update({ unit_price: 1000 }).eq('id', fx.productId); }
    },
    {
      table: 'products',
      label: 'create a product',
      expected: SUPER,
      run: (c, rk) => c.from('products').insert({ sku: tag('sku', rk), name_en: 'x', name_fr: 'x', unit_price: 100 }),
      check: (rk) => rowExists('products', [['sku', tag('sku', rk)]]),
      cleanup: async () => { await svc.from('products').delete().like('sku', `${TAG}-sku-%`); }
    },

    // ---- product_prices_history (no client write path) ----
    {
      table: 'product_prices_history',
      label: 'insert price history',
      expected: NONE,
      run: (c, rk) => c.from('product_prices_history').insert({ product_id: fx.productId, new_price: 1, note: tag('ph', rk) }),
      check: (rk) => rowExists('product_prices_history', [['note', tag('ph', rk)]]),
      cleanup: async () => { await svc.from('product_prices_history').delete().like('note', `${TAG}-ph-%`); }
    },

    // ---- sales (acceptance #16: Administration cannot record a sale) ----
    {
      table: 'sales',
      label: 'record a sale [#16]',
      expected: OPERATORS,
      run: (c, rk) => c.from('sales').insert({ customer_name: tag('sale', rk), subtotal: 500, discount: 0, total: 500, seller_id: fx.uid[rk] }),
      check: (rk) => rowExists('sales', [['customer_name', tag('sale', rk)]]),
      cleanup: async () => { await svc.from('sales').delete().like('customer_name', `${TAG}-sale-%`); }
    },
    {
      table: 'sales',
      label: 'amend a recorded sale',
      expected: SUPER,
      reset: async () => { await svc.from('sales').update({ notes: null }).eq('id', fx.saleSellerId); },
      run: (c, rk) => c.from('sales').update({ notes: tag('samend', rk) }).eq('id', fx.saleSellerId),
      check: (rk) => fieldEquals('sales', [['id', fx.saleSellerId]], 'notes', tag('samend', rk)),
      cleanup: async () => { await svc.from('sales').update({ notes: null }).eq('id', fx.saleSellerId); }
    },

    // ---- sale_items (only the seller who owns the parent sale) ----
    {
      table: 'sale_items',
      label: 'add a line to own sale',
      expected: set('seller'),
      run: (c, rk) => c.from('sale_items').insert({ sale_id: fx.saleSellerId, product_id: fx.productId, description: tag('si', rk), unit_price: 10, quantity: 1, line_total: 10 }),
      check: (rk) => rowExists('sale_items', [['description', tag('si', rk)]]),
      cleanup: async () => { await svc.from('sale_items').delete().like('description', `${TAG}-si-%`); }
    },

    // ---- stock ----
    {
      table: 'stock_movements',
      label: 'record a stock movement',
      expected: OPERATORS,
      run: (c, rk) => c.from('stock_movements').insert({ product_id: fx.productId, kind: 'intake', quantity: 1, created_by: fx.uid[rk], note: tag('sm', rk) }),
      check: (rk) => rowExists('stock_movements', [['note', tag('sm', rk)]]),
      cleanup: async () => { await svc.from('stock_movements').delete().like('note', `${TAG}-sm-%`); }
    },
    {
      table: 'stock_levels',
      label: 'edit a stock level directly',
      expected: NONE,
      reset: async () => { await svc.from('stock_levels').update({ reorder_level: 2 }).eq('product_id', fx.productId); },
      run: (c, rk) => c.from('stock_levels').update({ reorder_level: 90 + roleNum(rk) }).eq('product_id', fx.productId),
      check: (rk) => fieldEquals('stock_levels', [['product_id', fx.productId]], 'reorder_level', 90 + roleNum(rk)),
      cleanup: async () => { await svc.from('stock_levels').update({ reorder_level: 2 }).eq('product_id', fx.productId); }
    },

    // ---- orders ----
    {
      table: 'orders',
      label: 'place an order',
      expected: OPERATORS,
      run: (c, rk) => c.from('orders').insert({ customer_name: tag('ord', rk), subtotal: 500, discount: 0, total: 500, seller_id: fx.uid[rk] }),
      check: (rk) => rowExists('orders', [['customer_name', tag('ord', rk)]]),
      cleanup: async () => { await svc.from('orders').delete().like('customer_name', `${TAG}-ord-%`); }
    },
    {
      table: 'orders',
      label: 'amend an order',
      expected: SUPER,
      reset: async () => { await svc.from('orders').update({ notes: null }).eq('id', fx.orderSellerId); },
      run: (c, rk) => c.from('orders').update({ notes: tag('oamend', rk) }).eq('id', fx.orderSellerId),
      check: (rk) => fieldEquals('orders', [['id', fx.orderSellerId]], 'notes', tag('oamend', rk)),
      cleanup: async () => { await svc.from('orders').update({ notes: null }).eq('id', fx.orderSellerId); }
    },

    // ---- order_items ----
    {
      table: 'order_items',
      label: 'add a line to own order',
      expected: set('seller'),
      run: (c, rk) => c.from('order_items').insert({ order_id: fx.orderSellerId, product_id: fx.productId, description: tag('oi', rk), unit_price: 10, quantity: 1, line_total: 10 }),
      check: (rk) => rowExists('order_items', [['description', tag('oi', rk)]]),
      cleanup: async () => { await svc.from('order_items').delete().like('description', `${TAG}-oi-%`); }
    },
    {
      // Updates status_reason, not status: the RLS policy is what we are
      // probing, and touching `status` would also invoke the transition trigger
      // (a separate guard). The line stays 'ordered'; guard_order_item_contents
      // permits changing the reason, so a pass here is purely the row policy.
      table: 'order_items',
      label: 'edit own order line',
      expected: OPERATORS,
      reset: async () => { await svc.from('order_items').update({ status_reason: null }).eq('id', fx.orderSellerItemId); },
      run: (c, rk) => c.from('order_items').update({ status_reason: tag('lineupd', rk) }).eq('id', fx.orderSellerItemId),
      check: (rk) => fieldEquals('order_items', [['id', fx.orderSellerItemId]], 'status_reason', tag('lineupd', rk)),
      cleanup: async () => { await svc.from('order_items').update({ status_reason: null }).eq('id', fx.orderSellerItemId); }
    },

    // ---- collections (written only by the security-definer RPC) ----
    {
      table: 'collections',
      label: 'insert a collection',
      expected: NONE,
      run: (c, rk) => c.from('collections').insert({ order_id: fx.orderSellerId, collector_name: tag('col', rk), handed_over_by: fx.uid[rk], created_by: fx.uid[rk] }),
      check: (rk) => rowExists('collections', [['collector_name', tag('col', rk)]]),
      cleanup: async () => { await svc.from('collections').delete().like('collector_name', `${TAG}-col-%`); }
    },
    {
      table: 'collection_items',
      label: 'insert a collection line',
      expected: NONE,
      run: (c) => c.from('collection_items').insert({ collection_id: fx.collectionOtherId, order_item_id: fx.orderSellerItemId }),
      check: () => rowExists('collection_items', [['collection_id', fx.collectionOtherId], ['order_item_id', fx.orderSellerItemId]]),
      cleanup: async () => { await svc.from('collection_items').delete().eq('collection_id', fx.collectionOtherId).eq('order_item_id', fx.orderSellerItemId); }
    },

    // ---- alterations ----
    {
      table: 'alterations',
      label: 'take in an alteration',
      expected: OPERATORS,
      run: (c, rk) => c.from('alterations').insert({ customer_name: tag('alt', rk), garment: 'Shirt', work_required: 'Hem', received_by: fx.uid[rk] }),
      check: (rk) => rowExists('alterations', [['customer_name', tag('alt', rk)]]),
      cleanup: async () => { await svc.from('alterations').delete().like('customer_name', `${TAG}-alt-%`); }
    },

    // ---- notifications ----
    {
      table: 'notifications',
      label: "mark another user's notification read",
      expected: set('seller'),
      reset: async () => { await svc.from('notifications').update({ is_read: false }).eq('id', fx.notifSellerId); },
      run: (c) => c.from('notifications').update({ is_read: true }).eq('id', fx.notifSellerId),
      check: () => fieldEquals('notifications', [['id', fx.notifSellerId]], 'is_read', true),
      cleanup: async () => { await svc.from('notifications').update({ is_read: false }).eq('id', fx.notifSellerId); }
    },
    {
      table: 'notifications',
      label: 'delete own notification',
      expected: ALL,
      reset: async (rk) => {
        await svc.from('notifications').delete().eq('type', `${TAG}_del_${rk}`);
        await svc.from('notifications').insert({ user_id: fx.uid[rk], type: `${TAG}_del_${rk}`, data: {} });
      },
      run: (c, rk) => c.from('notifications').delete().eq('type', `${TAG}_del_${rk}`),
      check: async (rk) => !(await rowExists('notifications', [['type', `${TAG}_del_${rk}`]])),
      cleanup: async () => { await svc.from('notifications').delete().like('type', `${TAG}_del_%`); }
    },

    // ---- bug_reports ----
    {
      table: 'bug_reports',
      label: 'report a bug',
      expected: ALL,
      run: (c, rk) => c.from('bug_reports').insert({ reporter_id: fx.uid[rk], reporter_name: rk, description: tag('bug', rk) }),
      check: (rk) => rowExists('bug_reports', [['description', tag('bug', rk)]]),
      cleanup: async () => { await svc.from('bug_reports').delete().like('description', `${TAG}-bug-%`); }
    },
    {
      table: 'bug_reports',
      label: 'resolve a bug report',
      expected: MAINT,
      reset: async () => { await svc.from('bug_reports').update({ resolved_at: null }).eq('id', fx.bugReportId); },
      run: (c) => c.from('bug_reports').update({ resolved_at: new Date().toISOString() }).eq('id', fx.bugReportId),
      check: async () => !(await fieldEquals('bug_reports', [['id', fx.bugReportId]], 'resolved_at', null)),
      cleanup: async () => { await svc.from('bug_reports').update({ resolved_at: null }).eq('id', fx.bugReportId); }
    },

    // ---- returns / return_items (written only by the security-definer RPC) ----
    {
      table: 'returns',
      label: 'insert a return',
      expected: NONE,
      run: (c, rk) => c.from('returns').insert({ kind: 'return', sale_id: fx.saleSellerId, reason: tag('ret', rk), condition: 'unworn', refund_amount: 0, seller_id: fx.uid[rk] }),
      check: (rk) => rowExists('returns', [['reason', tag('ret', rk)]]),
      cleanup: async () => { await svc.from('returns').delete().like('reason', `${TAG}-ret-%`); }
    },
    {
      table: 'return_items',
      label: 'insert a return line',
      expected: NONE,
      run: (c, rk) => c.from('return_items').insert({ return_id: fx.returnId, direction: 'in', sale_item_id: fx.saleItemId, product_id: fx.productId, description: tag('ri', rk), unit_price: 10, quantity: 1, line_total: 10 }),
      check: (rk) => rowExists('return_items', [['description', tag('ri', rk)]]),
      cleanup: async () => { await svc.from('return_items').delete().like('description', `${TAG}-ri-%`); }
    },

    // ---- return_policy ----
    {
      table: 'return_policy',
      label: 'change a policy window',
      expected: SUPER,
      reset: async () => { await svc.from('return_policy').update({ window_days: 90 }).eq('kind', 'exchange').eq('condition', 'unworn'); },
      run: (c, rk) => c.from('return_policy').update({ window_days: 90 + roleNum(rk) }).eq('kind', 'exchange').eq('condition', 'unworn'),
      check: (rk) => fieldEquals('return_policy', [['kind', 'exchange'], ['condition', 'unworn']], 'window_days', 90 + roleNum(rk)),
      cleanup: async () => { await svc.from('return_policy').update({ window_days: 90 }).eq('kind', 'exchange').eq('condition', 'unworn'); }
    },

    // ---- reference_counters (server-internal only) ----
    {
      table: 'reference_counters',
      label: 'edit a reference counter',
      expected: NONE,
      run: (c) => c.from('reference_counters').update({ last_value: 999999 }).eq('prefix', 'ORD'),
      check: () => fieldEquals('reference_counters', [['prefix', 'ORD']], 'last_value', 999999),
      cleanup: async () => {} // update was blocked for everyone; nothing to undo
    }
  ];
}

const roleNum = (rk) => ROLE_KEYS.indexOf(rk) + 1;

/**
 * Compares a value read back from the database against an expected sentinel,
 * without implicit coercion. When the sentinel is a number the stored value is
 * coerced numerically first -- a numeric(12,2) column can arrive as either a JS
 * number or a decimal string depending on the driver -- otherwise it is a strict
 * comparison, which is what we want for strings, booleans and null.
 */
function sameValue(stored, expected) {
  if (typeof expected === 'number') {
    return stored !== null && stored !== undefined && Number(stored) === expected;
  }
  return stored === expected;
}

// --------------------------------------------------------------------------
// Runner + reporting.
// --------------------------------------------------------------------------
async function run() {
  console.log('\nRLS verification — hitting the API directly as each role (P-3, A-NFR-5)\n');
  const clients = await signInRoles();
  const fx = await setupFixtures(clients);

  const rows = [];
  let failures = 0;

  // Reads
  for (const chk of readChecks(fx)) {
    const cells = {};
    for (const role of ROLES) {
      const actual = await chk.run(clients[role.key].client);
      const expected = chk.expected[role.key];
      const pass = actual === expected;
      if (!pass) failures++;
      cells[role.key] = { actual, expected, pass };
    }
    rows.push({ kind: 'READ', table: chk.table, label: chk.label, cells });
  }

  // Writes
  for (const chk of writeChecks(fx)) {
    const cells = {};
    for (const role of ROLES) {
      if (chk.reset) await chk.reset(role.key);
      // The op itself may reject (e.g. 42501) -- that is fine, the outcome is
      // what we assert. Swallow the thrown/returned error either way.
      try {
        const res = await chk.run(clients[role.key].client, role.key);
        void res;
      } catch {
        /* ignore -- verified by outcome below */
      }
      const actual = await chk.check(role.key);
      const expected = chk.expected[role.key];
      const pass = actual === expected;
      if (!pass) failures++;
      cells[role.key] = { actual, expected, pass };
    }
    if (chk.cleanup) await chk.cleanup();
    rows.push({ kind: 'WRITE', table: chk.table, label: chk.label, cells });
  }

  await clean();
  printTable(rows);

  const total = rows.length * ROLES.length;
  console.log(
    `\n${failures === 0 ? 'PASS' : 'FAIL'} — ${total - failures}/${total} role×check cells as expected` +
      (failures ? `, ${failures} unexpected` : '') +
      '.\n'
  );
  process.exit(failures === 0 ? 0 : 1);
}

/** Renders the pass/fail matrix. Each cell: allow/deny, with a ! on a mismatch. */
function printTable(rows) {
  const roleW = 11;
  const labelW = Math.max(...rows.map((r) => (r.table + ' · ' + r.label).length), 20);
  const head =
    pad('  Check', labelW + 8) + ROLES.map((r) => pad(r.label, roleW)).join('') + 'Result';
  const bar = '─'.repeat(head.length + 2);
  console.log(bar);
  console.log(head);
  console.log(bar);

  for (const row of rows) {
    let rowFail = false;
    const cells = ROLES.map((role) => {
      const { actual, expected, pass } = row.cells[role.key];
      if (!pass) rowFail = true;
      const word = actual ? 'allow' : 'deny';
      // On a mismatch, show what was expected so the failure reads on its own.
      return pad(pass ? `  ${word}` : `! ${word}≠${expected ? 'allow' : 'deny'}`, roleW);
    }).join('');
    const name = `${row.kind === 'READ' ? 'R' : 'W'} ${row.table} · ${row.label}`;
    console.log(pad('  ' + name, labelW + 8) + cells + (rowFail ? 'FAIL' : 'ok'));
  }
  console.log(bar);
}

function pad(s, w) {
  s = String(s);
  return s.length >= w ? s + ' ' : s + ' '.repeat(w - s.length);
}

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

run().catch((err) => {
  console.error('\nRLS test harness error:', err.message);
  process.exit(2);
});
