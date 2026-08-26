'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Download } from 'lucide-react';
import { useRouter } from '@/i18n/navigation';
import { exportSalesToExcel } from '@/actions/sales';
import { downloadBytes } from '@/lib/excel-export';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

/** base64 -> bytes, without pulling in a dependency for eight lines. */
function decodeBase64(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export function ExportPanel({
  initialFrom,
  initialTo
}: {
  initialFrom: string;
  initialTo: string;
}) {
  const t = useTranslations('Reports');
  const router = useRouter();
  const [from, setFrom] = useState(initialFrom);
  const [to, setTo] = useState(initialTo);
  const [isExporting, setIsExporting] = useState(false);
  const [isPending, startTransition] = useTransition();

  /** Keep the range in the URL so the server-rendered summary follows along. */
  function syncRange(nextFrom: string, nextTo: string) {
    startTransition(() => {
      router.replace(`/reports?from=${nextFrom}&to=${nextTo}`);
    });
  }

  async function handleExport() {
    setIsExporting(true);
    try {
      const result = await exportSalesToExcel(from, to);

      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      if (result.count === 0) {
        toast.info(t('empty'));
        return;
      }

      downloadBytes(decodeBase64(result.base64), result.filename);
    } finally {
      setIsExporting(false);
    }
  }

  const busy = isExporting || isPending;

  return (
    <div className="flex flex-wrap items-end gap-4">
      <div className="space-y-2">
        <Label htmlFor="from">{t('from')}</Label>
        <Input
          id="from"
          type="date"
          value={from}
          max={to}
          onChange={(event) => {
            setFrom(event.target.value);
            syncRange(event.target.value, to);
          }}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="to">{t('to')}</Label>
        <Input
          id="to"
          type="date"
          value={to}
          min={from}
          onChange={(event) => {
            setTo(event.target.value);
            syncRange(from, event.target.value);
          }}
        />
      </div>

      <Button onClick={handleExport} disabled={busy}>
        <Download className="size-4" />
        {isExporting ? t('exporting') : t('export')}
      </Button>
    </div>
  );
}
