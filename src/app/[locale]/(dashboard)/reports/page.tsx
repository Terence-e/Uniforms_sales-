import { getTranslations, setRequestLocale } from 'next-intl/server';
import { getSalesSummary } from '@/actions/sales';
import { getDailyReconciliation } from '@/actions/reports';
import { DailyReconciliation } from '@/components/reports/daily-reconciliation';
import { ReconExportButton } from '@/components/reports/recon-export-button';
import { ExportPanel } from '@/components/forms/export-panel';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { formatMoney, toDateInputValue } from '@/lib/format';

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ from?: string; to?: string }>;
};

export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'Reports' });
  return { title: t('title') };
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export default async function ReportsPage({ params, searchParams }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const { from: rawFrom, to: rawTo } = await searchParams;
  const today = toDateInputValue(new Date());

  // This is the daily reconciliation, so both ends default to today; the filter
  // widens it for period reports. Reject anything that isn't a plain date first.
  const from = rawFrom && DATE_RE.test(rawFrom) ? rawFrom : today;
  const to = rawTo && DATE_RE.test(rawTo) ? rawTo : today;

  const [summary, recon, t] = await Promise.all([
    getSalesSummary(from, to),
    getDailyReconciliation(from, to),
    getTranslations('Reports')
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t('title')}</h1>
        <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('export')}</CardTitle>
          <CardDescription>
            {summary.count === 0
              ? t('empty')
              : t('summary', {
                  count: summary.count,
                  total: formatMoney(summary.total, locale)
                })}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ExportPanel initialFrom={from} initialTo={to} />
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">{t('recon.title')}</h2>
          <p className="text-sm text-muted-foreground">{t('recon.range', { from, to })}</p>
        </div>
        <ReconExportButton from={from} to={to} />
      </div>
      <DailyReconciliation data={recon} locale={locale} />
    </div>
  );
}
