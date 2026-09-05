# Support & bug-reporting process

When something breaks, everyone needs to know the same thing: how to report it,
who answers first, and how fast a fix is owed. This is that shared process, so a
bug report is a tracked item with an owner and a clock — not a message lost in a
WhatsApp thread.

**The in-app reporter is the default way to report a problem.** It is on every
screen and captures the context automatically, which is what makes a report
actionable. Use the other channels only when it can't be used.

---

## How to report (in preference order)

### 1. In-app bug reporter — preferred
Signed in to the app, click **Report a problem** (bottom of the sidebar / support
control, present on every dashboard screen). Describe what happened; a screenshot
can be attached.

Why it's preferred: it captures the page you were on, your account and role, and
the browser automatically, and it **notifies Maintenance and the Super Admin
immediately** (in-app notification). Reports are readable by Maintenance and the
Super Admin at **Bug reports** in the app. Nothing to chase, nothing to describe
twice.

### 2. GitHub issue — for developers or Terence
For anything a developer would raise, or when Terence is triaging, open an issue
on this repository. Best for reproducible technical faults, and for anything that
needs a code discussion or links to a commit/PR.

### 3. WhatsApp / phone — fallback only
Use this **only if the app itself is down** (you can't sign in, or the reporter
won't submit). Message the first responder directly (contacts below) with what
broke and roughly when. They will open a tracked item on your behalf so it still
gets a clock.

---

## Who responds first

| Role | Person | Responsibility |
| --- | --- | --- |
| **Primary** | Simon — DJOU NINGAYE Simon Stephane | First responder; acknowledges and works the fix |
| **Backup** | Erwan — NGATCHOU NGEHEU Erwan Paul | Covers when Simon is unavailable |
| **Escalation** | Terence | Triage / escalation only — not a first responder |

A report goes to Simon first. If Simon is unavailable, Erwan picks it up. Terence
is brought in only for triage decisions or escalation, not routine fixes.

---

## Response times (SLAs, from the contract)

| Commitment | Deadline |
| --- | --- |
| **Acknowledgement** of any report | within **3 business days** |
| Fix — **critical security fault** | within **5 business days** |
| Fix — other covered fault | within **15 business days** |

**Critical** means: **data exposure, unauthorized access, or the system being
unusable.** Everything else is an "other covered fault".

Business days, not calendar days — the clock runs on working days.

### Escalation trigger
**After 3 critical bugs in one month, on-site presence is required within 48
hours.** This is a separate obligation from the fix SLAs above (tracked as its
own issue); the 48-hour on-site clock is in addition to the per-bug deadlines.

---

## What counts as critical (examples)

- A user can see or reach data they shouldn't (another seller's sales, the audit
  log without permission, a transaction by guessing a URL).
- Anyone can act without proper authorization (a Seller changing a price, an
  Administration account recording a sale).
- The app is unusable for its core job — sales cannot be recorded, receipts
  cannot be printed, or the app will not load at all.

If unsure whether something is critical, report it as normal and say why you
think it might be — the first responder makes the call.

---

## Who needs to know this process

Everyone who touches the system, so a fault has one path and one clock:

- **Terence** — escalation / triage owner.
- **Simon** — primary responder.
- **Erwan** — backup responder.
- **Mr. Ateba** (Seller) — reports via the in-app reporter; phone fallback if the
  app is down.
- **Stock Manager** (Phase 2) — same: in-app reporter first, phone fallback.

Share this file with all five, and point Mr. Ateba and the Stock Manager at the
**Report a problem** button specifically, so the preferred channel is the one
they reach for by reflex.

---

## Quick reference

- Something broke, app works → **Report a problem** in the app.
- Developer-level or Terence triaging → **GitHub issue**.
- App is down → **WhatsApp/phone** Simon (then Erwan).
- Acknowledged within **3 business days**; critical fixed in **5**, others in
  **15**; 3 criticals in a month → **on-site within 48 hours**.
