# Contributing

## Keep the docs current (docs-currency rule)

The handover doc and the secrets registry are only useful if they never drift
from reality. A document that lies is worse than no document. So changes to how
the system is run must carry their documentation **in the same pull request** —
not "later", which never comes.

**Rules — enforced in PR review (see the [PR template](.github/pull_request_template.md)):**

1. **Deployment / restore / administration / account structure** — any change to
   how someone would **deploy**, **restore**, or **administer** the system, or to
   the **account structure**, must update [`docs/handover.md`](docs/handover.md)
   in the same PR.
2. **New secret** — anything that adds a secret or environment variable must
   update the secrets registry, [`docs/secrets.md`](docs/secrets.md) (and
   `.env.example`, which lists every variable the app reads).
3. **Maintenance visits** — anything learned about the system during a monthly
   maintenance visit that affects the above updates
   [`docs/handover.md`](docs/handover.md).
4. **Requirements** — any change to agreed scope goes through a PR against
   [`docs/requirements.md`](docs/requirements.md), never chat or email.

A reviewer should **block** a PR that changes deploy/restore/admin/accounts or
adds a secret without the matching doc update. If a change genuinely needs no doc
update, tick the "no doc change needed" box in the PR template and say why.

### Quarterly sanity check

**Terence reviews [`docs/handover.md`](docs/handover.md) once a quarter** to
confirm it still matches reality. This is a scheduled review, not an incident
response — put it on the calendar (Jan / Apr / Jul / Oct). The repo also opens a
reminder issue automatically each quarter (see
`.github/workflows/quarterly-doc-review.yml`), but the calendar entry is the
backstop so it doesn't depend on anyone watching GitHub.

## General

- Commits and issues reference requirement IDs (`A-FR-*`, `A-NFR-*`, …).
- RLS is the real access control; after any policy change or restore, run
  `npm run db:policies`.
- Before opening a PR: `npm run typecheck` and `npm run lint` should pass.
