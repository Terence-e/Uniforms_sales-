# Handover

Everything an operator needs to run the system without the original developers in
the room (A-NFR-8): how to deploy, restore, create the first account, and reset a
password — plus the account structure and where the secrets live.

> **Keep this current.** Any change to how the system is deployed, restored, or
> administered — or to the account structure — updates this file **in the same
> PR** as the change. See [`CONTRIBUTING.md`](../CONTRIBUTING.md).

## Stack

| Piece | Where |
| --- | --- |
| Web app | Next.js (App Router) on **Vercel** |
| Database + Auth | **Supabase** (project `nswxwmsujrcxhbvjmrsl` — "UNi_form") |
| Secrets / env vars | [`docs/secrets.md`](secrets.md) (the registry) |
| Backups & restore | [`docs/backup-restore.md`](backup-restore.md) |
| Support / who responds | [`docs/support.md`](support.md) |

## Deploy

1. Push to the deployment branch; Vercel builds and deploys automatically.
2. Environment variables live in **Vercel → Project → Settings → Environment
   Variables**, mirroring `.env.example`. The names are the contract; values come
   from Supabase (see [`docs/secrets.md`](secrets.md)). Never commit real values.
3. Database schema is applied with the Supabase CLI from a machine with
   `SUPABASE_DB_URL` set:
   ```bash
   npm run db:push        # apply migrations
   npm run db:policies    # apply RLS policies (supabase/policies/*)
   ```
   Run `db:policies` after any restore or policy change — RLS is the real access
   control, not the UI.

## Restore a backup

Full procedure and the verification drill are in
[`docs/backup-restore.md`](backup-restore.md). Short version: restore into a
**throwaway** target, then `npm run verify:restore` — invariants must pass and the
fingerprint must match the source. Never restore over the live project.

## Create the first accounts

Accounts are created by the Super Admin only — there is no public sign-up
(A-FR-3.1). To seed the initial nine accounts (1 Seller, 5 Administration, 2
Maintenance, 1 Super Admin) into a fresh database:

```bash
npm run db:seed:users
```

This uses the service-role key and sets a shared temporary password with
`must_change_password = true`, so each user is forced to set their own on first
login (A-FR-3.2). Replace the placeholder names/domain in
`scripts/seed-users.mjs` with the real people and school domain before running
against production.

## Reset a password

- **Normal path:** the Super Admin opens **Accounts**, clicks **Reset password**
  for the user, and shares the temporary password securely. The user must change
  it at next login (A-FR-3.5). No email-based self-service reset exists.
- **Bulk / recovery:** `npm run db:reset:passwords` resets every account back to
  the shared temporary password (use with care).

## Account structure (Phase 1)

| Role | Count | Can do |
| --- | --- | --- |
| **Seller** (Mr. Ateba) | 1 | Production, sales, orders, alterations, returns, exchanges, cancellations. Never prices. |
| **Administration** | ~5 | Read-only everywhere: all views, reports, exports, audit log. No write path. |
| **Maintenance** (developers) | 2 | Full functional access, fully audited. |
| **Super Admin** | 1 | Accounts (create / activate / deactivate / delete), product catalogue, prices, size set, return-policy windows. |

- Accounts are **deactivated, never deleted** once they have activity — a
  deactivated user cannot log in, but their name stays on what they did (A-FR-P4).
  Delete is only permitted for an account with no activity on record.
- Roles are fixed; there is no role editor.
