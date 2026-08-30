'use client';

import { useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Search, ShoppingBag, Scissors, TriangleAlert } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { formatDate } from '@/lib/format';
import { JobAdvanceButton } from '@/components/open-jobs/job-advance-button';
import {
  daysOpen,
  jobFlag,
  JOB_STAGES,
  matchesSearch,
  type JobStage,
  type OpenJob
} from '@/lib/open-jobs';

/**
 * The open-jobs board (A-FR-9.16, A-FR-9.17, A-FR-9.18).
 *
 * "The part that replaces remembering": every order line and alteration not yet
 * closed, oldest first, as one pile.
 *
 * Filtering and searching happen in the browser over a list the server already
 * sent. The open pile at a school uniform shop is the work of a few weeks, so
 * refetching per keystroke would add latency to solve a problem this screen
 * does not have -- and typing a student's name gives instant results, which is
 * what a counter needs.
 */

export function OpenJobsBoard({ jobs }: { jobs: OpenJob[] }) {
  const t = useTranslations('OpenJobs');
  const tOrders = useTranslations('Orders');
  const tAlt = useTranslations('Alterations');
  const locale = useLocale();

  const [stage, setStage] = useState<JobStage | 'all'>('all');
  const [query, setQuery] = useState('');

  const visible = useMemo(
    () =>
      jobs.filter(
        (job) => (stage === 'all' || job.stage === stage) && matchesSearch(job, query)
      ),
    [jobs, stage, query]
  );

  /** Each job keeps its own vocabulary; only the filter is shared. */
  const statusLabel = (job: OpenJob) =>
    job.kind === 'order'
      ? tOrders(`status.${job.statusLabel}`)
      : tAlt(`status.${job.statusLabel}`);

  const countFor = (s: JobStage | 'all') =>
    s === 'all' ? jobs.length : jobs.filter((job) => job.stage === s).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[16rem] flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t('searchPlaceholder')}
            className="pl-8"
            aria-label={t('searchPlaceholder')}
          />
        </div>

        <div className="flex flex-wrap gap-1">
          {(['all', ...JOB_STAGES] as const).map((value) => (
            <Button
              key={value}
              type="button"
              size="sm"
              variant={stage === value ? 'default' : 'outline'}
              onClick={() => setStage(value)}
            >
              {value === 'all' ? t('all') : t(`stage.${value}`)}
              <span className="ml-1.5 tabular-nums opacity-70">{countFor(value)}</span>
            </Button>
          ))}
        </div>
      </div>

      {visible.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            {jobs.length === 0 ? t('nothingOpen') : t('noMatches')}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {visible.map((job) => {
            const age = daysOpen(job.openedAt);
            const flag = jobFlag(job);
            const Icon = job.kind === 'order' ? ShoppingBag : Scissors;

            return (
              <Card
                key={job.key}
                className={
                  flag === 'overdue'
                    ? 'border-destructive shadow-[0_0_0_1px_var(--destructive)]'
                    : flag === 'aged'
                      ? 'border-amber-500/60'
                      : undefined
                }
              >
                <CardContent className="space-y-2 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-medium">
                        {job.garment}
                        {job.size ? (
                          <span className="text-muted-foreground"> ({job.size})</span>
                        ) : null}
                      </p>
                      <p className="truncate text-sm text-muted-foreground">
                        {job.studentName || job.customerName}
                        {job.classLevel ? ` · ${job.classLevel}` : ''}
                      </p>
                    </div>
                    <Icon
                      className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                      aria-label={job.kind === 'order' ? t('kindOrder') : t('kindAlteration')}
                    />
                  </div>

                  <div className="flex flex-wrap items-center gap-1">
                    <Badge variant="secondary" className="font-mono text-[0.7rem]">
                      {job.reference}
                    </Badge>
                    <Badge variant="outline" className="text-[0.7rem]">
                      {statusLabel(job)}
                    </Badge>
                    {/* The age is the number the seller scans for, so it is a
                        badge rather than buried in a line of text. */}
                    <Badge
                      variant={flag === 'overdue' ? 'destructive' : 'outline'}
                      className={
                        flag === 'aged'
                          ? 'border-amber-500 text-[0.7rem] text-amber-600 dark:text-amber-500'
                          : 'text-[0.7rem]'
                      }
                    >
                      {t('daysOpen', { days: age })}
                    </Badge>
                  </div>

                  <div className="space-y-0.5 text-xs text-muted-foreground">
                    <p>{t('openedOn', { date: formatDate(job.openedAt, locale) })}</p>
                    {job.expectedReadyDate ? (
                      <p
                        className={
                          flag === 'overdue' ? 'font-semibold text-destructive' : undefined
                        }
                      >
                        {flag === 'overdue' ? (
                          <TriangleAlert className="mr-1 inline size-3" />
                        ) : null}
                        {flag === 'overdue'
                          ? t('overdueSince', {
                              date: formatDate(job.expectedReadyDate, locale)
                            })
                          : t('expectedOn', {
                              date: formatDate(job.expectedReadyDate, locale)
                            })}
                      </p>
                    ) : null}
                  </div>

                  <div className="space-y-1.5 pt-1">
                    <JobAdvanceButton job={job} />
                    <Button asChild variant="link" size="sm" className="h-auto p-0">
                      <Link href={job.href}>{t('openJob')}</Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
