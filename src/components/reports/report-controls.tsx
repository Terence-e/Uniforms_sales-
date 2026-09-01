'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Download, Printer } from 'lucide-react';
import { useRouter } from '@/i18n/navigation';
import { exportReportExcel, logReportPrint } from '@/actions/reports';
import { downloadBytes } from '@/lib/excel-export';
import { REPORT_KEYS, type ReportKey } from '@/lib/report-types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';

function decodeBase64(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/**
 * Report picker + date range + export/print controls. The selection lives in the
 * URL (?report&sfrom&sto) so the server re-renders the chosen report -- which is
 * what the print-to-PDF then captures. Both exports are audited server-side.
 */
export function ReportControls({
  report,
  from,
  to
}: {
  report: ReportKey;
  from: string;
  to: string;
}) {
  const t = useTranslations('Reports');
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [busy, setBusy] = useState<null | 'excel' | 'pdf'>(null);

  const sync = (next: { report?: string; from?: string; to?: string }) => {
    const params = new URLSearchParams({
      report: next.report ?? report,
      sfrom: next.from ?? from,
      sto: next.to ?? to
    });
    startTransition(() => router.replace(`/reports?${params.toString()}`));
  };

  async function exportExcel() {
    setBusy('excel');
    try {
      const res = await exportReportExcel(report, from, to);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      downloadBytes(decodeBase64(res.base64), res.filename);
    } finally {
      setBusy(null);
    }
  }

  async function exportPdf() {
    setBusy('pdf');
    try {
      // Record the export before the print dialog opens (A-FR-12.6); the browser
      // produces the actual PDF from the stamped view via "Save as PDF".
      await logReportPrint(report, from, to);
      window.print();
    } finally {
      setBusy(null);
    }
  }

  const anyBusy = isPending || busy !== null;

  return (
    <div className="flex flex-wrap items-end gap-4 print:hidden">
      <div className="space-y-2">
        <Label htmlFor="report">{t('suite.report')}</Label>
        <Select value={report} onValueChange={(value) => sync({ report: value })}>
          <SelectTrigger id="report" size="sm" className="w-64">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {REPORT_KEYS.map((key) => (
              <SelectItem key={key} value={key}>
                {t(`suite.reports.${key}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="sfrom">{t('from')}</Label>
        <Input
          id="sfrom"
          type="date"
          value={from}
          max={to}
          onChange={(event) => sync({ from: event.target.value })}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="sto">{t('to')}</Label>
        <Input
          id="sto"
          type="date"
          value={to}
          min={from}
          onChange={(event) => sync({ to: event.target.value })}
        />
      </div>

      <Button variant="outline" size="sm" onClick={exportExcel} disabled={anyBusy}>
        <Download className="size-4" />
        {busy === 'excel' ? t('exporting') : t('suite.exportExcel')}
      </Button>
      <Button variant="outline" size="sm" onClick={exportPdf} disabled={anyBusy}>
        <Printer className="size-4" />
        {busy === 'pdf' ? t('exporting') : t('suite.exportPdf')}
      </Button>
    </div>
  );
}
