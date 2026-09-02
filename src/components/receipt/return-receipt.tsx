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
import { L, NOTICES, PAYMENT_LABELS } from '@/lib/receipt-labels';
import { formatDateTime, formatMoney } from '@/lib/format';
import type { GarmentCondition, PaymentMethod, ReturnKind } from '@/types/database.types';

export type ReturnReceiptData = {
  id: string;
  return_no: string;
  kind: ReturnKind;
  returned_at: string;
  reason: string;
  condition: GarmentCondition;
  /**
   * A-FR-8.14: the receipt prints the condition declared, the days elapsed, and
   * whether it was within policy or an override. Nullable for the returns
   * recorded before the policy engine existed -- those rows have no verdict,
   * and printing an invented one would be a guess presented as fact.
   */
  elapsed_days: number | null;
  policy_window_days: number | null;
  within_policy: boolean | null;
  override_reason: string | null;
  notes: string | null;
  refund_amount: number;
  refund_method: PaymentMethod | null;
  collected_amount: number;
  collected_method: PaymentMethod | null;
  signature_url: string | null;
  duplicate?: boolean;
  /** The RTN reference as a QR (A-FR-7.7), built server-side. */
  qr_svg?: string | null;
  sale: {
    id: string;
    receipt_no: string;
    sold_at: string;
    customer_name: string;
    student_name: string | null;
    class_level: string | null;
    payment_method: PaymentMethod;
  };
  seller_name: string;
  recorded_by_name: string | null;
  received_by_name: string | null;
  items: {
    id: string;
    direction: 'in' | 'out';
    description: string;
    size: string | null;
    unit_price: number;
    quantity: number;
    line_total: number;
  }[];
};

/**
 * The RTN receipt (A-FR-8.4).
 *
 * Its own document, not a variant of the sale receipt, because it answers a
 * different question: not "what did you buy" but "what came back, what went
 * out, and which way did the money move". The header says RETOUR or ÉCHANGE in
 * a box, and the original receipt number sits beside the return number so the
 * pair can always be walked in either direction (A-FR-8.6).
 *
 * Bilingual throughout, on the same shared A5 sheet as every other document.
 */
