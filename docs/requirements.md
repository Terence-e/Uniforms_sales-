# School Uniform Sales & Stock Management — Requirements

> **Single source of truth.** This is the canonical requirements document
> (**v2.5, 17 August 2026**, author Eloundou Gaston Terence). Issues and commits
> reference the requirement IDs in this file (`A-FR-*`, `B-FR-*`, `A-NFR-*`,
> `B-NFR-*`). **Any change to requirements goes through a pull request** — never
> chat or email — so the repository never drifts from the agreed scope.
>
> Converted to Markdown from the original PDF; the wording is preserved verbatim.

---

## Table of Contents

- School Uniform Sales & Stock Management
- 1. How to use this document
- 2. Why two phases
- 3. Principles that apply to both phases
- 4. What is shared between the phases
- PART A -- PHASE 1: UNIFORM PRODUCTION & SALES

- A-1. What this system does
- A-2. Users and roles
- A-3. Authentication
- A-4. Product catalogue
- A-5. Production and stock
- A-6. Recording a sale
- A-7. Receipts and reference numbers
- A-8. Returns and size exchanges
- A-9. Orders and alterations
- A-10. Cancellation
- A-11. Audit log
- A-12. Reports
- A-13. Technical constraints
- A-14. Out of scope for Phase 1
- A-15. Build order -- four days
- A-16. Acceptance criteria -- Phase 1
- A-17. Open points -- Phase 1
- PART B -- PHASE 2: SCHOOL STOCK MANAGEMENT
- B-1. Context
- B-2. Users and roles
- B-3. Platform and hosting
- B-4. Authentication
- B-5. Item catalogue
- B-6. Stock In
- B-7. Stock Out
- B-8. Corrections
- B-9. Stock levels and alerts
- B-10. Audit log
- B-11. Reports
- B-12. Initial data migration
- B-13. Technical constraints
- B-14. Out of scope for Phase 2
- B-15. Build order -- Phase 2
- B-16. Acceptance criteria -- Phase 2
- B-17. Open points -- Phase 2
- 5. Design decisions and reasoning
- 6. Summary of deadlines

School Uniform Sales & Stock Management

Version: 2.5 -- supersedes all earlier drafts Date: 17 August 2026 Author: Eloundou
Gaston Terence Status: For development team -- Phase 1 starts now

## 1. How to use this document

This document covers two separate deliveries. Read Part A first. Do not start Part B until
Part A is finished and deployed.

Part       Scope                      Deadline                  Hosting
                                                                Cloud
Part A --  Uniform production, sales  Friday 21 August 2026 (4
Phase 1    and receipts               working days)             School
                                                                server
Part B --  General school stock       31 August 2026
Phase 2    management
Every requirement has an ID (A-FR-x.y, B-FR-x.y). Use these IDs in commits, issues and
questions so we are all referring to the same thing.

Marker  Meaning
MUST    Blocking. The delivery is not accepted without it.
SHOULD  Important, but only after every MUST in that phase is done.
LATER   Explicitly out of scope. Do not build it.

These documents describe what the system must do. Implementation, libraries and
internal structure are the team's decision, provided every requirement is met.

## 2. Why two phases

Uniform sales are happening right now and are handled entirely on paper. That is the
urgent problem, and it is why Phase 1 jumped the queue.

The general stock system -- chalk, brooms, exercise books, cleaning supplies -- is still
going ahead. Nothing in Part B is cancelled. It simply comes second.

The two systems are independent. They do not share a database, they are hosted
differently, and neither depends on the other running. What they do share is a set of
principles (§3) and a fair amount of reusable code -- see §4.

Neither system touches the school's existing administration software.

## 3. Principles that apply to both phases

These are non-negotiable in both parts. They exist because the entire point of both systems
is accountability.

**P-1** -- Nothing is ever edited or deleted. Sales, payments, stock movements and audit
entries are immutable once saved. A mistake is corrected by recording a new, linked
transaction that references the original. Both remain visible forever. An interface that can
delete a transaction destroys the guarantee the school is paying for.

**P-2** -- Everything is audited. Every action by every user, including the developers, is
recorded with who, what, when, the previous value and the new value. There are no
exemptions for any role.

**P-3** -- Permissions are enforced on the server. Hiding a button in the interface is not a
permission check. Both systems will be tested by sending requests directly to the server,
bypassing the interface.
**P-4** -- Accounts are deactivated, never deleted. A deactivated user cannot log in, but
their name stays attached to everything they did.

**P-5** -- The interface is fully bilingual, French and English. The school is bilingual. Both
languages must be complete -- no half-translated screens. All strings go through a
translation layer from the first commit; retrofitting this never happens in practice.

**P-6** -- User-entered data is never translated. Names, classes, item names, notes and
reasons are stored exactly as typed, in whichever language the user used.

**P-7** -- Mobile-first. Both systems will be used on a phone, standing up, often in poor light.
Large touch targets, minimal typing, searchable lists instead of long dropdowns.

**P-8** -- Money and stock figures are never typed twice. Totals and quantities are
computed by the system from their component parts, never entered manually as a
summary.

## 4. What is shared between the phases

Building Phase 1 with Phase 2 in mind saves roughly a day. These parts should be written
to be reused:

   - Authentication and role handling
   - The audit log -- model, write path and viewer
   - The bilingual translation layer
   - PDF and Excel export generation
   - The product/item catalogue pattern: free-text fields with autocomplete, duplicate

         warnings, archive instead of delete
   - The stock movement pattern: immutable movements, quantity derived from them,

         corrections as new linked entries

Do not build a shared library or a monorepo for two systems on two different hosts under
this kind of deadline. Copy the code across and move on.

## PART A -- PHASE 1: UNIFORM PRODUCTION & SALES

Deadline: Friday 21 August 2026, end of day. Absolute cut-off: Saturday 22 August,
02:00. This is the urgent delivery.

### A-1. What this system does

School uniforms are made and sold in the same place. Mr. Ateba runs it. He needs to:

1. Record uniforms as they are produced, so stock goes up
2. Record a sale
3. Take payment in cash, in full, on the spot
4. Print a receipt for the parent
5. Take orders for garments that are not made yet, and track them until collection
6. Take garments in for resizing and track them until they go back
7. Handle returns and size exchanges
8. Know how many finished uniforms he has, by garment and size, and how many are

      already owed to orders
9. Produce a cash reconciliation at the end of each day

The administration needs to see all of it and change none of it.

Currency: FCFA, whole numbers, no decimals.

Two constraints specific to this phase:

- Cloud-hosted, not on the school server. No time to deploy on-premises.
- No offline mode. None at all. Do not build one.

### A-2. Users and roles

Role         Accounts        Access
                             Production, sales, orders, alterations, returns,
Seller       1 (Mr. Ateba)   exchanges, cancellations. Cannot change prices.
                             Read-only. All views including the open-jobs list, all
Administration 5             reports, all exports, audit log.
                             Full functional access. Fully audited like anyone else.
Maintenance  2
Super Admin  (developers)    Accounts, product catalogue, prices.

Around 9 accounts in total.

**A-FR-2.1** (MUST) -- The Seller can never modify a price, in the catalogue or on the sale
screen. Prices are Super Admin only.

