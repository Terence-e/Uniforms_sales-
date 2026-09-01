import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { getProfile } from '@/actions/auth';
import { listCancellations } from '@/actions/sales';
import { SaleCancelButton } from '@/components/sales/sale-cancel-button';
import { Link } from '@/i18n/navigation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { formatDateTime, formatMoney } from '@/lib/format';

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'Sales' });
  return { title: t('cancelPageTitle') };
}

export default async function CancellationsPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const [profile, t] = await Promise.all([getProfile(), getTranslations('Sales')]);
  // Operators only -- Administration is read-only (A-FR-2.2). RLS/the RPC enforce
  // it too; this keeps the screen off their nav and out of their reach.
  if (!profile || !['seller', 'maintenance', 'super_admin'].includes(profile.role)) {
    notFound();
  }

  const { live, cancelled } = await listCancellations();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t('cancelPageTitle')}</h1>
        <p className="text-sm text-muted-foreground">{t('cancelPageSubtitle')}</p>
      </div>

      {/* Cancel a sale */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('liveHeading')}</CardTitle>
          <CardDescription>{t('liveHint')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {live.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('noLive')}</p>
          ) : (
            live.map((sale) => (
              <div
                key={sale.id}
                className="flex flex-wrap items-center justify-between gap-3 border-b pb-3 last:border-0 last:pb-0"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{sale.customer_name}</p>
                  <div className="mt-1 flex items-center gap-2">
                    <Badge variant="secondary" className="font-mono text-[0.7rem]">
                      {sale.receipt_no}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {formatDateTime(sale.sold_at, locale)}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="tabular-nums text-sm font-medium">
                    {formatMoney(sale.total, locale)}
                  </span>
                  <Button asChild variant="link" size="sm" className="h-auto p-0">
                    <Link href={`/sales/${sale.id}/receipt`}>{t('viewReceipt')}</Link>
                  </Button>
                  <SaleCancelButton saleId={sale.id} />
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* Cancelled history */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('cancelledHeading')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {cancelled.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('noCancelled')}</p>
          ) : (
            cancelled.map((sale) => (
              <div key={sale.id} className="border-b pb-3 last:border-0 last:pb-0">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/sales/${sale.id}/receipt`}
                      className="font-mono text-sm hover:underline"
                    >
                      {sale.receipt_no}
                    </Link>
                    <Badge variant="destructive" className="text-[0.7rem]">
                      {t('cancelledBadge')}
                    </Badge>
                  </div>
                  <span className="tabular-nums text-sm text-muted-foreground line-through">
                    {formatMoney(sale.total, locale)}
                  </span>
                </div>
                <p className="mt-1 text-sm">{sale.customer_name}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {sale.cancelled_at
                    ? t('cancelledBy', { name: sale.cancelledBy?.full_name ?? '—' }) +
                      ' · ' +
                      formatDateTime(sale.cancelled_at, locale)
                    : null}
                </p>
                <p className="text-xs text-muted-foreground">
                  {t('cancelReason', { reason: sale.cancel_reason ?? '—' })}
                </p>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
