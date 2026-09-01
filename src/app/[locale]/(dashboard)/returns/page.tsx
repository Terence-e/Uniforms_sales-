import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { listReturns } from '@/actions/returns';
import { listRecentSales } from '@/actions/sales';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatDateTime, formatMoney } from '@/lib/format';

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'Returns' });
  return { title: t('title') };
}

/**
 * The returns ledger, and the way in to recording a new one.
 *
 * A return cannot be started from nothing -- every one references a sale
 * (A-FR-8.3) -- so the entry point is a sale, not a blank form. Recent sales
 * are offered here, and the sale receipt carries its own button.
 */
export default async function ReturnsPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const [returns, recent, t] = await Promise.all([
    listReturns(),
    listRecentSales(8),
    getTranslations('Returns')
  ]);

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t('title')}</h1>
          <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('ledger')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {returns.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('noneYet')}</p>
            ) : (
              returns.map((row) => {
                const sale = Array.isArray(row.sale) ? row.sale[0] : row.sale;
                const refund = Number(row.refund_amount);
                const collected = Number(row.collected_amount);
                return (
                  <div
                    key={row.id}
                    className="flex flex-wrap items-start justify-between gap-3 border-b pb-3 last:border-0 last:pb-0"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/returns/${row.id}/receipt`}
                          className="font-mono text-sm font-semibold hover:underline"
                        >
                          {row.return_no}
                        </Link>
                        <Badge variant={row.kind === 'exchange' ? 'default' : 'secondary'}>
                          {t(`kinds.${row.kind}`)}
                        </Badge>
                        {/* A-FR-8.12 enforces the policy by visibility. The
                            ledger is where "how often is this happening" gets
                            asked, so an override is marked here rather than
                            only in the audit log. */}
                        {row.within_policy === false ? (
                          <Badge variant="destructive">{t('outOfPolicy')}</Badge>
                        ) : null}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {formatDateTime(row.returned_at, locale)}
                        {sale ? ` · ${sale.receipt_no} · ${sale.customer_name}` : ''}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {row.reason}
                      </p>
                    </div>
                    <div className="text-right text-sm tabular-nums">
                      {refund > 0 ? (
                        <span className="font-semibold text-destructive">
                          − {formatMoney(refund, locale)}
                        </span>
                      ) : collected > 0 ? (
                        <span className="font-semibold">
                          + {formatMoney(collected, locale)}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">{t('evenSwap')}</span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="h-fit lg:sticky lg:top-6">
        <CardHeader>
          <CardTitle className="text-base">{t('startFromSale')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">{t('startHint')}</p>
          {recent.map((sale) => (
            <div
              key={sale.id}
              className="flex items-center justify-between gap-3 border-b pb-3 last:border-0 last:pb-0"
            >
              <div className="min-w-0">
                <p className="truncate font-mono text-xs font-semibold">
                  {sale.receipt_no}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {sale.customer_name} · {formatMoney(Number(sale.total), locale)}
                </p>
              </div>
              <Button asChild variant="outline" size="sm">
                <Link href={`/returns/new?sale=${sale.id}`}>{t('start')}</Link>
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