**A-FR-2.2** (MUST) -- Administration accounts have no write path anywhere in the system.

### A-3. Authentication

**A-FR-3.1** (MUST) -- Email and password. Accounts created by the Super Admin only. No
public sign-up.

**A-FR-3.2** (MUST) -- Forced password change on first login.
**A-FR-3.3** (MUST) -- Failed logins are rate-limited and audited.

**A-FR-3.4** (MUST) -- Session timeout: 12 hours for the Seller, 2 hours for everyone else.

**A-FR-3.5** (MUST) -- Password reset is performed by the Super Admin by issuing a
temporary password. No email-based self-service reset.

### A-4. Product catalogue

**A-FR-4.1** (MUST) -- A product is a garment plus a size, with its own price and its own
stock quantity. Example: Boys' shirt -- size 10 -- 4,500 FCFA.

Field                Required  Notes
Garment                 Yes    e.g. "Boys' shirt", "Girls' skirt", "PE shorts"
Size                    Yes    Numeric for now -- see A-FR-4.2
Price                   Yes    FCFA, whole number
Current quantity        Yes    Derived from movements, see A-5
Low-stock threshold      No    Optional, per product
Active / archived       Yes    Archived products cannot be sold

**A-FR-4.2** (MUST) -- Sizes are numeric for now, but the field must stay flexible. Store
the size as a text label, not as an integer, and do not build a fixed size list, a size enum, or
logic that assumes sizes sort numerically. The school has not finally confirmed whether
sizes will be numeric (7, 8, 10, 12), letter-based (S, M, L, XL) or measurement-based.
Numeric is the working assumption; if it changes, it must be a data change, not a code
change. Use autocomplete on previously entered values so that "10" and "Size 10" do not
become two products.

**A-FR-4.3** (MUST) -- Products are created manually by the Super Admin. No file import.

**A-FR-4.4** (MUST) -- Duplicate warning when garment + size matches an existing product.

**A-FR-4.5** (MUST) -- Price changes are audited with old value, new value, who and when.
Price changes are never retroactive -- a completed sale keeps the price at which it was
sold.

**A-FR-4.6** (MUST) -- Products are archived, never deleted.

### A-5. Production and stock

Uniforms are manufactured on site, in the same place they are sold. Stock therefore goes up
continuously as garments are finished, rather than arriving as deliveries. This is the main
structural difference from an ordinary shop.

**A-FR-5.1** (MUST) -- A product's current quantity is derived from its movements. It is
never a manually edited number.
quantity = produced + returned + positive adjustments
              - sold - negative adjustments

**A-FR-5.2** (MUST) -- Production entry. The Seller records finished garments entering
stock:

Field              Required  Notes
Product               Yes    Garment + size
Quantity produced     Yes    Positive number
Date                  Yes    Defaults to today
Produced by            No    Free text with autocomplete -- the tailor's name
Note                   No    Free text

**A-FR-5.3** (MUST) -- Multiple products can be entered in a single production batch -- five
shirts in size 8 and three in size 10 recorded together, not as two separate trips through the
form.

**A-FR-5.4** (MUST) -- A production entry increases stock and is audited.

**A-FR-5.5** (MUST) -- Stock adjustment with a mandatory reason, for physical counts,
damage, defective garments or loss. May be positive or negative.

**A-FR-5.6** (MUST) -- Selling below available stock warns, it does not block. The Seller
is standing in front of the shelf. If the system and the shelf disagree, the shelf is right -- a
garment may have been finished and not yet entered. He confirms, the sale proceeds, and
the override is audited. Blocking the sale is the fastest way to push him back to paper.

**A-FR-5.7** (SHOULD) -- Low-stock badge on the product list when quantity is at or below
the product's threshold. Visual only -- no alerts, no reminder cadence, no notifications.
That is Phase 2.

**A-FR-5.8** (SHOULD) -- A daily production view: what was made today, by product and
by tailor.

**A-FR-5.9** (LATER) -- Raw materials: fabric, thread, buttons, and consumption per
garment. Not in Phase 1. This is the natural candidate for Phase 3.

### A-6. Recording a sale

The most-used screen in the system. It must be fast -- parents queue.

**A-FR-6.1** (MUST) -- Fields:

Field                  Required  Notes
Student name              Yes    Free text
Class                     Yes    Free text with autocomplete
Parent name               Yes    Free text
Field                Required  Notes
Parent phone             No    Free text
Line items              Yes    Product + quantity. Several lines per sale.
Discount                 No    Amount, with a mandatory reason if used
Payment method          Yes    Cash / MoMo / Orange Money -- see A-FR-6.3
Payment reference        No    Transaction ID for mobile money
Payment received by     Yes    Defaults to the logged-in user, changeable
Note                     No    Free text

**A-FR-6.2** (MUST) -- Payment is cash, in full, on the spot. There is no instalment
tracking, no partial payment, no balance due and no outstanding-payments list. A sale is
complete when it is recorded. Do not build any of that machinery.

**A-FR-6.3** (MUST) -- The payment method must be recorded on every transaction. It is
a required field with three options: Cash, MoMo, Orange Money. The method appears on
the receipt and drives the daily reconciliation.

**A-FR-6.4** (MUST) -- The method is declared, not verified. The system does not connect
to any mobile money provider and cannot confirm that a transfer actually arrived. It
records what the seller states was received. Two consequences the team must build for:

   - An optional payment reference field (transaction ID) is offered for MoMo and
         Orange Money, so a claimed transfer can be checked manually against the provider's
         statement later.

   - The daily report separates cash from mobile money and never merges them into
         one figure -- see A-FR-12.1. Only cash should be in the box; mobile money is
         verified against the phone.

**A-FR-6.5** (MUST) -- The method list is exactly these three values, stored as a fixed set.
Do not build a payment-method editor.

**A-FR-6.6** (MUST) -- Unit prices come from the catalogue and are not editable on the sale
screen. Any reduction goes through the discount field, which requires a reason and is
audited.

**A-FR-6.7** (MUST) -- The total is calculated by the system, never typed in.

**A-FR-6.8** (MUST) -- Product selection is searchable by garment name and size. Not an
eighty-item dropdown.

**A-FR-6.9** (MUST) -- Saving a sale immediately produces a receipt (A-7). It decreases stock
when the garment is handed over on the spot; if the garment is not available it becomes an
order instead -- see A-9.

**A-FR-6.10** (MUST) -- Sales are immutable. A mistake is fixed by cancellation (A-10), never
by editing.
**A-FR-6.11** (SHOULD) -- Optional amount tendered field with automatic change
calculation, shown only when the method is Cash. Small feature, saves real mistakes at the
counter.

### A-7. Receipts and reference numbers

Reference numbers

**A-FR-7.1** (MUST) -- Every document the system produces carries a human reference,
sequential and gap-free within its own type and year:

Prefix  Document
SAL     Sale
ORD     Order
COL     Collection of an order
ALT     Alteration
RTN     Return or exchange

Format: SAL-2026-0001, ORD-2026-0014, ALT-2026-0003.

