#!/usr/bin/env node
/**
 * Applies every file in supabase/policies/ to the database in SUPABASE_DB_URL.
 *
 * The files are idempotent (drop policy if exists + create policy), so running
 * this repeatedly is the intended workflow: edit a policy, re-run, done. It is
 * deliberately separate from `supabase db push` -- access control changes far
 * more often than table structure, and shouldn't need a new migration each time.
 */

import { readFileSync, readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const policiesDir = join(root, 'supabase', 'policies');

// Pick up SUPABASE_DB_URL from .env.local, same as scripts/seed-users.mjs.
loadEnvFile(join(root, '.env.local'));

const dbUrl = process.env.SUPABASE_DB_URL;
if (!dbUrl) {
  console.error(
    'SUPABASE_DB_URL is not set.\n' +
      'Get it from Supabase → Project Settings → Database → Connection string (URI),\n' +
      'or use the local one printed by `npx supabase start`.'
  );
  process.exit(1);
}

const files = readdirSync(policiesDir)
  .filter((name) => name.endsWith('.sql'))
  .sort();

if (files.length === 0) {
  console.error(`No .sql files found in ${policiesDir}`);
  process.exit(1);
}

// One transaction for the whole set: a half-applied policy file is worse than
// none at all, because the gap is invisible until someone reads the wrong row.
const sql = [
  'begin;',
  ...files.map(
    (name) =>
      `\n-- ${name} ${'-'.repeat(Math.max(0, 60 - name.length))}\n` +
      readFileSync(join(policiesDir, name), 'utf8')
  ),
  'commit;'
].join('\n');

const result = spawnSync('psql', [dbUrl, '-v', 'ON_ERROR_STOP=1', '-f', '-'], {
  input: sql,
  stdio: ['pipe', 'inherit', 'inherit']
});

if (result.error?.code === 'ENOENT') {
  console.error(
    'psql was not found on PATH.\n' +
      'Install the PostgreSQL client tools, or paste supabase/policies/*.sql\n' +
      'into the Supabase SQL editor in file-name order.'
  );
  process.exit(1);
}

if (result.status !== 0) process.exit(result.status ?? 1);

console.log(`Applied ${files.length} policy file(s): ${files.join(', ')}`);

// --- helpers ---------------------------------------------------------------

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
