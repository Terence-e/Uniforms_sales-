import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { isReprintRequest, logReprint } from '@/actions/reprints';
import { getReturnWithItems } from '@/actions/returns';
import { ReturnReceipt, type ReturnReceiptData } from '@/components/receipt/return-receipt';

type Props = {
  params: Promise<{ locale: string; id: string }>;
  /** `?reprint=1` marks the sheet DUPLICATA / DUPLICATE and logs it. */
  searchParams: Promise<{ reprint?: string }>;
};

export async function generateMetadata({ params }: Props) {
  const { locale, id } = await params;
  const t = await getTranslations({ locale, namespace: 'Returns' });
  const row = await getReturnWithItems(id);
  return { title: row ? `${t('receiptTitle')} ${row.return_no}` : t('receiptTitle') };
}

/** The RTN receipt (A-FR-8.4). */
export default async function ReturnReceiptPage({ params, searchParams }: Props) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  const row = await getReturnWithItems(id);
  if (!row) notFound();

  // A reprint is stamped and recorded; the plain URL stays the original
  // (A-FR-7.12).
  const duplicate = await isReprintRequest(searchParams);
  if (duplicate) {
    await logReprint({ kind: 'return', id: row.id, reference: row.return_no });
  }

  // PostgREST returns an embedded one-to-one as either an object or a
  // single-element array depending on how it inferred the relationship.
  const one = <T,>(value: T | T[] | null): T | null =>
    Array.isArray(value) ? (value[0] ?? null) : value;

  const sale = one(row.sale);
  if (!sale) notFound();

  const receipt: ReturnReceiptData = {
    id: row.id,
    return_no: row.return_no,
    kind: row.kind,
    returned_at: row.returned_at,
    reason: row.reason,
    condition: row.condition,
    notes: row.notes,
    refund_amount: Number(row.refund_amount),
    refund_method: row.refund_method,
    collected_amount: Number(row.collected_amount),
    collected_method: row.collected_method,
    signature_url: row.signature_url,
    duplicate,
    sale,
    seller_name: one(row.seller)?.full_name ?? '',
    recorded_by_name: one(row.recordedBy)?.full_name ?? null,
    received_by_name: one(row.receivedBy)?.full_name ?? null,
    items: row.items ?? []
  };

  return <ReturnReceipt receipt={receipt} />;
}
