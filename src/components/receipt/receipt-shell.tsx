'use client';

import { useSyncExternalStore } from 'react';
import { PAPER_SIZES, type PaperSize } from '@/lib/receipt-labels';
import { SchoolLogo } from '@/components/brand/school-logo';
import { SCHOOL } from '@/lib/format';

/**
 * The pieces every printed document shares: page geometry, the school header,
 * a bilingual field, and a signature line.
 *
 * Pulled out of the three sheets because they must stay identical. The shop
 * checks one paper size against one printer; three copies of an `@page` rule is
 * three chances for them to drift apart, and the drift only shows up on paper.
 */

const STORAGE_KEY = 'receipt-paper-size';

/**
 * localStorage is an external store, so it is read through
 * useSyncExternalStore rather than copied into state inside an effect.
 *
 * The effect version works but is wrong twice over: React flags the cascading
 * render, and reading storage during render instead would make the server and
 * the first client render disagree and hydrate mismatched. This hook renders A5
 * on the server, then React re-reads the real value on the client.
 *
 * The `storage` event is included in the subscription so a shop with the
 * receipt open in two tabs does not end up with two different paper sizes.
 */
const listeners = new Set<() => void>();

function subscribe(onStoreChange: () => void) {
  listeners.add(onStoreChange);
  window.addEventListener('storage', onStoreChange);
  return () => {
    listeners.delete(onStoreChange);
    window.removeEventListener('storage', onStoreChange);
  };
}

/**
 * Returns a primitive, so referential stability is free -- no cached snapshot
 * needed. Every access is wrapped: a private window, or a browser set to block
 * site data, throws on the accessor itself rather than returning null.
 */
function getSnapshot(): PaperSize {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === 'A4' ? 'A4' : 'A5';
  } catch {
    return 'A5';
  }
}

/** A5 is the default the shop prints on, and the only safe answer server-side. */
function getServerSnapshot(): PaperSize {
  return 'A5';
}

/** Remembered per browser so the shop chooses its stock once, not per receipt. */
export function usePaperSize() {
  const paper = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  function choose(next: PaperSize) {
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Storage unavailable. Nothing to notify -- getSnapshot will keep
      // returning A5, which is the default this shop wants anyway.
      return;
    }
    // `storage` does not fire in the tab that wrote it, so tell this one.
    for (const listener of listeners) listener();
  }

  return { paper, choose };
}

/**
 * `@page` has no Tailwind equivalent, so the geometry lives in a real stylesheet.
 * Keyed by paper size so React swaps the whole block rather than mutating it.
 */
export function ReceiptStyle({ paper }: { paper: PaperSize }) {
  return (
    <style key={paper}>{`
      @page {
        size: ${paper} portrait;
        margin: ${paper === 'A5' ? '10mm' : '16mm'};
      }
      @media print {
        html, body { background: #fff !important; }
        .receipt-sheet {
          box-shadow: none !important;
          border: 0 !important;
          padding: 0 !important;
          max-width: none !important;
        }
        /* Never split a line item, a signature block or a total across sheets. */
        .receipt-sheet tr,
        .receipt-sheet .avoid-break { break-inside: avoid; }
        .receipt-sheet thead { display: table-header-group; }
      }
    `}</style>
  );
}

/** Screen-only, like the rest of the print bar. */
export function PaperToggle({
  paper,
  onChange
}: {
  paper: PaperSize;
  onChange: (next: PaperSize) => void;
}) {
  return (
    <div
      className="inline-flex overflow-hidden rounded-md border print:hidden"
      role="group"
      aria-label="Format"
    >
      {PAPER_SIZES.map((size) => (
        <button
          key={size}
          type="button"
          onClick={() => onChange(size)}
          aria-pressed={paper === size}
          className={
            paper === size
              ? 'bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground'
              : 'px-3 py-1.5 text-xs font-medium hover:bg-muted'
          }
        >
          {size}
        </button>
      ))}
    </div>
  );
}

/**
 * The logo and contact details every printed sheet opens with (A-FR-7.8).
 *
 * Uses SchoolLogo, which arrived on project while this branch was open and is
 * the better answer: it falls back to the school's name when public/logo.png is
 * missing, so the header can never render a broken image. That supersedes the
 * NEXT_PUBLIC_SCHOOL_LOGO flag this component originally used -- an env var
 * that has to be set correctly is a worse guarantee than an onError handler.
 */
export function SchoolHeader() {
  return (
    <>
      <SchoolLogo size="lg" className="mx-auto" />
      {SCHOOL.address ? (
        <p className="text-xs text-neutral-600">{SCHOOL.address}</p>
      ) : null}
      {SCHOOL.phone ? <p className="text-xs text-neutral-600">{SCHOOL.phone}</p> : null}
    </>
  );
}

/**
 * One field of the header grid.
 *
 * The bilingual label is stacked above its value rather than sitting inline:
 * "Mode de paiement / Payment method" beside its value would wrap awkwardly at
 * A5 width, and A-FR-7.10 asks for the layout to stay tight.
 */
export function Meta({
  label,
  value,
  mono
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="avoid-break">
      <dt className="text-[0.6rem] leading-tight text-neutral-500">{label}</dt>
      <dd className={mono ? 'font-mono text-xs font-semibold' : 'text-xs font-medium'}>
        {value}
      </dd>
    </div>
  );
}

/**
 * A ruled line to sign on, or the captured signature where one exists.
 *
 * A-FR-7.8 asks for seller AND parent, which is why this is a component and not
 * two hand-rolled divs -- the two blocks have to be the same height or the sheet
 * looks lopsided.
 */
export function SignatureLine({
  label,
  imageUrl
}: {
  label: string;
  imageUrl?: string | null;
}) {
  return (
    <div className="avoid-break flex-1">
      {imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- data URL, not an optimisable asset
        <img src={imageUrl} alt="" className="h-14 w-full object-contain object-bottom" />
      ) : (
        <div className="h-14" />
      )}
      <div className="border-b border-neutral-500" />
      <p className="mt-1 text-[0.6rem] leading-tight text-neutral-600">{label}</p>
    </div>
  );
}

/**
 * The footer notice, in both languages (A-FR-7.10).
 *
 * Two stacked lines rather than a slash pair: these are sentences, and the sale
 * notice states the exchange window the parent may later need to hold the shop
 * to. French first, English beneath it in the same size -- neither is a
 * subtitle of the other.
 */
export function Notice({ notice }: { notice: { fr: string; en: string } }) {
  return (
    <footer className="avoid-break mt-5 border-t pt-2 text-center text-[0.6rem] leading-snug text-neutral-500">
      <p>{notice.fr}</p>
      <p>{notice.en}</p>
    </footer>
  );
}