**A-FR-7.2** (MUST) -- References are never reused and never reassigned. A cancelled
document keeps its number. A gap in a sequence looks like a concealed transaction, which
is exactly why the numbering is sequential rather than random.

**A-FR-7.3** (MUST) -- The prefixes above are fixed codes, not abbreviations, and are
never translated. SAL stays SAL on a French receipt. Translating them would give the same
document two different references, which defeats the purpose. The bilingual label next to
the code carries the meaning -- Réf. vente / Sale ref.

**A-FR-7.4** (MUST) -- Separately from the human reference, every record has a UUID as its
database primary key, and URLs use the UUID, never the sequential number.
/sale/47 must not be a valid address -- changing 47 to 48 would otherwise walk through
other people's transactions. Row Level Security is the real protection, but a non-
enumerable URL removes the whole class of failure if RLS is misconfigured under deadline
pressure. The UUID is never shown to a user and never printed.

**A-FR-7.5** (MUST) -- A document derived from another prints both references. A
collection slip shows its own COL-2026-0007 and the ORD-2026-0014 it closes. A return
shows the SAL it reverses. Following the chain must not require a database query.

**A-FR-7.6** (MUST) -- Search is the primary way transactions are found, not the
reference number. Most parents arrive without their paper. The search box must accept,
in one field: reference number, student name, parent name, parent phone. Results are
filterable by date range and by status. Build this properly -- it will be used far more than
the reference lookup.
**A-FR-7.7** (SHOULD) -- A small QR code on each printed document encoding its
reference, so a parent who brings the paper back can be found by scanning rather than
typing. Only after every MUST is done.

Receipt contents

**A-FR-7.8** (MUST) -- Receipt contents:

   - School name and logo
   - Reference number, date and time
   - Transaction type: Sale / Return / Exchange
   - Student name and class
   - Parent name
   - Line items: garment, size, quantity, unit price, line total
   - Discount and its reason, if any
   - Total paid
   - Payment method -- Cash / MoMo / Orange Money, and the payment reference if

         there is one
   - Recorded by -- the user who entered the transaction
   - Payment received by -- the person who physically took the money
   - Signature lines for seller and parent

**A-FR-7.9** (MUST) -- Recorded by and Payment received by are separate fields, both printed
and both stored. The audit question is who accepted the money, which is not necessarily
who typed it. They will usually be the same person, and that is fine.

**A-FR-7.10** (MUST) -- Receipts are bilingual. Every label appears in French and English
on the same receipt -- Total / Total, Mode de paiement / Payment method, Reçu par /
Received by, Élève / Student, Classe / Class. One template only, so nobody has to pick
a language while a queue is waiting, and neither language community complains. Keep the
layout tight.

**A-FR-7.11** (MUST) -- Output is a PDF sized for A5, two per A4 sheet to halve paper cost,
with a plain A4 option available. It must print correctly from a normal browser print
dialogue on a normal office printer.

**A-FR-7.12** (MUST) -- Receipts can be reprinted at any time. A reprint is stamped
DUPLICATA / DUPLICATE and is audited.

**A-FR-7.13** (LATER) -- Thermal printer support. The hardware is not yet chosen. This is a
template change, not an architecture change, so do not design around it now.

### A-8. Returns and size exchanges

Wrong size is the single most common event in uniform sales. This is not an edge case and
it is not optional.
**A-FR-8.1** (MUST) -- Exchange -- return a garment and take a different one, referencing
the original sale:

   - Same price: no money moves
   - New garment costs more: the difference is collected in cash
   - New garment costs less: the difference is refunded, and the refund method is

         recorded
   - Both stock quantities update

**A-FR-8.2** (MUST) -- Return -- a garment is given back without replacement. Refund
issued, with the refund method recorded. Stock increases.

**A-FR-8.3** (MUST) -- Every return and exchange requires a mandatory reason and
references the original sale.

**A-FR-8.4** (MUST) -- Returns and exchanges produce their own receipt, clearly marked as
such.

**A-FR-8.5** (MUST) -- A refund does not have to use the same method as the original
payment. A MoMo payment may be refunded in cash. The original method and the refund
method are both recorded, and the daily report shows both.

**A-FR-8.6** (MUST) -- The original sale is never modified. The return is a separate linked
transaction; both stay visible in history.

Return and exchange policy

**A-FR-8.7** (MUST) -- The system enforces a time-and-condition policy, with different
windows for exchange and for refund. Exchange is deliberately the more generous of the
two -- a wrong size is the school's problem to solve, whereas money back is not.

Unworn  Exchange (swap for another garment)  Refund (money back)
Worn    Within 3 months of the sale          Within 1 month of the sale
        Within 1 week of the sale            Not permitted

The three-month and one-week figures are the school's stated rule. The one-month refund
window and the no-refund-on-worn rule are proposed defaults pending confirmation --
see A-17.

**A-FR-8.8** (MUST) -- All four values are settings, editable by the Super Admin, never
hardcoded. A policy that requires a code change to adjust will be ignored within a month.

**A-FR-8.9** (MUST) -- Condition is declared, not assessed. At the point of return the seller
selects Unworn or Worn. The system records it as declared, exactly as it records a
payment method. It is not the software's job to judge the state of a garment.

**A-FR-8.10** (MUST) -- On starting a return or exchange, the system displays the elapsed
time and the verdict before anything is entered -- for example "Sold 47 days ago. Unworn:
exchange allowed, refund outside window." The seller sees where he stands before he starts,
not after.

**A-FR-8.11** (MUST) -- Outside the window, the system warns and requires a reason to
proceed. It does not block. Mr. Ateba may have a legitimate reason -- a manufacturing
defect, a decision by the founder -- and blocking him would push the transaction off the
system and back onto paper, which is the outcome that costs the school most. The override,
its reason and the user are audited.

**A-FR-8.12** (MUST) -- Out-of-policy returns and exchanges are flagged in the daily report
and in a dedicated report, so the administration can see how often the rule is being set
aside and by whom. The policy is enforced by visibility, not by the software refusing.

**A-FR-8.13** (MUST) -- The elapsed time is calculated from the original sale date, not from
the date of a previous exchange. Swapping a garment does not restart the clock --
otherwise a garment can be exchanged indefinitely.

**A-FR-8.14** (MUST) -- The receipt for a return or exchange prints the condition declared,
the elapsed days, and whether it was within policy or an override.

### A-9. Orders and alterations

Parents order garments that are not yet made, and bring garments back to be resized. Both
leave work outstanding, and both must be visible to Mr. Ateba as a list of open jobs on his
phone. This is the part of the system that replaces remembering.

Orders

**A-FR-9.1** (MUST) -- An order is created when a parent buys a garment that cannot be
handed over immediately -- the size is not made yet, or stock has run out.

**A-FR-9.2** (MUST) -- An order records everything a sale records (student, class, parent,
parent phone, line items, payment) plus:

Field                 Required  Notes
Status                   Yes    See A-FR-9.5
Expected date             No    When Mr. Ateba expects it ready
Measurements / notes      No    Free text -- specific measurements, special requests

**A-FR-9.3** (MUST) -- Payment for an order is taken in full, up front, exactly like a normal
sale, with the payment method recorded. The receipt is issued at that moment, carries an
ORD reference, and is clearly marked COMMANDE / ORDER -- not yet collected.

