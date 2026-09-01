import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { getSaleForReturn } from '@/actions/returns';
import { listProducts } from '@/actions/stock';
import { listStaff } from '@/actions/orders';
import { getProfile } from '@/actions/auth';
import { ReturnForm } from '@/components/forms/return-form';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { formatDateTime, formatMoney } from '@/lib/format';

type Props = {
  params: Promise<{ locale: string }>;
  /** `?sale=<id>` -- a return always references one (A-FR-8.3). */
  searchParams: Promise<{ sale?: string }>;
};

export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'Returns' });
  return { title: t('newTitle') };
}

export default async function NewReturnPage({ params, searchParams }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const { sale: saleId } = await searchParams;
  const t = await getTranslations('Returns');

  // No sale, no return. Rather than 404 on a missing parameter, send the seller
  // to the list where they can pick one.
  if (!saleId) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold tracking-tight">{t('newTitle')}</h1>
        <p className="text-sm text-muted-foreground">{t('needASale')}</p>
        <Button asChild>
          <Link href="/returns">{t('backToReturns')}</Link>
        </Button>
      </div>
    );
  }

  const [sale, products, staff, profile] = await Promise.all([
    getSaleForReturn(saleId),
    listProducts(),
    listStaff(),
    getProfile()
  ]);

  // RLS decides visibility: a sale the caller cannot see comes back empty,
  // which lands here as a 404 rather than a leak.
  if (!sale) notFound();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t('newTitle')}</h1>
        <p className="text-sm text-muted-foreground">{t('newSubtitle')}</p>
      </div>

      {/* The sale as it stands, printed above the form and never editable.
          A-FR-8.6: the original is not modified, and showing it read-only is
          the honest way to say so. */}
      <Card>
        <CardContent className="grid gap-2 pt-6 text-sm sm:grid-cols-4">
          <div>
            <p className="text-xs text-muted-foreground">{t('originalReceipt')}</p>
            <p className="font-mono font-semibold">{sale.receipt_no}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">{t('soldOn')}</p>
            <p>{formatDateTime(sale.sold_at, locale)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">{t('customer')}</p>
            <p>{sale.customer_name}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">{t('saleTotal')}</p>
            <p className="font-semibold tabular-nums">
              {formatMoney(Number(sale.total), locale)}
            </p>
          </div>
        </CardContent>
      </Card>

      <ReturnForm
        saleId={sale.id}
        receiptNo={sale.receipt_no}
        lines={sale.items}
        products={products}
        staff={staff}
        currentUserId={profile?.id ?? ''}
      />
    </div>
  );
}
