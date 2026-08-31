-- Stock adjustments must say why (A-FR-5.5).
--
-- An adjustment is how the ledger admits it was wrong: a physical count that
-- disagrees, a garment damaged in production, a defect, a loss. Every other
-- movement carries its own explanation in its kind -- a sale is a sale, a
-- collection is a collection -- but an adjustment explains nothing by itself.
-- An unexplained one is indistinguishable from a mistake, or from theft.
--
-- `note` stays nullable because production entries and collections legitimately
-- have none. The rule is conditional: only adjustments are required to fill it.
-- Enforced here rather than in the form, for the same reason as every other
-- rule in this schema -- anything holding the anon key can insert a row
-- directly, and a mandatory field the UI alone enforces is not mandatory.
--
-- Three characters, not one: "x" satisfies a NOT NULL and answers nothing when
-- the row is read back six months later.

alter table public.stock_movements
  add constraint stock_movements_adjustment_needs_reason check (
    kind <> 'adjustment'
    or (note is not null and length(btrim(note)) >= 3)
  );
