#!/usr/bin/env node
/**
 * Seeds the nine Phase 1 accounts (spec A-2) into Supabase Auth and
 * public.profiles: one Seller, five Administration, two Maintenance, one
 * Super Admin.
 *
 * Accounts are created by the Super Admin only -- there is no public sign-up
 * (A-FR-3.1) -- so this runs with the service-role key and bypasses RLS. Never
 * ship that key to the browser and never commit it.
 *
 * Idempotent: re-running syncs each user's role and profile instead of failing
 * on "already registered". Passwords and the forced-change flag are only set
 * when the account is first created, so a user who has already chosen their own
 * password is not clobbered -- pass SEED_RESET_PASSWORD=1 to force a reset back
 * to the shared temporary password.
 *
 * Every account gets the same temporary password and must_change_password=true,
 * so each user is forced to change it on first login (A-FR-3.2). The app is
 * responsible for reading that flag and redirecting to a change-password screen.
 *
 * Environment (read from .env.local if present, else the real environment):
 *   NEXT_PUBLIC_SUPABASE_URL        project URL            (required)
 *   SUPABASE_SERVICE_ROLE_KEY       service-role secret    (required)
 *   SEED_EMAIL_DOMAIN               login email domain     (default below)
 *   SEED_DEFAULT_PASSWORD           shared temp password   (default below)
 *   SEED_RESET_PASSWORD=1           reset existing users' passwords too
 *
 * Usage:  npm run db:seed:users
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createClient } from '@supabase/supabase-js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
loadEnvFile(join(root, '.env.local'));

// --- configuration ---------------------------------------------------------

// Placeholder domain and password: override with the school's real domain and a
// fresh secret before running against production.
const DEFAULT_DOMAIN = 'fondation-rst.cm';
const DEFAULT_PASSWORD = 'Uniforme2026!';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const domain = (process.env.SEED_EMAIL_DOMAIN || DEFAULT_DOMAIN).toLowerCase();
const password = process.env.SEED_DEFAULT_PASSWORD || DEFAULT_PASSWORD;
const resetPassword = process.env.SEED_RESET_PASSWORD === '1';

if (!url || !serviceKey) {
  console.error(
    'Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.\n' +
      'Set them in .env.local (Supabase -> Project Settings -> API) and re-run.'
  );
  process.exit(1);
}

// The nine accounts. Replace the placeholder full names with the real people
// before go-live; only the Seller (Mr. Ateba) is named in the spec.
const USERS = [
  { local: 'ateba',        full_name: 'Mr. Ateba',                 role: 'seller' },
  { local: 'admin1',       full_name: 'Administration 1',          role: 'administration' },
  { local: 'admin2',       full_name: 'Administration 2',          role: 'administration' },
  { local: 'admin3',       full_name: 'Administration 3',          role: 'administration' },
  { local: 'admin4',       full_name: 'Administration 4',          role: 'administration' },
  { local: 'admin5',       full_name: 'Administration 5',          role: 'administration' },
  { local: 'maintenance1', full_name: 'Developer 1 (Maintenance)', role: 'maintenance' },
  { local: 'maintenance2', full_name: 'Developer 2 (Maintenance)', role: 'maintenance' },
  { local: 'superadmin',   full_name: 'Super Admin (Developer)',   role: 'super_admin' }
];

// --- run -------------------------------------------------------------------

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

const existing = await listAllUsers();
const summary = [];

for (const u of USERS) {
  const email = `${u.local}@${domain}`;
  const found = existing.get(email);
  let id;
  let action;

  if (found) {
    id = found.id;
    const update = {
      app_metadata: { ...found.app_metadata, role: u.role }
    };
    if (resetPassword) {
      update.password = password;
      update.email_confirm = true;
      update.user_metadata = {
        ...found.user_metadata,
        full_name: u.full_name,
        must_change_password: true
      };
    }
    const { error } = await admin.auth.admin.updateUserById(id, update);
    if (error) throw new Error(`update ${email}: ${error.message}`);
    action = resetPassword ? 'reset' : 'synced';
  } else {
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // no public email flow -- confirm immediately
      user_metadata: { full_name: u.full_name, must_change_password: true },
      app_metadata: { role: u.role }
    });
    if (error) throw new Error(`create ${email}: ${error.message}`);
    id = data.user.id;
    action = 'created';
  }

  // The on_auth_user_created trigger inserts a profile row with role 'seller';
  // this is the authoritative role assignment. profiles.role is the source of
  // truth the RLS policies read -- app_metadata above is only a convenience copy.
  const { error: pErr } = await admin
    .from('profiles')
    .upsert(
      { id, full_name: u.full_name, role: u.role, is_active: true },
      { onConflict: 'id' }
    );
  if (pErr) throw new Error(`profile ${email}: ${pErr.message}`);

  summary.push({ email, role: u.role, action });
}

console.log(`\nSeeded ${summary.length} account(s) at @${domain}:\n`);
for (const s of summary) {
  console.log(`  ${s.action.padEnd(8)} ${s.email.padEnd(32)} ${s.role}`);
}
console.log(
  `\nTemporary password for every account: ${resetPassword || existing.size === 0 ? password : '(unchanged for existing accounts)'}` +
    '\nEach user must change it on first login (must_change_password=true).\n'
);

// --- helpers ---------------------------------------------------------------

async function listAllUsers() {
  const map = new Map();
  const perPage = 1000;
  for (let page = 1; ; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) throw new Error(`listUsers: ${error.message}`);
    for (const u of data.users) {
      if (u.email) map.set(u.email.toLowerCase(), u);
    }
    if (data.users.length < perPage) break;
  }
  return map;
}

function loadEnvFile(path) {
  let text;
  try {
    text = readFileSync(path, 'utf8');
  } catch {
    return; // no .env.local -- rely on the real environment
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