export function ReturnReceipt({ receipt }: { receipt: ReturnReceiptData }) {
  const t = useTranslations('Returns');
  const locale = useLocale();
  const { paper, choose } = usePaperSize();

  const isExchange = receipt.kind === 'exchange';
  const back = receipt.items.filter((item) => item.direction === 'in');
  const out = receipt.items.filter((item) => item.direction === 'out');
  const refund = Number(receipt.refund_amount);
  const collected = Number(receipt.collected_amount);

  return (
    <>
      <ReceiptStyle paper={paper} />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Button asChild variant="ghost" size="sm">
          <Link href="/returns">
            <ArrowLeft className="size-4" />
            {t('backToReturns')}
          </Link>
        </Button>
        <div className="flex items-center gap-2">
          <PaperToggle paper={paper} onChange={choose} />
          {!receipt.duplicate ? (
            <Button asChild variant="outline" size="sm">
              <Link href={`/returns/${receipt.id}/receipt?reprint=1`}>
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
          {/* Boxed and bilingual so this is never mistaken for a sale at a
              glance, which is the whole point of A-FR-8.4. */}
          <div className="mt-2 border-2 border-black px-3 py-1.5">
            <p className="text-sm font-bold uppercase tracking-wide">
              {isExchange ? L.exchangeTitle : L.returnTitle}
            </p>
          </div>
          {receipt.duplicate ? <DuplicateStamp /> : null}
        </header>

        <dl className="grid grid-cols-3 gap-x-4 gap-y-2 border-b py-3">
          <Meta label={L.returnNo} value={receipt.return_no} mono />
          {/* The link back to the sale, printed. A-FR-8.6: both transactions
              stay visible, and the paper has to say which sale this belongs
              to or the pair cannot be walked from the parent's copy. */}
          <Meta label={L.originalReceipt} value={receipt.sale.receipt_no} mono />
          <Meta label={L.returnedAt} value={formatDateTime(receipt.returned_at, locale)} />
          <Meta label={L.soldOn} value={formatDateTime(receipt.sale.sold_at, locale)} />
          <Meta label={L.customer} value={receipt.sale.customer_name} />
          {receipt.sale.student_name ? (
            <Meta label={L.student} value={receipt.sale.student_name} />
          ) : null}
          {receipt.sale.class_level ? (
            <Meta label={L.class} value={receipt.sale.class_level} />
          ) : null}
          <Meta
            label={L.condition}
            value={
              receipt.condition === 'worn' ? L.conditionWorn : L.conditionUnworn
            }
          />
          {receipt.elapsed_days !== null ? (
            <Meta
              label={L.elapsedDays}
              value={t('daysValue', { days: receipt.elapsed_days })}
            />
          ) : null}
          {receipt.within_policy !== null ? (
            <Meta
              label={L.policy}
              value={receipt.within_policy ? L.withinPolicy : L.outOfPolicy}
            />
          ) : null}
          <Meta
            label={L.recordedBy}
            value={receipt.recorded_by_name || receipt.seller_name}
          />
          <Meta
            label={L.receivedBy}
            value={receipt.received_by_name || receipt.seller_name}
          />
        </dl>

        <LineTable title={L.itemsBack} items={back} locale={locale} />
        {isExchange && out.length > 0 ? (
          <LineTable title={L.itemsOut} items={out} locale={locale} />
        ) : null}

        <div className="avoid-break mt-3 border-t pt-2">
          {refund > 0 ? (
            <>
              <div className="flex items-baseline justify-between text-sm font-bold">
                <span>{L.refundedLabel}</span>
                <span className="tabular-nums">{formatMoney(refund, locale)}</span>
              </div>
              {/* A-FR-8.5: the refund method is recorded independently, and the
                  original is printed beside it so the parent's copy shows both
                  when they differ. */}
              <p className="mt-1 text-xs">
                <span className="text-neutral-600">{L.refundMethod}: </span>
                {receipt.refund_method ? PAYMENT_LABELS[receipt.refund_method] : '—'}
              </p>
            </>
          ) : collected > 0 ? (
            <>
              <div className="flex items-baseline justify-between text-sm font-bold">
                <span>{L.collectedLabel}</span>
                <span className="tabular-nums">{formatMoney(collected, locale)}</span>
              </div>
              <p className="mt-1 text-xs">
                <span className="text-neutral-600">{L.collectedMethod}: </span>
                {receipt.collected_method
                  ? PAYMENT_LABELS[receipt.collected_method]
                  : '—'}
              </p>
            </>
          ) : (
            // An even swap. Said explicitly rather than left blank, so nobody
            // reads a missing total as an unpaid one.
            <p className="text-sm font-semibold">{L.noMoneyMoved}</p>
          )}

          <p className="mt-1 text-xs">
            <span className="text-neutral-600">{L.originalPayment}: </span>
            {PAYMENT_LABELS[receipt.sale.payment_method]}
          </p>
        </div>

        <p className="mt-2 text-xs">
          <span className="text-neutral-600">{L.reason}: </span>
          {receipt.reason}
        </p>

        {/* An override is printed on the parent's own copy, boxed, not buried.
            A-FR-8.12 enforces the policy by visibility -- and the person most
            entitled to see that an exception was made for them is the person it
            was made for. */}
        {receipt.within_policy === false && receipt.override_reason ? (
          <div className="avoid-break mt-2 border-2 border-black px-2 py-1.5">
            <p className="text-[0.65rem] font-bold uppercase">{L.outOfPolicy}</p>
            <p className="text-xs">
              <span className="text-neutral-600">{L.overrideReason}: </span>
              {receipt.override_reason}
            </p>
          </div>
        ) : null}

        {receipt.notes ? (
          <p className="mt-2 text-xs text-neutral-600">{receipt.notes}</p>
        ) : null}

        <div className="mt-8 flex items-end gap-8">
          <SignatureLine label={L.sellerSignature} imageUrl={receipt.signature_url} />
          <SignatureLine label={L.parentSignature} />
        </div>

        <Notice notice={NOTICES.returned} />
      </article>
    </>
  );
}

function LineTable({
  title,
  items,
  locale
}: {
  title: string;
  items: ReturnReceiptData['items'];
  locale: string;
}) {
  return (
    <section className="mt-3">
      <p className="text-[0.6rem] leading-tight text-neutral-500">{title}</p>
      <table className="w-full border-collapse text-xs">
        <thead>
          <tr className="border-b text-left">
            <th className="py-1.5 font-semibold">{L.description}</th>
            <th className="py-1.5 text-right font-semibold">{L.quantity}</th>
            <th className="py-1.5 text-right font-semibold">{L.unitPrice}</th>
            <th className="py-1.5 text-right font-semibold">{L.amount}</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id} className="border-b border-dashed">
              <td className="py-1.5">
                {item.description}
                {item.size ? (
                  <span className="text-neutral-500"> ({item.size})</span>
                ) : null}
              </td>
              <td className="py-1.5 text-right tabular-nums">{item.quantity}</td>
              <td className="py-1.5 text-right tabular-nums">
                {formatMoney(Number(item.unit_price), locale)}
              </td>
              <td className="py-1.5 text-right tabular-nums">
                {formatMoney(Number(item.line_total), locale)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
