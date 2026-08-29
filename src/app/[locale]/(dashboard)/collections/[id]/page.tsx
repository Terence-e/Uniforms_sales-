import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { getCollection } from '@/actions/orders';
import {
  CollectionSlip,
  type CollectionSlipData
} from '@/components/receipt/collection-slip';

type Props = { params: Promise<{ locale: string; id: string }> };

export async function generateMetadata({ params }: Props) {
  const { locale, id } = await params;
  const t = await getTranslations({ locale, namespace: 'Collection' });
  const collection = await getCollection(id);
  return { title: collection ? `${t('title')} ${collection.col_no}` : t('title') };
}

export default async function CollectionSlipPage({ params }: Props) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  // RLS decides visibility through the parent order, exactly as the receipt
  // pages do: a seller asking for someone else's slip gets no row back.
  const collection = await getCollection(id);
  if (!collection || !collection.order) notFound();

  const slip: CollectionSlipData = {
    col_no: collection.col_no,
    collected_at: collection.collected_at,
    collector_name: collection.collector_name,
    handed_over_by: collection.handedOver?.full_name ?? '',
    order_id: collection.order.id,
    order_no: collection.order.order_no,
    ordered_at: collection.order.ordered_at,
    customer_name: collection.order.customer_name,
    student_name: collection.order.student_name,
    class_level: collection.order.class_level,
    // collection_items wraps the order line, so unwrap to what the sheet prints.
    items: (collection.items ?? [])
      .map((entry) => entry.line)
      .filter((line): line is NonNullable<typeof line> => line !== null)
      .map((line) => ({
        id: line.id,
        description: line.description,
        size: line.size,
        quantity: line.quantity,
        line_total: line.line_total
      }))
  };

  return <CollectionSlip slip={slip} />;
}
