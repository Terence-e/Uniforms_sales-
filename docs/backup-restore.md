# Backup & restore

**Spec: A-NFR-6 — "Automatic daily database backup, verified restorable before
go-live. This is money data."**

The database (Supabase Postgres) holds every sale, payment, stock movement and
audit entry. A backup that has never been restored is a guess, not a backup, so
this document covers both halves: making backups happen automatically, and
proving one can be brought back with the money intact.

Two of the steps below are performed in the Supabase dashboard / a terminal and
cannot be committed as code — do them once before go-live and re-run the drill
whenever the schema changes materially. The verification is scripted:
`npm run verify:restore`.

---

## 1. Enable automatic daily backups

### Pro plan (recommended for go-live)
Supabase runs **daily backups with 7-day retention** on paid projects, and
**Point-in-Time Recovery (PITR)** as an add-on.

1. Supabase dashboard → the project (`nswxwmsujrcxhbvjmrsl`) → **Database → Backups**.
2. Confirm **Scheduled backups: Daily** is shown with a recent timestamp.
3. (Strongly recommended for money data) enable **PITR** — it lets you restore
   to any second, not just the last nightly snapshot, so a bad afternoon of
   edits doesn't cost the whole day.

> The **Free** plan does **not** run automated daily backups. Either upgrade to
> Pro before go-live (the right answer for money data), or use the fallback
> below in the interim.

### Free-tier / belt-and-braces fallback: scheduled `pg_dump`
A logical dump on a schedule, independent of the plan. Example GitHub Actions
job (store `SUPABASE_DB_URL` as a repository secret — the pooler/session URI
from **Project Settings → Database → Connection string**):

```yaml
# .github/workflows/db-backup.yml
name: Daily DB backup
on:
  schedule: [{ cron: '0 2 * * *' }]   # 02:00 UTC daily
  workflow_dispatch:
jobs:
  dump:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: |
          sudo apt-get update && sudo apt-get install -y postgresql-client
          STAMP=$(date -u +%Y%m%d-%H%M)
          pg_dump "$SUPABASE_DB_URL" --no-owner --no-privileges -Fc -f "backup-$STAMP.dump"
        env:
          SUPABASE_DB_URL: ${{ secrets.SUPABASE_DB_URL }}
      - uses: actions/upload-artifact@v4
        with: { name: db-backup, path: 'backup-*.dump', retention-days: 30 }
```

Swap the `upload-artifact` step for upload to off-site storage (S3/GCS) for real
durability; CI artifacts are a convenience, not an archive.

---

## 2. Perform a test restore (the drill)

Restore into a **throwaway** target — never over the live project.

### Option A — restore a Supabase snapshot to a new project (Pro/PITR)
Dashboard → **Database → Backups → Restore**, targeting a **new** project you
create for the drill. Wait for it to finish.

### Option B — restore a `pg_dump` to a scratch database (any plan)
```bash
# a local scratch db, or a fresh Supabase project's connection string
createdb uniforms_restore_test                       # or use a new project URI
pg_restore --no-owner --no-privileges \
  -d "postgresql://…/uniforms_restore_test" backup-YYYYMMDD-HHMM.dump
```

---

## 3. Verify data is intact after restore

`scripts/verify-restore.mjs` prints a **fingerprint** (row count per table + money
/ stock checksums) and runs **invariants** that must always hold. Requires `psql`
on PATH.

```bash
# 1. Snapshot the SOURCE (uses SUPABASE_DB_URL from .env.local) — do this first,
#    ideally right before the drill so the two are comparable.
npm run verify:restore > source.txt

# 2. Run against the RESTORED copy.
npm run verify:restore -- "postgresql://…/uniforms_restore_test" > restore.txt

# 3. They must match, and both must end in PASS.
diff source.txt restore.txt && echo "IDENTICAL"
```

**Pass criteria**

- The FINGERPRINT block is identical between source and restore (same row counts
  per table, same `sales_total_sum`, same `stock_movement_qty_sum`, …).
- The INVARIANTS block reports **0** for every check on the restore (totals equal
  their parts; `stock_levels` equals the sum of its movements; no orphaned lines).
  The script exits non-zero if any invariant is violated.

A matching fingerprint proves every row came back; the invariants prove the money
still adds up. Both green = **verified restorable**.

---

## 4. Restore procedure for a real incident (runbook)

1. **Stop writes.** In Vercel, take the app to maintenance (or pause the
   deployment) so nothing new is written mid-restore.
2. **Choose the target time.** With PITR, pick the second just before the bad
   event; otherwise use the most recent nightly snapshot.
3. **Restore** (dashboard → Database → Backups → Restore). For a
   `pg_dump`-based recovery, restore into the project’s database from the latest
   good `.dump`.
4. **Re-apply access control.** Restores bring back tables and data; re-run the
   RLS policies to be certain they match this codebase:
   `npm run db:policies`.
5. **Verify.** `npm run verify:restore` against the restored database — invariants
   must be 0, and the fingerprint should match your last known-good snapshot.
6. **Sanity-click.** Sign in as the Super Admin, open **Reports → Daily
   reconciliation** for a known day and confirm the figures; open a recent
   receipt.
7. **Resume writes** (redeploy / lift maintenance).
8. **Record it.** Note the incident, the restore point, and any data gap in the
   audit trail.

> Auth users (`auth.*`) live in Supabase Auth. A Supabase snapshot restore
> includes them; a `pg_dump` of the `public` schema does **not**. If you restore
> from a public-only dump into a fresh project, re-create the accounts with
> `npm run db:seed:users` (then have each user reset their password).

---

## Pre-go-live checklist (A-NFR-6 acceptance)

- [ ] Daily backup is running and visible in **Database → Backups** (Pro plan) —
      or the scheduled `pg_dump` job has a green run and a stored artifact.
- [ ] PITR enabled (recommended for money data).
- [ ] A test restore into a throwaway target completed without error.
- [ ] `npm run verify:restore` on the restore: invariants **PASS**, fingerprint
      matches the source.
- [ ] This procedure has been walked once end-to-end by whoever holds the
      Supabase account, so it is not first attempted during an incident.
