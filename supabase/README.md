# Supabase

## Layout

- `migrations/` — versioned structural changes. Applied by `supabase db push`.
  These create tables, functions and triggers, and turn **on** row level
  security. They deliberately do not define any policies.
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

## Local development

```bash
npx supabase start    # requires Docker
npm run db:reset      # replays every migration against the local database
```

`db:reset` also runs `seed.sql`, which loads a small uniform catalogue.

## After changing the schema

1. Write a new file in `migrations/` — never edit one that has already been
   pushed to a shared environment.
2. Update the matching file in `policies/` if the change affects access.
3. Run `npm run db:types` so `Database` in `src/types/database.types.ts` matches
   the real schema. Every Supabase client in this app is typed against it, so a
   stale file turns into wrong types rather than a runtime error.
