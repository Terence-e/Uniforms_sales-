# RLS verification

Direct-to-server proof that Row Level Security is doing the work, not the UI
(spec **A-NFR-5**, principle **P-3**, and acceptance criteria **A-16 #15 / #16**).

The requirements are explicit: permissions are enforced on the server, and the
system "will be tested by sending requests directly to the server, bypassing the
interface." `rls.test.mjs` is that test. It signs in as each of the four roles
against the same PostgREST endpoint the browser uses and, for **every table**,
attempts the reads and writes that role should and should not be allowed.

## What it checks

- **Every role × table combination**, for reads and for writes.
- Permitted writes take effect; forbidden writes do not.
- Reads follow the same rules (a blocked read returns nothing, not an error).
- The two named acceptance criteria, tagged in the output:
  - `#15` a **Seller cannot change a price** via the API (`products.update`)
  - `#16` an **Administration** user cannot **record a sale** via the API (`sales.insert`)

### How a verdict is trustworthy

It does **not** rely on the error code the client receives — a `NOT NULL`
violation and an RLS denial can look alike, and `BEFORE` triggers can fire ahead
of the RLS check. Instead each probe asserts the **outcome**: after acting as the
role, a separate **service-role** client (which bypasses RLS) checks whether the
row was actually written or changed. *Took effect == the policy allowed it.* That
is the security property being tested, checked directly.

## Running it

The probes write real rows, so run against a **disposable database** — a local
`supabase start` or a throwaway project — never production. The script cleans up
after itself, but a money database is not the place to discover it missed a row.

```bash
# 1. a database with the schema, policies and the nine seeded accounts
npm run db:reset          # applies migrations to the local stack
npm run db:policies       # applies supabase/policies/*
npm run db:seed:users     # creates the four roles used here

# 2. run the check
npm run test:rls
```

Exit code `0` = every role×table cell matched expectation; `1` = at least one
did not (CI fails the build); `2` = setup/config error (missing env, sign-in
failed).

## Configuration

Read from `.env.local` (falling back to the real environment):

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | project URL (required) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon/public key — the role clients sign in with this (required) |
| `SUPABASE_SERVICE_ROLE_KEY` | service-role secret — fixtures, verification, cleanup (required) |
| `SEED_EMAIL_DOMAIN` | login domain (default `fondation-rst.cm`) |
| `SEED_DEFAULT_PASSWORD` | the seeded password (default `Uniforme2026!`) |

The accounts must still carry the seeded password, so run this on a freshly
seeded database (before anyone has completed the forced first-login change).

## Reading the output

A row per check, a column per role, each cell `allow` / `deny`. A mismatch is
marked `! <actual>≠<expected>` and fails that row. Example:

```
  W products · change a price [#15]   deny       deny       deny       allow      ok
  W sales · record a sale [#16]        allow      ! allow≠deny  allow    allow      FAIL
```

(The second line is what a regression looks like — Administration managed to
record a sale, which must never happen.)

## As a CI check

```yaml
- run: npm run db:reset && npm run db:policies && npm run db:seed:users
- run: npm run test:rls
```
