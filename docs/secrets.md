# Secrets & environment variables

How credentials are stored, shared between the two developers, and injected into
the app. Read this before your first Supabase call — the app needs the anon key
and (for admin scripts) the service-role key available up front.

## Golden rules

- **Real values never go in git.** `.gitignore` ignores `.env*` except
  `.env.example`. A [pre-commit hook](#pre-commit-secret-scan) blocks accidental
  commits of env files and key-shaped strings.
- **`.env.example` is the template** — variable names and placeholders only, no
  real values. It is the contract: every var the app reads is listed there.
- **Nobody shares secrets over chat or email.** Both developers are members of
  the Supabase and Vercel projects and copy values straight from those
  dashboards. That is what lets a new checkout run locally without asking anyone.

## The variables

| Variable | Sensitivity | Where to get it | Lives in |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | public | Supabase → Project Settings → API | `.env.local`, Vercel (Prod+Preview) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | public (RLS-guarded) | Supabase → Project Settings → API | `.env.local`, Vercel (Prod+Preview) |
| `SUPABASE_SERVICE_ROLE_KEY` | **secret — bypasses RLS** | Supabase → Project Settings → API | `.env.local`, Vercel (Prod+Preview, server only) |
| `SUPABASE_DB_URL` | **secret — DB password** | Supabase → Connect / Settings → Database | `.env.local` only (used by `db:policies`) |
| `SEED_EMAIL_DOMAIN`, `SEED_DEFAULT_PASSWORD` | low | chosen by the team | `.env.local` only (used by `db:seed:users`) |
| `NEXT_PUBLIC_SCHOOL_*`, `NEXT_PUBLIC_CURRENCY` | public | school details | `.env.local`, Vercel (Prod+Preview) |
| `NEXT_PUBLIC_SENTRY_DSN` | public by design | Sentry → Settings → Client Keys (DSN) | `.env.local`, Vercel (Prod+Preview) |
| `SENTRY_AUTH_TOKEN` | **secret** | Sentry → Settings → Auth Tokens | Vercel/CI only (source-map upload at build) |

`SUPABASE_DB_URL` and the `SEED_*` vars are for local admin scripts only — they
do **not** belong in Vercel's runtime env.

## Who holds what

Both developers have **full access** to the Supabase and Vercel projects, so
either can retrieve any value themselves. Record the actual people here:

| Person | Supabase | Vercel | Sentry |
|---|---|---|---|
| _Developer 1 (name)_ | Owner/Admin | Member | Member |
| _Developer 2 (name)_ | Admin | Member | Member |

> Replace the placeholder names before this goes to the wider team.

## Local setup

```bash
cp .env.example .env.local     # then fill values from the dashboards above
npm install                    # also enables the git hooks (see below)
npm run dev
```

Fill each value from the dashboard column in the table — never by pasting from a
chat message.

## Vercel (Production + Preview)

Set the vars marked "Vercel" above in **Vercel → Project → Settings →
Environment Variables**, for both the **Production** and **Preview** environments.
Keep `SUPABASE_SERVICE_ROLE_KEY` and `SENTRY_AUTH_TOKEN` as non-`NEXT_PUBLIC_`
(server-only) entries. Redeploy after changing any env var — Vercel bakes them in
at build/deploy time.

## Rotation

Rotate on a suspected leak, or when a developer leaves the project.

| Secret | How to rotate |
|---|---|
| Anon / service-role key | Supabase → Project Settings → API → **roll** the key, then update `.env.local` (both devs) and Vercel, and redeploy. |
| Database password (`SUPABASE_DB_URL`) | Supabase → Settings → Database → **Reset database password**; update `.env.local`. |
| Seed password | Change `SEED_DEFAULT_PASSWORD`; re-run `SEED_RESET_PASSWORD=1 npm run db:seed:users`. |
| Sentry DSN | Sentry → Settings → Client Keys → revoke/regenerate; update `.env.local` + Vercel. |
| Sentry auth token | Sentry → Auth Tokens → revoke/create; update Vercel/CI only. |

After any rotation: update every store (each `.env.local`, Vercel Prod, Vercel
Preview), redeploy, and confirm the app still boots.

## Pre-commit secret scan

`.githooks/pre-commit` runs automatically (enabled by the `prepare` script on
`npm install`, which sets `core.hooksPath` to `.githooks`). It:

- refuses to commit any `.env*` file except `.env.example`, and
- scans staged changes for JWT/service-role keys, Postgres URLs with inline
  passwords, private-key blocks, and real Sentry DSNs.

Placeholders (like those in `.env.example`) are allowed. In a genuine emergency
you can bypass it with `git commit --no-verify`, but treat that as a red flag.

If you ever need to confirm nothing leaked historically:

```bash
git log --all -p -S 'eyJ' -- .     # search history for JWT-shaped strings
```