**A-FR-9.4** (MUST) -- An order can contain a mix of lines: some garments handed over
immediately, others to follow. Only the outstanding lines carry an order status.

**A-FR-9.5** (MUST) -- Order statuses, in this exact sequence:

Status  Meaning
Status         Meaning
Ordered        Paid, not yet started
In production  Being made
Ready          Finished, waiting for the parent to collect
Collected      Handed over -- the order is closed
Cancelled      Cancelled with a reason and a refund

**A-FR-9.6** (MUST) -- Every status change records who changed it and when, and is audited.
Status can move backwards (Ready back to In production) if a garment turns out to be
wrong, with a mandatory reason.

**A-FR-9.7** (MUST) -- Collection records the date, who handed it over, and who collected it.
A collection slip is produced -- a short receipt marked Collected / Retiré, carrying its own
COL reference and showing the ORD reference it closes (A-FR-7.5). This is the proof that the
garment left, and it is the point at which stock decreases.

How orders interact with stock

This is the part that will produce wrong numbers if it is built carelessly. Read it before
writing the schema.

**A-FR-9.8** (MUST) -- An order does not decrease stock when it is placed. The garment
does not exist yet. Stock decreases only at collection (A-FR-9.7), by which point production
will have increased it.

**A-FR-9.9** (MUST) -- Each product therefore carries three numbers, and all three are
shown on the product list:

Number       Meaning
In stock     Physically present
Reserved     Owed to open orders with status Ready
Available    In stock - Reserved

**A-FR-9.10** (MUST) -- When a garment reaches Ready, the quantity it needs becomes
Reserved. The sale screen offers Available, not In stock. Without this, Mr. Ateba makes
three shirts in size 10, two of which are already owed, sells all three over the counter, and
two parents come back to an empty shelf.

**A-FR-9.11** (SHOULD) -- When a production entry is recorded for a product with waiting
orders, the system says so -- "3 orders waiting for this size" -- so the garments are set aside
rather than put on the shelf.

Alterations

**A-FR-9.12** (MUST) -- An alteration is a garment taken in to be resized or repaired. It is
tracked as an open job like an order, but it is not a sale and does not touch stock -- the
garment belongs to the parent.
**A-FR-9.13** (MUST) -- An alteration records: student name, class, parent name and phone,
which garment, what is to be done (free text, mandatory), date received, expected date, and
whether a charge applies. If there is a charge, payment and method are recorded as for a
sale.

**A-FR-9.14** (MUST) -- Alteration statuses: Received  In progress  Ready  Returned,
plus Cancelled. Same audit rules as orders.

**A-FR-9.15** (MUST) -- A short deposit slip is issued when a garment is taken in, so the
parent has proof the school is holding it. Returning it records who collected it and when.

The job list -- Mr. Ateba's phone

**A-FR-9.16** (MUST) -- A single open-jobs view is the landing screen for the Seller,
showing every order and alteration that is not yet Collected, Returned or Cancelled, as one
card per job.

**A-FR-9.17** (MUST) -- Each card shows: student name and class, garment and size, status,
date placed, expected date, and how many days it has been open.

**A-FR-9.18** (MUST) -- Sorted oldest first by default. The job waiting longest is at the top
-- that is the one that generates a complaint. Filterable by status, and searchable by
student or parent name for when a parent walks in and asks.

**A-FR-9.19** (MUST) -- Jobs open longer than a threshold (suggest 7 days) are visually
flagged. Jobs past their expected date are flagged more strongly.

**A-FR-9.20** (MUST) -- Status is changed directly from the card in one tap. If changing status
takes three screens, it will not be kept up to date, and a job list that is not current is worse
than no job list.

**A-FR-9.21** (MUST) -- An unread-style count of open jobs is visible from anywhere in the
app.

**A-FR-9.22** (MUST) -- Administration sees the same list, read-only. This is the answer to
"has that child's uniform been made yet?" without anyone having to phone Mr. Ateba.

**A-FR-9.23** (MUST) -- Alerts are in-app only. No SMS or email to parents in this version,
even though the phone number is recorded. Mr. Ateba calls the parent himself when a
garment is Ready.

**A-FR-9.24** (MUST) -- Cancelling an order refunds the payment, with the refund method
recorded (A-8), and requires a mandatory reason.

### A-10. Cancellation

**A-FR-10.1** (MUST) -- A sale can be cancelled, never edited or deleted.

**A-FR-10.2** (MUST) -- Cancellation requires a mandatory reason and reverses the stock
movement.
**A-FR-10.3** (MUST) -- A cancelled sale stays visible in history, clearly marked, showing its
reason, who cancelled it and when. Its reference number is not reused.

**A-FR-10.4** (MUST) -- Cancelled transactions are excluded from revenue totals but appear
in the audit log and in a dedicated cancellations report.

**A-FR-10.5** (MUST) -- Only the Seller, Maintenance and Super Admin can cancel.

### A-11. Audit log

**A-FR-11.1** (MUST) -- Every transaction and every movement is recorded,
individually. Logged events: login, failed login, sale, return, exchange, cancellation,
discount granted, production entry, stock adjustment, negative-stock override, return or
exchange recorded, out-of-policy override, order created, order status changed, order
collected, alteration created, alteration status changed, alteration returned, price change,
product created or archived, receipt reprint, export generated, account created or modified.

**A-FR-11.2** (MUST) -- Each entry records: server timestamp, user, action type, target,
previous value, new value.

**A-FR-11.3** (MUST) -- Append-only. No interface anywhere, for any role including Super
Admin, can edit or delete an entry.

**A-FR-11.4** (MUST) -- Readable by all roles. Filterable by date, user and action type.

**A-FR-11.5** (MUST) -- Developer actions carry no exemption and are visible to everyone.

**A-FR-11.6** (MUST) -- The audit log must be wired in from day one of development, not
added at the end. Retrofitting it costs more than building it, and it is the requirement most
likely to be skipped under deadline pressure.

### A-12. Reports

**A-FR-12.1** (MUST) -- Daily cash reconciliation -- the priority report, produced at the
end of every day:

   - Number of transactions
   - Gross sales total
   - Collected by method: Cash / MoMo / Orange Money, each with its own total and

         transaction count
   - Refunds paid out, by method
   - Net cash that should be in the box -- cash receipts minus cash refunds only, never

         mixed with mobile money
   - Mobile money total to check against the phone, listing each transaction with its

         reference
   - Money taken for garments not yet delivered -- total value of orders paid but not

         collected. Money in the box today that the school still owes goods against.
   - Breakdown by person who received payment
- Discounts granted, with reasons
- Cancellations

**A-FR-12.2** (MUST) -- Open jobs report -- all orders and alterations not yet closed, with
age in days and expected date, sorted oldest first. This is the report the administration will
actually ask for.

**A-FR-12.3** (MUST) -- Other reports: sales by period, sales by garment and size, production
by period, orders placed and fulfilled over a period with average turnaround, returns and
exchanges, out-of-policy returns and exchanges with their reasons, cancellations, audit
log.

**A-FR-12.4** (MUST) -- All reports are available to every role, including Administration.

