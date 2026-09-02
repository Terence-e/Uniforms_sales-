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
import { formatDate, formatDateTime, formatMoney } from '@/lib/format';
import type { PaymentMethod } from '@/types/database.types';

export type DepositSlipData = {
  /** A reprint, stamped DUPLICATA / DUPLICATE (A-FR-7.12). */
  duplicate?: boolean;
  /** The ALT reference as a QR (A-FR-7.7), built server-side. */
  qr_svg?: string | null;
  alteration_no: string;
  received_at: string;
  expected_ready_date: string | null;
  customer_name: string;
  student_name: string | null;
  class_level: string | null;
  phone: string | null;
  garment: string;
  size: string | null;
  work_required: string;
  charge: number;
  payment_method: PaymentMethod | null;
  paid_at: string | null;
  received_by: string;
  alteration_id: string;
};

/**
 * The deposit slip (A-FR-9.14).
 *
 * This document exists for one reason: it is the parent's proof that the school
 * is holding a garment they own. That makes it different in kind from the sale
 * receipt and the collection slip, which record money and goods leaving the
 * shop's own stock -- so it says what was taken in, what was agreed, and when
 * to come back, and it carries no line-item table at all.
 *
 * Every printed label is bilingual and comes from `L` (A-FR-7.10). The parent
 * holding this slip is the least likely of anyone to share the language the
 * seller had the screen in, and this is the paper they bring back weeks later.
 */
export function DepositSlip({ slip }: { slip: DepositSlipData }) {
  const t = useTranslations('Alterations');
  const tReceipt = useTranslations('Receipt');
  const locale = useLocale();
  const { paper, choose } = usePaperSize();

  const due = slip.charge > 0 && !slip.paid_at;

  return (
    <>
      <ReceiptStyle paper={paper} />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Button asChild variant="ghost" size="sm">
          <Link href={`/alterations/${slip.alteration_id}`}>
            <ArrowLeft className="size-4" />
            {t('backToAlteration')}
          </Link>
        </Button>
        <div className="flex items-center gap-2">
          <PaperToggle paper={paper} onChange={choose} />
          {!slip.duplicate ? (
            <Button asChild variant="outline" size="sm">
              <Link href={`/alterations/${slip.alteration_id}/slip?reprint=1`}>
                <Copy className="size-4" />
                {tReceipt('reprint')}
              </Link>
            </Button>
          ) : null}
          <Button size="sm" onClick={() => window.print()}>
            <Printer className="size-4" />
            {t('printSlip')}
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
            <p className="text-sm font-bold uppercase tracking-wide">{L.depositTitle}</p>
            <p className="text-[0.65rem] font-semibold uppercase">{L.garmentHeld}</p>
          </div>
          {slip.duplicate ? <DuplicateStamp /> : null}
        </header>

        <dl className="grid grid-cols-3 gap-x-4 gap-y-2 border-b py-3">
          <Meta label={L.slipNo} value={slip.alteration_no} mono />
          <Meta label={L.receivedAt} value={formatDateTime(slip.received_at, locale)} />
          {slip.expected_ready_date ? (
            <Meta
              label={L.expectedReady}
              value={formatDate(slip.expected_ready_date, locale)}
            />
          ) : null}
          <Meta label={L.customer} value={slip.customer_name} />
          {slip.phone ? <Meta label={L.phone} value={slip.phone} /> : null}
          {slip.student_name ? (
            <Meta label={L.student} value={slip.student_name} />
          ) : null}
          {slip.class_level ? <Meta label={L.class} value={slip.class_level} /> : null}
          <Meta label={L.alterationReceivedBy} value={slip.received_by} />
        </dl>

        <section className="border-b py-3">
          <p className="text-[0.6rem] leading-tight text-neutral-500">{L.garment}</p>
          <p className="text-sm font-semibold">
            {slip.garment}
            {slip.size ? (
              <span className="font-normal text-neutral-600"> ({slip.size})</span>
            ) : null}
          </p>

          <p className="mt-3 text-[0.6rem] leading-tight text-neutral-500">
            {L.workRequired}
          </p>
          {/* Preserves the line breaks the seller typed: this text is what a
              disagreement months later gets settled against. */}
          <p className="whitespace-pre-wrap text-sm">{slip.work_required}</p>
        </section>

        <section className="py-3 text-sm">
          {slip.charge > 0 ? (
            <div className="flex items-baseline justify-between">
              <span className="text-neutral-600">{due ? L.dueOnReturn : L.paid}</span>
              <span className="font-bold tabular-nums">
                {formatMoney(slip.charge, locale)}
              </span>
            </div>
          ) : (
            <p className="text-neutral-600">{L.noCharge}</p>
          )}
          {slip.paid_at && slip.payment_method ? (
            <p className="mt-1 text-xs text-neutral-600">
              {PAYMENT_LABELS[slip.payment_method]} &middot;{' '}
              {formatDateTime(slip.paid_at, locale)}
            </p>
          ) : null}
        </section>

        <div className="mt-6 flex items-end gap-8">
          <SignatureLine label={L.alterationReceivedBy} />
          <SignatureLine label={L.parentSignature} />
        </div>

        <Notice notice={NOTICES.deposit} />
      </article>
    </>
  );
}
