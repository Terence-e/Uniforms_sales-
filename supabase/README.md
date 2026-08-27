# Supabase

## Layout

- `migrations/` — versioned structural changes. Applied by `supabase db push`.
  These create tables, functions and triggers, and turn **on** row level
  security. They deliberately do not define any policies.
  Each migration is paired with a `<version>_<name>_down.sql` rollback in the
  same folder (e.g. `20260101000000_init_down.sql`). The Supabase CLI has no
  down-migration concept, so these are hand-applied rollbacks — **never run them
  with `db push`/`db reset`.** See "Rolling back" below for the important
  version-collision caveat.
- `policies/` — the RLS rules themselves, one file per table group. Every
  statement is `drop policy if exists` + `create policy`, so the whole directory
  can be re-applied at any time. This is the source of truth for access control;
  changes made by clicking around the Supabase dashboard will be overwritten.

The split exists so a policy can be reviewed and corrected as a diff on one
file, instead of being buried in whichever migration first introduced it.

## First-time setup

```bash
npx supabase login
npx supabase link --project-ref <your-project-ref>

npm run db:push       # structure
npm run db:policies   # access control
npm run db:types      # regenerate src/types/database.types.ts
```

`db:policies` needs `SUPABASE_DB_URL` — the connection string from
Project Settings → Database → Connection string (URI). Keep it out of git.

## Seeding the user accounts

```bash
npm run db:seed:users   # creates the nine Phase 1 accounts (spec A-2)
```

Run this after `db:push` and `db:policies`. It reads
`NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` from `.env.local`,
creates one Seller, five Administration, two Maintenance and one Super Admin,
and sets each profile's role. It is idempotent — re-running syncs roles without
recreating users. Override `SEED_EMAIL_DOMAIN` and `SEED_DEFAULT_PASSWORD`, and
pass `SEED_RESET_PASSWORD=1` to reset existing passwords back to the temporary
one. Every account is flagged `must_change_password` for first login (A-FR-3.2).

## Local development

```bash
npx supabase start    # requires Docker
npm run db:reset      # replays every migration against the local database
```

`db:reset` also runs `seed.sql`, which loads a small uniform catalogue.

## Rolling back

Each migration has a matching `_down.sql` file in `migrations/`. They are
**manual** — apply them by hand (psql or the SQL editor), never with `db push`,
and always in the reverse of the order they were pushed:

```
20260101000200_roles_down.sql   # first
20260101000100_stock_down.sql
20260101000000_init_down.sql     # last
```

> **Caveat — version collision.** A `_down.sql` file shares the numeric version
> prefix of its up migration (both `20260101000000`), and the Supabase CLI keys
> migrations by that number. So you cannot rely on `db push`/`db reset` while
> these live in `migrations/`: the CLI sees a duplicate version and will either
> reject it or, worse for `db reset`, replay the rollback in sequence and drop
> objects the next migration needs. If you use the automated CLI workflow,
> temporarily move the `_down.sql` files out of `migrations/` first, or apply all
> migrations by hand. (Renaming the down files so they don't start with the
> timestamp — e.g. `init_down.sql` — makes the CLI ignore them and removes this
> hazard entirely.)

Two more caveats, both spelled out in the files themselves:

- **`20260101000200_roles.sql`** — revert the policy files (from git history) to
  their pre-roles form *before* running its down file, and reassign any account
  still holding `administration`/`maintenance`, since Postgres cannot drop enum
  values and the type has to be recreated.
- Rolling back `roles` restores the two-role model, so re-run `db:policies` only
  against policy files that match whichever role model is live.

## After changing the schema

1. Write a new file in `migrations/` — never edit one that has already been
   pushed to a shared environment.
2. Write its rollback as `<version>_<name>_down.sql` in `migrations/`. Every
   migration ships with one; note anything Postgres can't cleanly reverse (enum
   values, dropped columns) in the file itself, and mind the version-collision
   caveat above.
3. Update the matching file in `policies/` if the change affects access.
4. Run `npm run db:types` so `Database` in `src/types/database.types.ts` matches
   the real schema. Every Supabase client in this app is typed against it, so a
   stale file turns into wrong types rather than a runtime error.