**A-FR-12.5** (MUST) -- Export to PDF and Excel (.xlsx), stamped with the generation date,
the user who generated it and the filters applied.

**A-FR-12.6** (MUST) -- Generating an export is audited.

### A-13. Technical constraints

A-NFR-1 (MUST) -- Web app only. Nothing to install, nothing to download. Opens in a
browser.

A-NFR-2 (MUST) -- Hosting: Vercel + Supabase. Free tier is sufficient at this scale.
Supabase provides database and authentication together, deployable within an hour.

A-NFR-3 (MUST) -- No offline mode. If the connection drops, the app stops working, and
that is accepted. But a dropped connection must never silently lose a transaction: the
interface confirms a save only after the server confirms it, and shows an unambiguous
error otherwise. A sale that appears saved but is not is the worst possible failure mode
here.

A-NFR-4 (MUST) -- HTTPS throughout. Passwords hashed with bcrypt or argon2.
Standard injection, XSS and CSRF protection.

A-NFR-5 (MUST) -- Supabase Row Level Security enabled on every table. Never rely on
client-side filtering to protect data.

A-NFR-6 (MUST) -- Automatic daily database backup, verified restorable before go-live.
This is money data.

A-NFR-7 (MUST) -- Under two seconds per screen on a normal connection.

A-NFR-8 (SHOULD) -- A short handover note: how to deploy, how to restore a backup,
how to create the first account, how to reset a password.

### A-14. Out of scope for Phase 1              Note

                                            Payment is in full, up front, including on
Feature
Instalments, partial payments, outstanding
Feature                                    Note
balances                                   orders
Automatic verification of mobile money     No provider integration; the method is
                                           recorded as declared
Offline mode                               Explicitly excluded
Thermal printer output                     Awaiting hardware
Raw materials: fabric, thread, buttons     Candidate for Phase 3
Low-stock alerts and reminder cadence      Phase 2 pattern
Link to the school's student database      Names are free text
SMS or email notification to parents when  Mr. Ateba calls them; the phone number is
an order is ready                          recorded for that
Parent-facing portal                       Not planned
General school supplies                    Phase 2

### A-15. Build order -- four days

Development runs Tuesday 18 to Friday 21 August. Delivery is Friday end of day; the
absolute cut-off is 02:00 on Saturday 22 August. Do not start a block before the one above
works.

Day 1 -- Tuesday 18 -- Foundation Supabase project, schema and Row Level Security -
A-3 authentication - A-4 product catalogue - A-7.1­7.5 reference numbering and UUID keys
- A-11 audit log wired in from the start - P-5 translation layer scaffolded

Day 2 -- Wednesday 19 -- Stock and sales A-5 production entry - A-FR-9.8­9.10 the
three stock numbers (in stock / reserved / available) - A-6 sale recording including
payment method - A-7.6 search

Day 3 -- Thursday 20 -- Receipts and orders A-7.8­7.12 receipt PDF, bilingual, A5 - A-9
orders, statuses, collection slips - A-FR-9.16­9.22 the open-jobs list

Day 4 -- Friday 21 -- Completion and deployment A-8 returns and exchanges including
the policy engine - A-10 cancellation - A-12 reports and exports - full translation pass - A-
NFR-6 backup verification - deploy, then load the real products and prices

Weekend 22­23 -- Go-live support Mr. Ateba trained, real sales run with someone on
hand.

The extra days over the original plan went into scope that has been added since -- orders,
alterations, the return policy engine and the reference scheme -- not into slack. This is still
a tight schedule, and the sequencing above matters: anything built before the audit log and
the reference scheme will have to be revisited.

If the schedule slips, the three things that must not be dropped are the audit log,
returns/exchanges, and the open-jobs list. A receipt system that cannot say who took the
money, cannot handle a wrong size, or cannot tell Mr. Ateba which garments he still owes,
is worse than the paper it replaces -- because he will end up keeping both.

Alterations (A-FR-9.12 to 9.15) are the one part of A-9 that can slip into the following week
if Friday runs out. Orders cannot: money has already been taken for those garments.

### A-16. Acceptance criteria -- Phase 1

   1. A production batch of eight garments across two sizes is recorded and stock
         increases correctly.

   2. A sale of three items produces a correct A5 bilingual PDF receipt with a sequential
         SAL reference, showing student, class and parent names.

   3. The receipt prints legibly from a browser on a normal office printer.
   4. A parent orders a size that is not in stock and pays in full: an order is created, the

         receipt is marked as an order, stock is not decreased, and the job appears on the
         open-jobs list.
   5. The garment is produced, the order moves to Ready, and the quantity shows as
         Reserved -- the sale screen no longer offers it as available.
   6. The parent collects: a collection slip is issued showing both its own COL reference
         and the ORD it closes, stock decreases, and the job leaves the open-jobs list.
   7. A garment is taken in for resizing, appears on the open-jobs list with a deposit slip,
         and is closed when returned without any stock movement.
   8. An order left open past its expected date is visually flagged, and the open-jobs list is
         sorted oldest first.
   9. A size exchange for a more expensive garment collects the difference; for a cheaper
         one it refunds the difference; both stock quantities update.
   10. A return without replacement issues a refund with its method recorded, and
         restores stock.
   11. An unworn garment sold 40 days ago is offered for exchange and accepted, and
         offered for refund and flagged as outside the window.
   12. A worn garment sold 10 days ago is refused refund and flagged for exchange as an
         override; the override is accepted with a reason and appears in the out-of-policy
         report.
   13. A sale is cancelled with a reason; stock is restored, the reference number is not
         reused, revenue totals exclude it.
   14. A sale is attempted with insufficient stock: the system warns, allows the override,
         and audits it.
   15. The Seller attempts to change a price and is refused -- including when the request
         is sent directly to the server, bypassing the interface.
   16. An Administration user attempts to record a sale and is refused, likewise at server
         level.
   17. A transaction is found by searching the student's name with no reference number to
         hand; separately, a URL is confirmed to contain a UUID and not a guessable number.
   18. After a day mixing cash and mobile money sales, one refund and one cancellation:
         the report's cash line matches the physical cash in the box, and the mobile money
         line is listed separately with references for checking against the phone.

   19. The audit log shows every action above, with who and when, and cannot be edited
         from any screen.

   20. The interface switches fully between French and English with no untranslated text;
         the receipt shows both languages on one page.

   21. A backup is restored to a clean environment with data intact.
   22. Mr. Ateba runs a full day of real sales unaided.

### A-17. Open points -- Phase 1

None of these block the start of Day 1.

   1. Size format -- numeric assumed. To be confirmed with Mr. Ateba. A-FR-4.2 is
         written so this stays a data change.

   2. Price list -- the actual garments, sizes and prices must be supplied before go-live.
   3. School logo -- image file needed for the receipt template.
   4. Printer -- model and paper size unknown. A5 PDF for now.
   5. Class list -- free text with autocomplete for now; a fixed list can be supplied later.
   6. Unpaid orders -- is an order ever accepted without payment, or is payment in full

         always required up front? A-FR-9.3 currently assumes payment up front.
   7. Refund windows -- the school has confirmed exchange at 3 months unworn and 1

         week worn. The refund side is proposed as 1 month unworn and no refund on a
         worn garment. To be confirmed with Mr. Ateba and the founder. All four are
         settings, so a change is a configuration change, not a code change.
   8. Manufacturing defects -- whether a defective garment sits outside the policy
         entirely, or is handled as an override with "defect" as the reason. Currently the
         latter.

