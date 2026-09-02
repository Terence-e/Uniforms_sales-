'use client';

import { useLocale, useTranslations } from 'next-intl';
import { Printer, ArrowLeft, Copy, RotateCcw } from 'lucide-react';
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
import { L, NOTICES, PAYMENT_LABELS } from '@/lib/receipt-labels';
import { formatDate, formatDateTime, formatMoney } from '@/lib/format';
import type { OrderStatus, PaymentMethod } from '@/types/database.types';

export type ReceiptData = {
  /**
   * 'order' prints the same sheet stamped COMMANDE / ORDER and adds the
   * expected-ready and measurements rows. The print geometry is shared on
   * purpose -- one @page rule to check against the real printer, not two.
   */
  kind?: 'sale' | 'order';
  /** Carries `order_no` when kind is 'order'; the label switches with it. */
  receipt_no: string;
  /**
   * A reprint, stamped DUPLICATA / DUPLICATE (A-FR-7.12). Set by the route from
   * the reprint URL, never inferred here -- the sheet renders what it is told.
   */
  duplicate?: boolean;
  /** The reference as a QR (A-FR-7.7), built server-side. */
  qr_svg?: string | null;
  /** The sale or order id, so the sheet can link to its own reprint. */
  record_id: string;
  /** Orders only. */
  expected_ready_date?: string | null;
  measurements?: string | null;
  /**
   * The order's derived status, so a REPRINT tells the truth. The stamp used to
   * be hard-coded "not yet collected", which was safe only while nothing could
   * reach 'collected'.
   */
  order_status?: OrderStatus | null;
  sold_at: string;
  customer_name: string;
  student_name: string | null;
  class_level: string | null;
  payment_method: PaymentMethod;
  subtotal: number;
  discount: number;
  /** A-FR-7.8 asks for the discount AND why it was given. */
  discount_reason?: string | null;
  total: number;
  notes: string | null;
  signature_url: string | null;
  seller_name: string;
  /**
   * Both printed, because the spec asks for both (A-FR-6.4, A-FR-6.5) and they
   * answer different questions. Fall back to the seller for rows written
   * before the columns existed rather than printing a blank line.
   */
  recorded_by_name?: string | null;
  received_by_name?: string | null;
  payment_reference?: string | null;
  items: {
    id: string;
    description: string;
    size: string | null;
    unit_price: number;
    quantity: number;
    line_total: number;
  }[];
};

/**
 * The sale and order receipt (A-FR-7.8 to A-FR-7.11).
 *
 * Every label on the printed sheet is bilingual and comes from `L` rather than
 * from next-intl. A translated label resolves to whichever language the seller
 * happened to have the UI in, and the requirement is the opposite: both
 * languages on one sheet, so nobody has to choose while a queue is waiting and
 * neither language community is left reading someone else's receipt.
 *
 * The print bar above the sheet is the deliberate exception. It is screen-only
 * chrome that the seller operates and the parent never sees, so it stays in the
 * seller's own language.
 */
