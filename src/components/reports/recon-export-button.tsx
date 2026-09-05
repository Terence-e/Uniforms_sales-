'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Download, Printer } from 'lucide-react';
import { exportReconciliationToExcel, logReconciliationPrint } from '@/actions/reports';
import { downloadBytes } from '@/lib/excel-export';
import { Button } from '@/components/ui/button';

/** base64 -> bytes, without pulling in a dependency for eight lines. */
function decodeBase64(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/**
 * Exports the daily reconciliation for the currently filtered range -- to Excel
 * (A-FR-12.5) or to PDF via the browser's print dialog. The PDF path adds
 * `printing-recon` to <body> so the page's print stylesheet shows the
 * reconciliation alone; both exports are audited server-side (A-FR-12.6).
 */
export function ReconExportButton({ from, to }: { from: string; to: string }) {
  const t = useTranslations('Reports');
  const [busy, setBusy] = useState<null | 'excel' | 'pdf'>(null);

  async function exportExcel() {
    setBusy('excel');
    try {
      const result = await exportReconciliationToExcel(from, to);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      downloadBytes(decodeBase64(result.base64), result.filename);
    } finally {
      setBusy(null);
    }
  }

  async function exportPdf() {
    setBusy('pdf');
    try {
      // Record the export before the dialog opens (A-FR-12.6); the browser makes
      // the actual PDF from the stamped view via "Save as PDF".
      await logReconciliationPrint(from, to);
      document.body.classList.add('printing-recon');
      window.print();
    } finally {
      document.body.classList.remove('printing-recon');
      setBusy(null);
    }
  }

  const anyBusy = busy !== null;

  return (
    <div className="flex items-center gap-2 print:hidden">
      <Button variant="outline" size="sm" onClick={exportExcel} disabled={anyBusy}>
        <Download className="size-4" />
        {busy === 'excel' ? t('recon.exporting') : t('recon.export')}
      </Button>
      <Button variant="outline" size="sm" onClick={exportPdf} disabled={anyBusy}>
        <Printer className="size-4" />
        {busy === 'pdf' ? t('recon.exporting') : t('recon.exportPdf')}
      </Button>
    </div>
  );
}
