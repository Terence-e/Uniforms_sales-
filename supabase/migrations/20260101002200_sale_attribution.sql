-- Who recorded the sale, and who took the money (A-FR-6.4, A-FR-6.5).
--
-- These are two different questions and the spec wants both answered. On a
-- shared till one person is signed in while another serves the parent and
-- counts the cash; when the drawer is short at close of day, "who was logged
-- in" is not the same as "who received the payment", and only the second one
-- helps.
--
-- seller_id is deliberately NOT reused for either. It stays what it has always
-- been: the account that actually submitted the row, unchangeable, and the key
-- the RLS insert policy checks against auth.uid(). If it became editable, a
-- tampered payload could attribute a sale to somebody else -- which is exactly
-- what that policy exists to prevent. So attribution is recorded alongside it
-- rather than on top of it. The two usually agree; the point is that they are
-- allowed not to.
--
-- Separate migration from 20260101002100 because that one adds an enum value,
-- and Postgres will not let a value added in a transaction be used by the same
-- transaction.

alter table public.sales
  -- Both nullable: rows written before this migration have no answer, and
  -- inventing one would be a guess recorded as a fact. The receipt falls back
  -- to the seller for those.
  add column recorded_by uuid references public.profiles (id),
  add column received_by uuid references public.profiles (id),
  -- The MoMo or Orange Money transaction ID. Optional on purpose -- a parent
  -- does not always have it to hand, and refusing the sale over a reference
  -- number would stop the shop working.
  add column payment_reference text;

-- Existing sales were recorded and received by whoever was signed in, which is
-- the only thing that was true of them.
update public.sales
   set recorded_by = seller_id,
       received_by = seller_id
 where recorded_by is null;

create index sales_received_by_idx on public.sales (received_by, sold_at desc);
