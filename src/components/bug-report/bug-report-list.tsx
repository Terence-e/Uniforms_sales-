'use client';

import { useState, useTransition } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Check, RotateCcw, Image as ImageIcon } from 'lucide-react';
import { getBugReportScreenshot, setBugReportResolved } from '@/actions/bug-reports';
import { useRouter } from '@/i18n/navigation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { formatDateTime } from '@/lib/format';

export type BugReportRow = {
  id: string;
  reported_at: string;
  reporter_name: string | null;
  description: string;
  page_url: string | null;
  user_agent: string | null;
  resolved_at: string | null;
};

/**
 * The Maintenance-only report list (A-13).
 *
 * Screenshots are loaded one at a time, on demand. The list query does not
 * select them at all -- each is up to a megabyte of base64, and fetching thirty
 * to render a page nobody has opened yet would make this crawl.
 *
 * Nothing here can edit a report. The description and the captured context are
 * what was reported; only the resolved flag moves.
 */
export function BugReportList({ reports }: { reports: BugReportRow[] }) {
  const t = useTranslations('BugReport');
  const locale = useLocale();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [shots, setShots] = useState<Record<string, string | null>>({});
  const [loading, setLoading] = useState<string | null>(null);
  const [showResolved, setShowResolved] = useState(false);

  const visible = showResolved ? reports : reports.filter((r) => !r.resolved_at);
  const openCount = reports.filter((r) => !r.resolved_at).length;

  function loadScreenshot(id: string) {
    setLoading(id);
    startTransition(async () => {
      const data = await getBugReportScreenshot(id);
      setShots((current) => ({ ...current, [id]: data }));
      setLoading(null);
      if (!data) toast.info(t('noScreenshot'));
    });
  }

  function toggleResolved(id: string, resolved: boolean) {
    startTransition(async () => {
      const result = await setBugReportResolved(id, resolved);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(resolved ? t('markedResolved') : t('reopened'));
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          variant={showResolved ? 'outline' : 'default'}
          onClick={() => setShowResolved(false)}
        >
          {t('openOnly')}
          <span className="ml-1.5 tabular-nums opacity-70">{openCount}</span>
        </Button>
        <Button
          size="sm"
          variant={showResolved ? 'default' : 'outline'}
          onClick={() => setShowResolved(true)}
        >
          {t('showAll')}
          <span className="ml-1.5 tabular-nums opacity-70">{reports.length}</span>
        </Button>
      </div>

      {visible.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            {reports.length === 0 ? t('noneYet') : t('noneOpen')}
          </CardContent>
        </Card>
      ) : (
        visible.map((report) => (
          <Card key={report.id} className={report.resolved_at ? 'opacity-70' : undefined}>
            <CardContent className="space-y-3 p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0 space-y-0.5">
                  <p className="text-sm font-medium">
                    {report.reporter_name || t('unknownReporter')}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatDateTime(report.reported_at, locale)}
                  </p>
                </div>
                {report.resolved_at ? (
                  <Badge variant="secondary" className="text-[0.7rem]">
                    {t('resolved')}
                  </Badge>
                ) : null}
              </div>

              {/* Preserves the reporter's line breaks: they often list steps. */}
              <p className="whitespace-pre-wrap text-sm">{report.description}</p>

              <div className="space-y-0.5 text-xs text-muted-foreground">
                {report.page_url ? (
                  <p>
                    <span className="font-medium">{t('page')}:</span>{' '}
                    <code className="rounded bg-muted px-1 py-0.5">{report.page_url}</code>
                  </p>
                ) : null}
                {report.user_agent ? (
                  <p className="break-all">
                    <span className="font-medium">{t('browser')}:</span>{' '}
                    {report.user_agent}
                  </p>
                ) : null}
              </div>

              {shots[report.id] ? (
                // eslint-disable-next-line @next/next/no-img-element -- data URL, not an optimisable asset
                <img
                  src={shots[report.id] as string}
                  alt={t('screenshot')}
                  className="max-h-96 w-full rounded border object-contain"
                />
              ) : null}

              <div className="flex flex-wrap gap-2">
                {!(report.id in shots) ? (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={isPending && loading === report.id}
                    onClick={() => loadScreenshot(report.id)}
                  >
                    <ImageIcon className="size-3.5" />
                    {loading === report.id ? t('loading') : t('viewScreenshot')}
                  </Button>
                ) : null}

                {report.resolved_at ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={isPending}
                    onClick={() => toggleResolved(report.id, false)}
                  >
                    <RotateCcw className="size-3.5" />
                    {t('reopen')}
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={isPending}
                    onClick={() => toggleResolved(report.id, true)}
                  >
                    <Check className="size-3.5" />
                    {t('markResolved')}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}
