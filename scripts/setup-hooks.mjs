#!/usr/bin/env node
/**
 * Points git at the repo's shared hooks (.githooks) so the secret-scanning
 * pre-commit hook runs for everyone after `npm install`. Runs via the "prepare"
 * lifecycle script. No-ops outside a git checkout (e.g. CI tarball installs).
 */
import { execSync } from 'node:child_process';

try {
  execSync('git rev-parse --git-dir', { stdio: 'ignore' });
} catch {
  process.exit(0); // not a git working copy -- nothing to wire up
}

try {
  execSync('git config core.hooksPath .githooks');
  console.log('Git hooks enabled (core.hooksPath = .githooks).');
} catch (err) {
  console.warn('Could not set core.hooksPath:', err.message);
}