## PART B -- PHASE 2: SCHOOL STOCK MANAGEMENT

Deadline: 31 August 2026. Starts once Phase 1 is deployed.

### B-1. Context

The school tracks all its supplies in a handwritten register notebook. One person -- the
storekeeper -- records what comes in and what goes out. There is no digital record of any
kind.

Problems with the current situation:

   - No visibility for the administration without physically opening the notebook
- No reliable record of who took what, and when
- No warning that an item is running low until it is already gone
- Nothing is auditable after the fact

This system is standalone. It does not touch the school's existing administration software,
and it does not share anything with the Phase 1 uniform system.

What is tracked: all consumables and equipment used to run the school -- chalk, pens,
exercise books, whiteboards, brooms, cleaning products, paper. The catalogue is generic;
no item list is hardcoded.

Scale: 50­150 distinct item types (assume up to 200), 10­50 user accounts, tens of
movements per day, rarely more than three or four concurrent users. This is a small
system. Simplicity and delivery speed matter more than scalability.

### B-2. Users and roles

Four fixed roles. Do not build a role editor.

Role            Accounts  Description
Stock Manager   1
                          The storekeeper. The only person who can change stock
Administration  5­15      quantities.

Maintenance     2         Read-only. The founder, administrative staff, the discipline
Super Admin     1         master.

                          The developers. Full functional access, fully audited.

                          Accounts and roles.

An Administration account may additionally carry the Procurement flag, allowing export
of supplier and price data. This is for whoever handles purchasing -- currently not the
Stock Manager.

Teachers do not get accounts. They request supplies face-to-face from the administration,
exactly as they do today.

Permission matrix           Stock              Administration  Maintenance  Super
                          Manager                     Yes            Yes    Admin
Capability
View catalogue and           Yes                                              Yes
quantities
View movement history        Yes               Yes                 Yes               Yes
View audit log               Yes
Create / edit items          Yes               Yes                 Yes               Yes
Record Stock In              Yes
Record Stock Out             Yes               No                  Yes               Yes
Record Adjustment            Yes
                                               No                  Yes               Yes

                                               No                  Yes               Yes

                                               No                  Yes               Yes
Capability                 Stock  Administration    Maintenance  Super
                         Manager          No              Yes    Admin
Set reference level                       No              Yes
                            Yes           No              Yes      Yes
Mark "Order placed"         Yes                                    Yes
                            Yes                                    Yes
See supplier / price on
screen                      Yes   Yes               Yes          Yes
                            Yes
Export standard reports           Procurement flag  Yes          Yes
                            No
Export supplier / price           only
data
                                  No                No           Yes
Create / deactivate
accounts

### B-3. Platform and hosting

**B-FR-3.1** (MUST) -- A single Progressive Web App, self-hosted on the school's own
server. One codebase, one deployment. The Stock Manager installs it on his smartphone;
the administration opens the same URL on a desktop PC. No separate desktop application,
no separate native mobile app.

**B-FR-3.2** (MUST) -- The full feature set must be usable on a desktop browser with no
webcam and no touchscreen. The office PC has neither. Any feature needing a camera or
a touch surface must have a working keyboard-and-mouse path.

**B-FR-3.3** (MUST) -- Hosting is on-premises. The school server has generator and solar
backup, runs 24/7, and has a backup server also running. No external cloud dependency.

Offline behaviour

Connectivity is generally good (Starlink) and the server is local, so offline handling is about
resilience, not core workflow. Keep it minimal.

**B-FR-3.4** (MUST) -- When the client cannot reach the server, a permanent banner is
shown: "Offline -- changes will be saved when the connection returns."

**B-FR-3.5** (MUST) -- While offline, the last-loaded catalogue and quantities remain
readable.

**B-FR-3.6** (SHOULD) -- While offline, the Stock Manager can still record movements. They
queue locally, send automatically on reconnection, and are visibly marked pending until the
server confirms them.

**B-FR-3.7** (MUST) -- The server timestamps every movement on receipt, and also stores
the timestamp captured on the device. Both are kept.

### B-4. Authentication

**B-FR-4.1** (MUST) -- Email and password. Accounts created by Super Admin only. No
public sign-up.

**B-FR-4.2** (MUST) -- Forced password change on first login. Session timeout: 12 hours on
the Stock Manager's device, 2 hours on shared desktops.

**B-FR-4.3** (MUST) -- Password reset by the Super Admin issuing a temporary password.
Failed logins rate-limited and audited.

### B-5. Item catalogue

**B-FR-5.1** (MUST) -- An item has:

Field            Required  Notes
Name                Yes    Free text
Unit                Yes    Free text with autocomplete
Category             No    Free text with autocomplete
Reference level     Yes    Baseline for the low-stock threshold
Notes                No    Free text
Photo                No    Optional

**B-FR-5.2** (MUST) -- Items are created manually through a form. No file import -- the
school has no digital source data.

**B-FR-5.3** (MUST) -- Units and categories are free text with autocomplete, so the
catalogue does not fill up with "carton", "Carton", "cartons" and "ctn" as four different units.
A genuinely new value can still be typed.

**B-FR-5.4** (MUST) -- Duplicate prevention. On creation, a close name match warns and
shows the existing item first. The user can override deliberately.

**B-FR-5.5** (MUST) -- One item, one unit. No unit conversion, no packs nested inside
cartons. If both "carton of chalk" and "box of chalk" need tracking, they are two items. Unit
conversion is where inventory systems become complicated and where data-entry errors
multiply.

**B-FR-5.6** (MUST) -- Items are archived, never deleted. Archived items leave the
movement forms but stay in history and past reports.

**B-FR-5.7** (SHOULD) -- Item photo, compressed client-side to roughly 200 KB.

### B-6. Stock In

**B-FR-6.1** (MUST) -- Only the Stock Manager, Maintenance or Super Admin can record a
Stock In.
**B-FR-6.2** (MUST) -- Fields:

Field              Required  Visibility
Item                  Yes    All
Quantity              Yes    All
Date received         Yes    All
Source / reason        No    All
Supplier               No    Restricted
Unit price             No    Restricted
Total price            No    Restricted, auto-calculated, editable
Invoice reference      No    Restricted
Note                   No    All

**B-FR-6.3** (MUST) -- Quantity must be positive. Zero and negatives are rejected.

**B-FR-6.4** (MUST) -- Supplier and price fields are not shown to Administration on
screen. They are visible only to the Stock Manager, Maintenance and Super Admin, and
appear in exports only for users with the Procurement flag.

**B-FR-6.5** (MUST) -- No signature or photo is required for a Stock In.

### B-7. Stock Out

The most important screen in the system. It must be fast -- used many times a day,
standing up, on a phone.

**B-FR-7.1** (MUST) -- Only the Stock Manager, Maintenance or Super Admin can record a
Stock Out.