export function ReceiptPrint({ receipt }: { receipt: ReceiptData }) {
  const t = useTranslations('Receipt');
  const tReturns = useTranslations('Returns');
  const locale = useLocale();
  const { paper, choose } = usePaperSize();
  const isOrder = receipt.kind === 'order';
  // Where this sheet lives, so the reprint link can point back at itself.
  const basePath = isOrder
    ? `/orders/${receipt.record_id}/receipt`
    : `/sales/${receipt.record_id}/receipt`;

  return (
    <>
      <ReceiptStyle paper={paper} />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Button asChild variant="ghost" size="sm">
          <Link href={isOrder ? '/orders' : '/sales'}>
            <ArrowLeft className="size-4" />
            {isOrder ? t('backToOrders') : t('back')}
          </Link>
        </Button>
        <div className="flex items-center gap-2">
          <PaperToggle paper={paper} onChange={choose} />
          {/* Where a return starts. A return always references a sale
              (A-FR-8.3), and the receipt in the seller's hand is the most
              natural place to begin one from. Orders are collected, not
              returned, so they do not get this. */}
          {!isOrder ? (
            <Button asChild variant="outline" size="sm">
              <Link href={`/returns/new?sale=${receipt.record_id}`}>
                <RotateCcw className="size-4" />
                {tReturns('start')}
              </Link>
            </Button>
          ) : null}
          {/* Offered only on an original. From a duplicate the link would just
              reload the same stamped sheet and log another reprint. */}
          {!receipt.duplicate ? (
            <Button asChild variant="outline" size="sm">
              <Link href={`${basePath}?reprint=1`}>
                <Copy className="size-4" />
                {t('reprint')}
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
          {receipt.qr_svg ? (
            <ReceiptQR svg={receipt.qr_svg} className="absolute right-0 top-0" />
          ) : null}
          <SchoolHeader />
          <div className="mt-2 border-2 border-black px-3 py-1.5">
            <p className="text-sm font-bold uppercase tracking-wide">
              {isOrder
                ? receipt.order_status === 'cancelled'
                  ? L.orderCancelled
                  : L.orderTitle
                : L.receiptTitle}
            </p>
            {isOrder ? (
              <p className="text-[0.65rem] font-semibold uppercase">
                {/* null means no line was ever outstanding -- every item went
                    home at the counter -- so it reads as collected, not as
                    something still owed. */}
                {receipt.order_status === 'cancelled'
                  ? L.refunded
                  : receipt.order_status === 'collected' || receipt.order_status == null
                    ? L.collected
                    : L.notCollected}
              </p>
            ) : null}
          </div>
          {receipt.duplicate ? <DuplicateStamp /> : null}
        </header>

        <dl className="grid grid-cols-3 gap-x-4 gap-y-2 border-b py-3">
          <Meta label={isOrder ? L.orderNo : L.receiptNo} value={receipt.receipt_no} mono />
          <Meta label={L.date} value={formatDateTime(receipt.sold_at, locale)} />
          {isOrder && receipt.expected_ready_date ? (
            <Meta
              label={L.expectedReady}
              value={formatDate(receipt.expected_ready_date, locale)}
            />
          ) : null}
          <Meta label={L.customer} value={receipt.customer_name} />
          {receipt.student_name ? (
            <Meta label={L.student} value={receipt.student_name} />
          ) : null}
          {receipt.class_level ? (
            <Meta label={L.class} value={receipt.class_level} />
          ) : null}
          {/* Both printed, and both asked for by name: the audit question is who
              accepted the money, which is not necessarily who typed it
              (A-FR-7.9). */}
          <Meta
            label={L.recordedBy}
            value={receipt.recorded_by_name || receipt.seller_name}
          />
          <Meta
            label={L.receivedBy}
            value={receipt.received_by_name || receipt.seller_name}
          />
        </dl>

        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="border-b text-left">
              <th className="py-2 font-semibold">{L.description}</th>
              <th className="py-2 text-right font-semibold">{L.quantity}</th>
              <th className="py-2 text-right font-semibold">{L.unitPrice}</th>
              <th className="py-2 text-right font-semibold">{L.amount}</th>
            </tr>
          </thead>
          <tbody>
            {receipt.items.map((item) => (
              <tr key={item.id} className="border-b border-dashed">
                <td className="py-2">
                  {item.description}
                  {item.size ? (
                    <span className="text-neutral-500"> ({item.size})</span>
                  ) : null}
                </td>
                <td className="py-2 text-right tabular-nums">{item.quantity}</td>
                <td className="py-2 text-right tabular-nums">
                  {formatMoney(item.unit_price, locale)}
                </td>
                <td className="py-2 text-right tabular-nums">
                  {formatMoney(item.line_total, locale)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={3} className="pt-3 text-right text-neutral-600">
                {L.subtotal}
              </td>
              <td className="pt-3 text-right tabular-nums">
                {formatMoney(receipt.subtotal, locale)}
              </td>
            </tr>
            {receipt.discount > 0 ? (
              <tr>
                <td colSpan={3} className="text-right text-neutral-600">
                  {L.discount}
                </td>
                <td className="text-right tabular-nums">
                  &minus; {formatMoney(receipt.discount, locale)}
                </td>
              </tr>
            ) : null}
            <tr className="border-t">
              <td colSpan={3} className="pt-2 text-right text-sm font-bold">
                {L.total}
              </td>
              <td className="pt-2 text-right text-sm font-bold tabular-nums">
                {formatMoney(receipt.total, locale)}
              </td>
            </tr>
          </tfoot>
        </table>

        {/* The reason a price was reduced belongs on the parent's copy, not only
            in the database: it is the one thing that distinguishes an agreed
            concession from a seller quietly undercharging a friend (A-FR-7.8). */}
        {receipt.discount > 0 && receipt.discount_reason ? (
          <p className="mt-2 text-xs">
            <span className="text-neutral-600">{L.discountReason}: </span>
            {receipt.discount_reason}
          </p>
        ) : null}

        <p className="mt-2 text-xs">
          <span className="text-neutral-600">{L.paymentMethod}: </span>
          {PAYMENT_LABELS[receipt.payment_method]}
          {/* The transaction ID is what a parent quotes when a mobile payment
              is disputed, so it belongs on the paper they keep. */}
          {receipt.payment_reference ? (
            <span className="font-mono"> &middot; {receipt.payment_reference}</span>
          ) : null}
        </p>

        {isOrder && receipt.measurements ? (
          <p className="mt-2 text-xs">
            <span className="text-neutral-600">{L.measurements}: </span>
            {receipt.measurements}
          </p>
        ) : null}

        {receipt.notes ? (
          <p className="mt-2 text-xs text-neutral-600">{receipt.notes}</p>
        ) : null}

        {/* Two signatures, side by side (A-FR-7.8). The seller's is the one
            captured on the pad at the counter; the parent signs the paper. */}
        <div className="mt-8 flex items-end gap-8">
          <SignatureLine label={L.sellerSignature} imageUrl={receipt.signature_url} />
          <SignatureLine label={L.parentSignature} />
        </div>

        <Notice notice={isOrder ? NOTICES.order : NOTICES.sale} />
      </article>
    </>
  );
}
