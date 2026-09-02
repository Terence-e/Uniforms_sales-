import { isReprintRequest, logReprint } from '@/actions/reprints';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { getAlteration } from '@/actions/alterations';
import { DepositSlip, type DepositSlipData } from '@/components/receipt/deposit-slip';
import { referenceQrSvg } from '@/lib/qr';

type Props = {
  params: Promise<{ locale: string; id: string }>;
  /** `?reprint=1` marks the sheet DUPLICATA / DUPLICATE and logs it. */
  searchParams: Promise<{ reprint?: string }>;
};

export async function generateMetadata({ params }: Props) {
  const { locale, id } = await params;
  const t = await getTranslations({ locale, namespace: 'Alterations' });
  const alteration = await getAlteration(id);
  return {
    title: alteration ? `${t('slipTitle')} ${alteration.alteration_no}` : t('slipTitle')
  };
}

export default async function DepositSlipPage({ params, searchParams }: Props) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  const alteration = await getAlteration(id);
  if (!alteration) notFound();


  // A reprint is stamped and recorded; the plain URL stays the original
  // (A-FR-7.12).
  const duplicate = await isReprintRequest(searchParams);
  if (duplicate) {
    await logReprint({ kind: 'alteration', id: alteration.id, reference: alteration.alteration_no });
  }
  const slip: DepositSlipData = {
    duplicate,
    qr_svg: referenceQrSvg(alteration.alteration_no),
    alteration_id: alteration.id,
    alteration_no: alteration.alteration_no,
    received_at: alteration.received_at,
    expected_ready_date: alteration.expected_ready_date,
    customer_name: alteration.customer_name,
    student_name: alteration.student_name,
    class_level: alteration.class_level,
    phone: alteration.phone,
    garment: alteration.garment,
    size: alteration.size,
    work_required: alteration.work_required,
    charge: alteration.charge,
    payment_method: alteration.payment_method,
    paid_at: alteration.paid_at,
    received_by: alteration.receivedBy?.full_name ?? ''
  };

  return <DepositSlip slip={slip} />;
}