**B-FR-7.2** (MUST) -- Fields:

Field                  Required  Notes
Item                      Yes    Searchable list
Quantity                  Yes    Positive number
Recipient name            Yes    Free text with autocomplete
Recipient signature       Yes    See B-FR-7.4
Purpose / destination      No    e.g. "Classroom 4B", "Cleaning team"
Note                       No    Free text

**B-FR-7.3** (MUST) -- A Stock Out that would take the quantity below zero is blocked,
showing the available quantity. The correct route is an Adjustment. (Note: this is the
opposite of the uniform system, where the seller can see the shelf. Here the storekeeper is
recording against a controlled store.)
**B-FR-7.4** (MUST) -- Signature capture. The recipient signs on screen with a finger on the
phone, or with the mouse on the desktop PC. Stored as a small image attached to the
movement. No tablet, stylus or extra hardware is to be purchased. Target size under 50 KB
after compression. A "Clear" button allows re-signing before saving.

**B-FR-7.5** (MUST) -- No photo is required for a Stock Out. The office PC has no webcam,
so a mandatory photo would make the desktop path unusable.

**B-FR-7.6** (SHOULD) -- An optional photo may be attached when a camera is available.
Never required to save.

**B-FR-7.7** (SHOULD) -- Several items issued to the same recipient in one transaction, with
one signature covering the set. Chalk, duster and register are usually collected together;
forcing three signatures will get the system abandoned.

### B-8. Corrections

**B-FR-8.1** (MUST) -- No movement is ever deleted or edited. Movements are immutable
once saved.

**B-FR-8.2** (MUST) -- Errors are fixed by recording an Adjustment: a new movement
referencing the original, stating the corrected quantity, with a mandatory reason.

**B-FR-8.3** (MUST) -- A corrected movement is shown with a visible marker linking it to its
adjustment. Both stay visible; the original value is never hidden or overwritten.

**B-FR-8.4** (MUST) -- An Adjustment may also stand alone -- for physical counts, breakage,
loss or theft. The reason is still mandatory.

### B-9. Stock levels and alerts

**B-FR-9.1** (MUST) -- Current quantity is computed from movements, never stored as a
manually edited number.

**B-FR-9.2** (MUST) -- Each item has a reference level set by the Stock Manager, typically
the normal full-stock quantity.

**B-FR-9.3** (MUST) -- Status:

Status        Condition
OK            Above 20% of the reference level
Low stock     At or below 20% of the reference level, above zero
Out of stock  Zero

**B-FR-9.4** (MUST) -- Status is a clear visual badge in the catalogue, visible to all users
including Administration.

**B-FR-9.5** (MUST) -- Alerts are shown to the Stock Manager only. On opening the app,
Low stock and Out of stock items are surfaced in a dedicated panel.
**B-FR-9.6** (MUST) -- Reminder cadence:

Situation                               Frequency
Low or Out of stock, no order placed    Every 3 days
"Order placed" marked                   Every 7 days
Quantity back above threshold           Reminders stop, flag clears automatically

**B-FR-9.7** (MUST) -- The Stock Manager can mark an item "Order placed" with an
optional date and note. Visible to Administration, so they can see a shortage is being
handled.

**B-FR-9.8** (MUST) -- Alerts are in-app only. No email, no SMS, no push notifications.

### B-10. Audit log

**B-FR-10.1** (MUST) -- Logged: login, failed login, logout, item created/edited/archived,
movement recorded (In / Out / Adjustment), reference level changed, "Order placed" set or
cleared, export generated, account created/modified/deactivated, role changed.

**B-FR-10.2** (MUST) -- Each entry: server timestamp, user, action type, target, previous
value, new value, and device or browser information where available.

**B-FR-10.3** (MUST) -- Append-only. No user, including Super Admin, has any interface to
edit or delete an entry.

**B-FR-10.4** (MUST) -- Readable by all account holders. Filterable by date range, user,
item and action type.

**B-FR-10.5** (MUST) -- Maintenance actions carry no exemption and are visible to everyone.

### B-11. Reports

**B-FR-11.1** (MUST) -- Available reports:

Report               Content
Current stock        All items, quantity, unit, status
Movements by period  All In / Out / Adjustments over a date range
Movements by item    Full history of one item
Restock list         Low and Out of stock items, with "Order placed" status
Audit log            Filtered audit entries

**B-FR-11.2** (MUST) -- Every report exports to PDF and Excel (.xlsx), stamped with
generation date, the user who generated it, and the filters applied.

**B-FR-11.3** (MUST) -- Supplier, unit price, total price and invoice reference appear in
exports only for users with the Procurement flag (plus Stock Manager, Maintenance,
Super Admin). For everyone else those columns are omitted entirely from the file -- not
blanked out, omitted.

**B-FR-11.4** (MUST) -- Generating an export is audited.

### B-12. Initial data migration

Bringing the register notebook into the system is part of the delivery, not a separate task.
Budget real time for it.

**B-FR-12.1** (MUST) -- The approach is a physical inventory count on go-live day, not a
transcription of the notebook's history:

   1. Create the item catalogue -- name, unit, category, reference level. Estimate 50­150
         items.

   2. Physically count what is actually in the store.
   3. Enter each counted quantity as an opening Stock In, source "Opening balance".

Recopying years of past movements would take days and produce a record nobody could
vouch for. The notebook remains the historical archive.

**B-FR-12.2** (MUST) -- Opening balances are clearly identifiable as such in the movement
history.

**B-FR-12.3** (MUST) -- Data entry is done together with the Stock Manager, not for him. He
knows the real names and units, and doing it together is his training.

**B-FR-12.4** (MUST) -- Estimated effort: 2 to 3 person-days. Put it in the schedule.

### B-13. Technical constraints

B-NFR-1 (MUST) -- Passwords hashed with bcrypt or argon2. Never plain text, never
reversibly encrypted.

B-NFR-2 (MUST) -- HTTPS on all traffic, including on the local network. A self-signed or
internal certificate is acceptable.

B-NFR-3 (MUST) -- Automatic daily backup of database and uploaded files, to a location
that is not the main server. A backup living on the machine it protects is not a backup.
Restoration tested once before go-live and the procedure documented.

B-NFR-4 (MUST) -- Under two seconds per screen on the local network.

B-NFR-5 (MUST) -- Standard input validation, injection, XSS and CSRF protection.
Uploaded files validated by type and size, and not served from a path allowing arbitrary file
access.

B-NFR-6 (SHOULD) -- Handover document: deployment, backup restoration, creating the
first account, resetting a password.

### B-14. Out of scope for Phase 2              Reason

                                            Requires an approval hierarchy that does not
Feature                                     exist yet
Requests submitted through the app by       Same
staff                                       Invoices are handwritten
Multi-level approval workflow               In-app alerts suffice
Invoice scanning / OCR                      Standalone by design
Email or SMS notifications
Integration with the school administration  Manual entry accepted
system                                      See B-FR-5.5
Automatic translation of item names         No labelled stock exists
Unit conversion                             Teachers go through the administration
Barcode or QR scanning                      Single store
Teacher accounts
Multi-site management

