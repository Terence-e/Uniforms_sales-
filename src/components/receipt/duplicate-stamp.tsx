/**
 * The reprint stamp (A-FR-7.12).
 *
 * Shared by all four printable documents so a duplicate looks the same
 * whichever one it is -- someone checking paperwork at the counter should
 * recognise it without reading, and four hand-rolled variants would drift.
 *
 * Bilingual and unconditional, like COMMANDE / ORDER and Retiré / Collected:
 * whoever is handed this may not share the language the seller was working in,
 * and this is the line that must not be missed.
 *
 * Deliberately heavy. A stamp that reads as decoration does not do the job the
 * requirement asks of it, which is to stop a duplicate being presented as an
 * original.
 */
export function DuplicateStamp() {
  return (
    <div className="mt-2 border-4 border-double border-black px-3 py-2">
      <p className="text-lg font-black uppercase tracking-[0.2em]">
        Duplicata / Duplicate
      </p>
    </div>
  );
}
