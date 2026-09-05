<!--
  Keep docs current — see CONTRIBUTING.md. A reviewer should block this PR if a
  box below applies but its doc update is missing.
-->

## What & why

<!-- Brief summary. Reference requirement IDs (A-FR-*, A-NFR-*, …) where relevant. -->

## Docs-currency checklist

- [ ] This PR changes **deployment / restore / administration / account
      structure** → `docs/handover.md` updated **in this PR**.
- [ ] This PR adds a **secret or env var** → `docs/secrets.md` and `.env.example`
      updated **in this PR**.
- [ ] This PR captures something **learned during a maintenance visit** →
      `docs/handover.md` updated.
- [ ] This PR changes **agreed scope** → `docs/requirements.md` updated.
- [ ] **None of the above apply** — no doc change needed.

## Checks

- [ ] `npm run typecheck` passes
- [ ] `npm run lint` passes
- [ ] RLS/policy changes applied with `npm run db:policies` (if any)
