import { getTranslations, setRequestLocale } from 'next-intl/server';
import { getDailyReconciliation, getReport, reportStamp } from '@/actions/reports';
import { DailyReconciliation } from '@/components/reports/daily-reconciliation';
import { ReconExportButton } from '@/components/reports/recon-export-button';
import { ReportControls } from '@/components/reports/report-controls';
import { ReportView } from '@/components/reports/report-view';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toDateInputValue } from '@/lib/format';
import { isReportKey, type ReportKey } from '@/lib/report-types';

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{
    from?: string;
    to?: string;
    report?: string;
    sfrom?: string;
    sto?: string;
  }>;
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

  const { from: rawFrom, to: rawTo, report: rawReport, sfrom: rawSfrom, sto: rawSto } =
    await searchParams;
  const now = new Date();
  const today = toDateInputValue(now);
  const monthStart = toDateInputValue(new Date(now.getFullYear(), now.getMonth(), 1));

  // The daily reconciliation defaults to today. Reject non-dates before new Date().
  const from = rawFrom && DATE_RE.test(rawFrom) ? rawFrom : today;
  const to = rawTo && DATE_RE.test(rawTo) ? rawTo : today;

  // The report suite has its own range (defaults to month-to-date) and selected
  // report, so it never fights the reconciliation's date filter.
  const reportKey: ReportKey = rawReport && isReportKey(rawReport) ? rawReport : 'sales-by-period';
  const sfrom = rawSfrom && DATE_RE.test(rawSfrom) ? rawSfrom : monthStart;
  const sto = rawSto && DATE_RE.test(rawSto) ? rawSto : today;

  const [recon, reportResult, stamp, t] = await Promise.all([
    getDailyReconciliation(from, to),
    getReport(reportKey, sfrom, sto),
    reportStamp(sfrom, sto),
    getTranslations('Reports')
  ]);

  return (
    <div className="space-y-6">
      {/* Print-to-PDF (A-FR-12.5): show only the stamped report view, whatever
          the dashboard chrome or the other sections on the page. */}
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          .report-print-area, .report-print-area * { visibility: visible !important; }
          .report-print-area { position: absolute; inset: 0; width: 100%; padding: 0; }
        }
      `}</style>

      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t('title')}</h1>
        <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">{t('recon.title')}</h2>
          <p className="text-sm text-muted-foreground">{t('recon.range', { from, to })}</p>
        </div>
        <ReconExportButton from={from} to={to} />
      </div>
      <DailyReconciliation data={recon} locale={locale} />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('suite.title')}</CardTitle>
          <CardDescription>{t('suite.subtitle')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <ReportControls report={reportKey} from={sfrom} to={sto} />
          <ReportView result={reportResult} stamp={stamp} locale={locale} />
        </CardContent>
      </Card>
    </div>
  );
}
