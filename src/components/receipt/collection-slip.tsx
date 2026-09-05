'use client';

import { useLocale, useTranslations } from 'next-intl';
import { Printer, ArrowLeft, Copy } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';
import { DuplicateStamp } from '@/components/receipt/duplicate-stamp';
import {
  Meta,
  Notice,
  PaperToggle,
  ReceiptQR,
  ReceiptStyle,
  SchoolHeader,
  SignatureLine,
  usePaperSize
} from '@/components/receipt/receipt-shell';
import { L, NOTICES } from '@/lib/receipt-labels';
import { formatDateTime, formatMoney } from '@/lib/format';

export type CollectionSlipData = {
  /** A reprint, stamped DUPLICATA / DUPLICATE (A-FR-7.12). */
  duplicate?: boolean;
  /** The COL reference as a QR (A-FR-7.7), built server-side. */
  qr_svg?: string | null;
  /** The collection's own id, so the slip can link to its own reprint. */
  id: string;
  col_no: string;
  collected_at: string;
  collector_name: string;
  handed_over_by: string;
  order_id: string;
  order_no: string;
  ordered_at: string;
  customer_name: string;
  student_name: string | null;
  class_level: string | null;
  items: {
    id: string;
    description: string;
    size: string | null;
    quantity: number;
    line_total: number;
  }[];
};

/**
 * The collection slip (A-FR-9.8).
 *
 * A separate sheet from the order receipt rather than another variant of it:
 * this document proves goods were handed over, where the receipt proves money
 * was taken. They carry different fields and get signed by different people.
 * The @page geometry is shared so both print on the same A5 stock without
 * re-checking the printer.
 *
 * Both references are shown together and equally weighted -- that pairing is
 * the whole point of the slip. A parent holding it can be traced back to the
 * order, and an order can be traced forward to every slip issued against it.
 *
 * Labels are bilingual (A-FR-7.10): the person who collects is frequently not
 * the parent who ordered, so the reader of this sheet is the one least likely
 * to have been present when the language was chosen.
 */
export function CollectionSlip({
  slip,
  canOperate = false
}: {
  slip: CollectionSlipData;
  /**
   * Administration is read-only (A-FR-2.2). Reprint is a write -- rendering
   * that URL stamps the sheet DUPLICATA / DUPLICATE and writes an audit row
   * -- so it is withheld. Print and Back stay: looking at a document and
   * sending it to a printer change nothing.
   */
  canOperate?: boolean;
}) {
  const t = useTranslations('Collection');
  const tReceipt = useTranslations('Receipt');
  const locale = useLocale();
  const { paper, choose } = usePaperSize();

  return (
    <>
      <ReceiptStyle paper={paper} />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Button asChild variant="ghost" size="sm">
          <Link href={`/orders/${slip.order_id}`}>
            <ArrowLeft className="size-4" />
            {t('backToOrder')}
          </Link>
        </Button>
        <div className="flex items-center gap-2">
          <PaperToggle paper={paper} onChange={choose} />
          {!slip.duplicate && canOperate ? (
            <Button asChild variant="outline" size="sm">
              <Link href={`/collections/${slip.id}?reprint=1`}>
                <Copy className="size-4" />
                {tReceipt('reprint')}
              </Link>
            </Button>
          ) : null}
          <Button size="sm" onClick={() => window.print()}>
            <Printer className="size-4" />
            {t('print')}
          </Button>
        </div>
      </div>

      <article className="receipt-sheet mx-auto max-w-xl rounded-lg border bg-white p-8 text-black shadow-sm">
        <header className="relative border-b pb-3 text-center">
          {slip.qr_svg ? (
            <ReceiptQR svg={slip.qr_svg} className="absolute right-0 top-0" />
          ) : null}
          <SchoolHeader />
          <div className="mt-2 border-2 border-black px-3 py-1.5">
            <p className="text-sm font-bold uppercase tracking-wide">
              {L.collectionTitle}
            </p>
          </div>
          {slip.duplicate ? <DuplicateStamp /> : null}
        </header>

        {/* The two references, side by side and equally weighted. */}
        <dl className="grid grid-cols-3 gap-x-4 gap-y-2 border-b py-3">
          <Meta label={L.colNo} value={slip.col_no} mono />
          <Meta label={L.ordNo} value={slip.order_no} mono />
          <Meta label={L.collectedAt} value={formatDateTime(slip.collected_at, locale)} />
          <Meta label={L.orderedAt} value={formatDateTime(slip.ordered_at, locale)} />
          <Meta label={L.customer} value={slip.customer_name} />
          {slip.student_name ? (
            <Meta label={L.student} value={slip.student_name} />
          ) : null}
          {slip.class_level ? <Meta label={L.class} value={slip.class_level} /> : null}
          <Meta label={L.collectedBy} value={slip.collector_name} />
          <Meta label={L.handedOverBy} value={slip.handed_over_by} />
        </dl>

        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="border-b text-left">
              <th className="py-2 font-semibold">{L.description}</th>
              <th className="py-2 text-right font-semibold">{L.quantity}</th>
              <th className="py-2 text-right font-semibold">{L.value}</th>
            </tr>
          </thead>
          <tbody>
            {slip.items.map((item) => (
              <tr key={item.id} className="border-b border-dashed">
                <td className="py-2">
                  {item.description}
                  {item.size ? (
                    <span className="text-neutral-500"> ({item.size})</span>
                  ) : null}
                </td>
                <td className="py-2 text-right tabular-nums">{item.quantity}</td>
                <td className="py-2 text-right tabular-nums">
                  {formatMoney(item.line_total, locale)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* No amount due: this slip moves goods, not money. The order was paid
            in full when it was placed. */}
        <p className="mt-3 text-xs text-neutral-600">{L.alreadyPaid}</p>

        <div className="mt-8 flex items-end gap-8">
          <SignatureLine label={L.handedOverBy} />
          <SignatureLine label={L.collectorSignature} />
        </div>

        <Notice notice={NOTICES.collection} />
      </article>
    </>
  );
}
