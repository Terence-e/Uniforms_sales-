'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Download } from 'lucide-react';
import { exportReconciliationToExcel } from '@/actions/reports';
import { downloadBytes } from '@/lib/excel-export';
import { Button } from '@/components/ui/button';

/** base64 -> bytes, without pulling in a dependency for eight lines. */
function decodeBase64(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/** Downloads the daily reconciliation for the currently filtered range. */
export function ReconExportButton({ from, to }: { from: string; to: string }) {
  const t = useTranslations('Reports');
  const [busy, setBusy] = useState(false);

  async function handleExport() {
    setBusy(true);
    try {
      const result = await exportReconciliationToExcel(from, to);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      downloadBytes(decodeBase64(result.base64), result.filename);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button variant="outline" size="sm" onClick={handleExport} disabled={busy}>
      <Download className="size-4" />
      {busy ? t('recon.exporting') : t('recon.export')}
    </Button>
  );
}
