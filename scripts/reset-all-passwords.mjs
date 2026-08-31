#!/usr/bin/env node
/**
 * Resets EVERY existing account's password to the shared temporary password and
 * flags must_change_password, so each user is forced to set their own on next
 * login. One-off admin operation -- run deliberately.
 *
 * Uses the service-role key (bypasses RLS); never ship it to the browser.
 *
 * Environment (read from .env.local if present):
 *   NEXT_PUBLIC_SUPABASE_URL      project URL          (required)
 *   SUPABASE_SERVICE_ROLE_KEY     service-role secret  (required)
 *   SEED_DEFAULT_PASSWORD         temp password        (default below)
 *
 * Usage:  npm run db:reset:passwords
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createClient } from '@supabase/supabase-js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
loadEnvFile(join(root, '.env.local'));

const DEFAULT_PASSWORD = 'Uniforme2026!';
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const password = process.env.SEED_DEFAULT_PASSWORD || DEFAULT_PASSWORD;

if (!url || !serviceKey) {
  console.error(
    'Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.\n' +
      'Set them in .env.local (Supabase -> Project Settings -> API) and re-run.'
  );
  process.exit(1);
}

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

const users = await listAllUsers();
let done = 0;
for (const u of users) {
  const { error } = await admin.auth.admin.updateUserById(u.id, {
    password,
    user_metadata: { ...u.user_metadata, must_change_password: true }
  });
  if (error) {
    console.error(`  fail   ${u.email}: ${error.message}`);
    continue;
  }
  done++;
  console.log(`  reset  ${u.email}`);
}

console.log(
  `\nReset ${done}/${users.length} account(s) to "${password}".` +
    '\nEach user must change it on next login (must_change_password=true).\n'
);

// --- helpers ---------------------------------------------------------------

async function listAllUsers() {
  const all = [];
  const perPage = 1000;
  for (let page = 1; ; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) throw new Error(`listUsers: ${error.message}`);
    all.push(...data.users);
    if (data.users.length < perPage) break;
  }
  return all;
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
    const [, key] = m;
    let val = m[2];
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = val;
  }
}
