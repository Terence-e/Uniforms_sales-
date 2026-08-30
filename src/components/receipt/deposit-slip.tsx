'use client';

import { useLocale, useTranslations } from 'next-intl';
import { Printer, ArrowLeft, Copy } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';
import { DuplicateStamp } from '@/components/receipt/duplicate-stamp';
import { formatDate, formatDateTime, formatMoney, SCHOOL } from '@/lib/format';
import type { PaymentMethod } from '@/types/database.types';

export type DepositSlipData = {
  /** A reprint, stamped DUPLICATA / DUPLICATE (A-FR-7.12). */
  duplicate?: boolean;
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
 * Prints on the same A5 sheet as the other documents so the shop checks one
 * paper size against one printer.
 */
export function DepositSlip({ slip }: { slip: DepositSlipData }) {
  const t = useTranslations('Alterations');
  const tReceipt = useTranslations('Receipt');
  const tSales = useTranslations('Sales');
  const locale = useLocale();

  const due = slip.charge > 0 && !slip.paid_at;

  return (
    <>
      <style>{`
        @page {
          size: A5 portrait;
          margin: 12mm;
        }
        @media print {
          html, body { background: #fff !important; }
          .receipt-sheet {
            box-shadow: none !important;
            border: 0 !important;
            padding: 0 !important;
            max-width: none !important;
          }
        }
      `}</style>

      <div className="mb-4 flex items-center justify-between gap-3 print:hidden">
        <Button asChild variant="ghost" size="sm">
          <Link href={`/alterations/${slip.alteration_id}`}>
            <ArrowLeft className="size-4" />
            {t('backToAlteration')}
          </Link>
        </Button>
        <div className="flex items-center gap-2">
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
        <header className="border-b pb-4 text-center">
          <h1 className="text-lg font-bold uppercase tracking-wide">{SCHOOL.name}</h1>
          {SCHOOL.address ? (
            <p className="text-xs text-neutral-600">{SCHOOL.address}</p>
          ) : null}
          {SCHOOL.phone ? <p className="text-xs text-neutral-600">{SCHOOL.phone}</p> : null}

          {/* Bilingual whatever the UI locale: the parent holding this may not
              share the language the seller was working in. */}
          <div className="mt-2 border-2 border-black px-3 py-2">
            <p className="text-base font-bold uppercase tracking-wide">
              Bon de dépôt / Deposit slip
            </p>
            <p className="text-[0.7rem] font-semibold uppercase">
              Vêtement confié à l&apos;école · Garment held by the school
            </p>
          </div>
          {slip.duplicate ? <DuplicateStamp /> : null}
        </header>

        <dl className="grid grid-cols-2 gap-x-6 gap-y-1 border-b py-4 text-xs">
          <Meta label={t('slipNo')} value={slip.alteration_no} mono />
          <Meta label={t('receivedAt')} value={formatDateTime(slip.received_at, locale)} />
          <Meta label={t('parentName')} value={slip.customer_name} />
          {slip.phone ? <Meta label={tSales('phone')} value={slip.phone} /> : null}
          {slip.student_name ? (
            <Meta label={tSales('studentName')} value={slip.student_name} />
          ) : null}
          {slip.class_level ? (
            <Meta label={tSales('classLevel')} value={slip.class_level} />
          ) : null}
          {slip.expected_ready_date ? (
            <Meta
              label={t('expectedReadyDate')}
              value={formatDate(slip.expected_ready_date, locale)}
            />
          ) : null}
          <Meta label={t('receivedBy')} value={slip.received_by} />
        </dl>

        <section className="border-b py-4">
          <p className="text-xs uppercase text-neutral-500">{t('garment')}</p>
          <p className="text-sm font-semibold">
            {slip.garment}
            {slip.size ? (
              <span className="font-normal text-neutral-600"> ({slip.size})</span>
            ) : null}
          </p>

          <p className="mt-3 text-xs uppercase text-neutral-500">{t('workRequired')}</p>
          {/* Preserves the line breaks the seller typed: this text is what a
              disagreement months later gets settled against. */}
          <p className="whitespace-pre-wrap text-sm">{slip.work_required}</p>
        </section>

        <section className="py-4 text-sm">
          {slip.charge > 0 ? (
            <div className="flex items-baseline justify-between">
              <span className="text-neutral-600">
                {due ? t('dueOnReturn') : t('paidLabel')}
              </span>
              <span className="font-bold tabular-nums">
                {formatMoney(slip.charge, locale)}
              </span>
            </div>
          ) : (
            <p className="text-neutral-600">{t('noCharge')}</p>
          )}
          {slip.paid_at && slip.payment_method ? (
            <p className="mt-1 text-xs text-neutral-600">
              {tSales(`payment.${slip.payment_method}`)} ·{' '}
              {formatDateTime(slip.paid_at, locale)}
            </p>
          ) : null}
        </section>

        <div className="mt-6 flex items-end justify-between gap-8">
          <div className="flex-1">
            <p className="mb-1 text-[0.65rem] uppercase text-neutral-500">
              {t('parentSignature')}
            </p>
            <div className="h-16 border-b border-neutral-400" />
          </div>
        </div>

        <footer className="mt-6 border-t pt-3 text-center text-[0.65rem] text-neutral-500">
          {t('slipFooter')}
        </footer>
      </article>
    </>
  );
}

function Meta({
  label,
  value,
  mono
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex gap-2">
      <dt className="text-neutral-600">{label}:</dt>
      <dd className={mono ? 'font-mono font-semibold' : 'font-medium'}>{value}</dd>
    </div>
  );
}
