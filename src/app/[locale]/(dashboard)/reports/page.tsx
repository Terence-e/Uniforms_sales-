import { getTranslations, setRequestLocale } from 'next-intl/server';
import { getDailyReconciliation, getReport, reportStamp } from '@/actions/reports';
import { DailyReconciliation } from '@/components/reports/daily-reconciliation';
import { ReconExportButton } from '@/components/reports/recon-export-button';
import { ReportControls } from '@/components/reports/report-controls';
import { ReportView } from '@/components/reports/report-view';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { SCHOOL, toDateInputValue, startOfMonth, endOfMonth } from '@/lib/format';
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

  // The daily reconciliation defaults to today. Reject non-dates before new Date().
  const from = rawFrom && DATE_RE.test(rawFrom) ? rawFrom : today;
  const to = rawTo && DATE_RE.test(rawTo) ? rawTo : today;

  // The report suite has its own range and selected report, so it never fights
  // the reconciliation's date filter. It defaults to the whole current month --
  // the first day to the last day (A-FR: a month is a full calendar month).
  const reportKey: ReportKey = rawReport && isReportKey(rawReport) ? rawReport : 'sales-by-period';
  const sfrom = rawSfrom && DATE_RE.test(rawSfrom) ? rawSfrom : startOfMonth(now);
  const sto = rawSto && DATE_RE.test(rawSto) ? rawSto : endOfMonth(now);

  const [recon, reportResult, stamp, reconStamp, t] = await Promise.all([
    getDailyReconciliation(from, to),
    getReport(reportKey, sfrom, sto),
    reportStamp(sfrom, sto),
    reportStamp(from, to),
    getTranslations('Reports')
  ]);

  return (
    <div className="space-y-6">
      {/* Print-to-PDF (A-FR-12.5): isolate whichever section is being printed.
          The suite prints by default; the reconciliation button adds
          `printing-recon` to <body> to switch which area is shown. */}
      <style>{`
        @media print {
          body:not(.printing-recon) * { visibility: hidden !important; }
          body:not(.printing-recon) .report-print-area,
          body:not(.printing-recon) .report-print-area * { visibility: visible !important; }
          body:not(.printing-recon) .report-print-area { position: absolute; inset: 0; width: 100%; padding: 0; }

          body.printing-recon * { visibility: hidden !important; }
          body.printing-recon .recon-print-area,
          body.printing-recon .recon-print-area * { visibility: visible !important; }
          body.printing-recon .recon-print-area { position: absolute; inset: 0; width: 100%; padding: 0; }
        }
      `}</style>

      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t('title')}</h1>
        <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
      </div>

      {/* Report suite first, above the daily reconciliation. */}
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

      <div className="recon-print-area space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">{t('recon.title')}</h2>
            <p className="text-sm text-muted-foreground">{t('recon.range', { from, to })}</p>
          </div>
          <ReconExportButton from={from} to={to} />
        </div>

        {/* Stamp shown only on the printed PDF (A-FR-12.5): school, range, and
            who generated it when. */}
        <div className="hidden print:block">
          <h2 className="text-lg font-semibold">{SCHOOL.name} — {t('recon.title')}</h2>
          <p className="text-sm">{t('recon.range', { from, to })}</p>
          <p className="text-xs text-muted-foreground">
            {t('suite.stamp', { name: reconStamp.generatedBy, at: reconStamp.generatedAt })}
          </p>
        </div>

        <DailyReconciliation data={recon} locale={locale} />
      </div>
    </div>
  );
}