Requests in the app and an approval workflow are the most likely candidates for a later
phase.

### B-15. Build order -- Phase 2

Block 1 -- Core B-4 authentication - B-5 catalogue - B-6 Stock In - B-7 Stock Out with
signature - B-9.1­9.4 quantities and status - B-10 audit log

Block 2 -- Required for acceptance B-8 adjustments - B-9.5­9.8 alerts and cadence - B-11
reports - full translation - B-NFR-1­3 security and backup - B-12 data migration

Block 3 -- If time allows B-FR-3.6 offline queueing - B-FR-5.7 item photos - B-FR-7.6
optional photos - B-FR-7.7 multi-item single signature - B-NFR-6 handover document

### B-16. Acceptance criteria -- Phase 2

   1. The Stock Manager records a Stock In and a Stock Out from his phone; quantities
         update correctly.

   2. A recipient signs on the phone screen and the signature is visible on the saved
         movement.

   3. The same Stock Out is recorded end-to-end on the desktop PC, with no webcam and
         no touchscreen.

   4. An Administration user can view stock and history, but every write is refused --
         including when sent directly to the server, bypassing the interface.

   5. An Administration user without the Procurement flag exports a report and the
         supplier and price columns are absent from the file.

   6. A quantity error is corrected via an Adjustment; original and correction both remain
         visible with the reason.
   7. An item is driven below 20% of its reference level, is flagged to everyone, the Stock
         Manager gets the reminder, and marking "Order placed" moves the cadence to
         weekly.

   8. The audit log shows every action of the demonstration and cannot be edited from
         any screen.

   9. The interface switches fully between French and English with no untranslated text.
   10. A backup is restored to a clean environment with data intact.
   11. The real catalogue and opening balances are loaded, and the Stock Manager

         operates the system unaided for a full day.

### B-17. Open points -- Phase 2

None block the start of Block 1.

   1. Reference levels -- who sets the initial value per item. Proposal: the Stock
         Manager, from experience, refined after a term of real data.

   2. Recipient list -- currently free text with autocomplete. If the school wants a fixed
         list of authorised collectors, it must be confirmed and supplied. Terence to confirm
         which administrative staff are authorised.

   3. Procurement flag -- which specific person handles restocking and needs supplier
         and price data.

   4. Server access -- which developer gets deployment access, and who administers it
         after handover.

   5. Category list -- whether a starting set (stationery, cleaning, furniture, teaching
         materials) should be agreed in advance.

## 5. Design decisions and reasoning

Recorded so the team does not re-open settled questions.

Sequential references, not random codes. A random identifier has no order, so a missing
document is invisible; sequential numbering makes a gap the audit signal. A reference also
has to be readable aloud over a bad phone line, which rules out random character strings.
Unguessability is handled separately by the UUID in the URL, which is a different problem
with a different solution.

Two names on every receipt. Recorded by and Payment received by are separate because
the audit question is who accepted the money, not who typed it.

The return policy warns, it never blocks. Software that refuses a transaction the founder
has approved does not stop the transaction -- it moves it onto a scrap of paper, where
nothing is recorded and the stock count silently drifts. Warning plus a mandatory reason
plus an out-of-policy report gives the administration the control it actually wants, which is
knowing how often the rule is set aside and by whom.
Condition is declared, not assessed. The system records "worn" or "unworn" as stated by
the seller, in the same way it records a payment method. Any other design pretends the
software can inspect a garment.

Exchange is more generous than refund by design. A wrong size is the school's problem
to solve and costs it nothing but labour. Money back is a different matter, and the windows
reflect that.

Payment method recorded, but declared rather than verified. There is no integration
with MoMo or Orange Money, so the system records what the seller states was received.
This is why the daily report never merges cash and mobile money into a single figure: only
the cash line can be checked against the box, and the mobile money line must be checked
against the phone. An optional transaction reference makes that check possible after the
fact.

No instalments in Phase 1. Payment is in full on the spot. Balance tracking is a substantial
feature and it is not needed.

Bilingual receipt rather than a language choice at the till. One template, no decision to
make while a queue waits, no complaint from either language community.

A5 rather than A4 receipts. Two per sheet halves paper cost, and a uniform receipt has
little content.

Orders do not decrease stock; collection does. An order is placed for a garment that
does not exist yet, so decrementing at order time would drive stock negative and then
double-count when the garment is actually made. Stock moves once, at the moment the
garment physically leaves.

Reserved quantity is separate from stock on hand. Once a garment is made and marked
Ready for an order, it is physically on the shelf but already owed. Showing only "in stock"
would let the same shirt be sold twice -- which is the exact failure the paper system
already produces, and the one a parent notices.

Negative stock warns in Phase 1, blocks in Phase 2. In the uniform workshop the seller
can see the shelf, and garments may be finished before they are entered -- blocking would
push him back to paper. In the store the manager is recording against a controlled stock,
where a negative figure means a genuine error.

Signature rather than photo for Stock Out in Phase 2. A photo was considered and
rejected as mandatory: the office PC has no webcam, which would leave the desktop path
unusable; photos run 200 KB­2 MB per movement against under 50 KB for a signature; a
photo of a carton does not prove what was inside it; and a signature reproduces the gesture
already used in the paper notebook. A photo remains available as an optional attachment.

One item, one unit in Phase 2. Unit conversion is where inventory systems become
complicated and where errors multiply. Separate items are less elegant and far more
robust.
Nothing is ever edited or deleted, anywhere. Auditability is the core requirement of
both projects. Any interface that can delete a transaction destroys the guarantee.

Physical count rather than transcribing the notebook. Retyping historical movements
would take days and produce a record whose accuracy nobody could vouch for. A count on
day one gives a trustworthy starting point.

Audit log visible to all account holders. Only the storekeeper and the administration
have accounts. Making the log visible to all of them is a deterrent that costs nothing and
requires no extra permission machinery.

## 6. Summary of deadlines

Date                 Milestone

Monday 17 August 2026 Requirements agreed

Tuesday 18 August    Phase 1 Day 1 -- foundation, auth, catalogue, references, audit
                     log

Wednesday 19 August Phase 1 Day 2 -- production, stock numbers, sales

Thursday 20 August   Phase 1 Day 3 -- receipts, orders, open-jobs list

Friday 21 August     Phase 1 delivery -- returns and policy, cancellation, reports,
                     deploy

Saturday 22 August,  Absolute cut-off for Phase 1
02:00

22­23 August         Go-live: real prices loaded, Mr. Ateba trained and supported

24­26 August         Phase 2 Block 1

27­29 August         Phase 2 Block 2, including data migration

30­31 August         Phase 2 Block 3, testing, backup verification

Monday 31 August 2026 Phase 2 delivery

Phase 1 is the hard deadline. If Phase 2 slips by a few days, that is recoverable. If Phase 1
slips, uniform sales stay on paper through the start of term.

One consequence of moving Phase 1 to the 21st: Phase 2 now has six working days
rather than nine, and its data migration alone is 2­3 person-days (B-FR-12.4). If both
deadlines are to hold, the catalogue for Phase 2 -- item names, units, categories -- should
be drafted on paper during Phase 1 week, so that migration week is data entry rather than
decision-making.
