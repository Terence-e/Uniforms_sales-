import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { listRecentSales } from '@/actions/sales';
import { listProducts } from '@/actions/stock';
import { listStaff } from '@/actions/orders';
import { getProfile } from '@/actions/auth';
import { getSizeConfig } from '@/actions/size-config';
import { SaleForm } from '@/components/forms/sale-form';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatDateTime, formatMoney } from '@/lib/format';

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'Sales' });
  return { title: t('title') };
}

export default async function SalesPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  // Both hit the same connection pool; fetch them together rather than
  // waterfalling the product list behind the recent-sales query.
  const [products, recent, staff, profile, sizeConfig, t] = await Promise.all([
    listProducts(),
    listRecentSales(8),
    listStaff(),
    getProfile(),
    getSizeConfig(),
    getTranslations('Sales')
  ]);

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
      <div className="space-y-2">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t('title')}</h1>
          <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
        </div>
        <SaleForm
          products={products}
          staff={staff}
          currentUserId={profile?.id ?? ''}
          sizes={sizeConfig.sizes}
        />
      </div>

      <Card className="h-fit lg:sticky lg:top-6">
        <CardHeader>
          <CardTitle className="text-base">{t('recent')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {recent.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('noRecent')}</p>
          ) : (
            recent.map((sale) => (
              <div
                key={sale.id}
                className="flex items-start justify-between gap-3 border-b pb-3 last:border-0 last:pb-0"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {sale.customer_name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatDateTime(sale.sold_at, locale)}
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    <Badge variant="secondary" className="font-mono text-[0.7rem]">
                      {sale.receipt_no}
                    </Badge>
                    {sale.cancelled_at ? (
                      <Badge variant="destructive" className="text-[0.7rem]">
                        {t('cancelledBadge')}
                      </Badge>
                    ) : null}
                  </div>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <span className="tabular-nums text-sm font-medium">
                    {formatMoney(sale.total, locale)}
                  </span>
                  <Button asChild variant="link" size="sm" className="h-auto p-0">
                    <Link href={`/sales/${sale.id}/receipt`}>
                      {t('viewReceipt')}
                    </Link>
                  </Button>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
