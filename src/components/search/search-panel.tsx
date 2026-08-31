'use client';

import { useState } from 'react';
import { useRouter } from '@/i18n/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { Search, ShoppingCart, PackagePlus, Scissors } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { formatDateTime, formatMoney } from '@/lib/format';
import { JOB_STAGES } from '@/lib/open-jobs';
import { hrefForHit, type SearchHit, type SearchResults, type TransactionKind } from '@/lib/search';

/**
 * The search screen (A-FR-7.6).
 *
 * Most parents arrive without their receipt, so the reference number is the
 * least likely thing anyone will have. One box takes whatever they do have --
 * a name, a phone number, or the reference if they kept it.
 *
 * Filtering is done by navigating rather than by fetching in place: the query
 * lives in the URL, so a search can be bookmarked, shared with a colleague, or
 * survive a reload. On a screen whose whole job is "find the thing again",
 * losing the search on refresh would be the wrong failure.
 */

const KINDS: TransactionKind[] = ['sale', 'order', 'alteration'];

const ICON = {
  sale: ShoppingCart,
  order: PackagePlus,
  alteration: Scissors
} as const;

export function SearchPanel({
  results,
  query
}: {
  results: SearchResults;
  query: { term: string; kinds: TransactionKind[]; stage: string; from: string; to: string };
}) {
  const t = useTranslations('Search');
  const tOrders = useTranslations('Orders');
  const tAlt = useTranslations('Alterations');
  const locale = useLocale();
  const router = useRouter();

  const [term, setTerm] = useState(query.term);

  function go(next: Partial<typeof query> & { page?: number }) {
    const merged = { ...query, ...next };
    const params = new URLSearchParams();
    if (merged.term) params.set('q', merged.term);
    if (merged.kinds.length > 0 && merged.kinds.length < KINDS.length) {
      params.set('kind', merged.kinds.join(','));
    }
    if (merged.stage) params.set('stage', merged.stage);
    if (merged.from) params.set('from', merged.from);
    if (merged.to) params.set('to', merged.to);
    if (next.page && next.page > 1) params.set('page', String(next.page));
    router.push(`/search?${params.toString()}`);
  }

  function toggleKind(kind: TransactionKind) {
    const active = query.kinds.includes(kind);
    const next = active ? query.kinds.filter((k) => k !== kind) : [...query.kinds, kind];
    // Deselecting the last one means "all", not "none" -- an empty result set
    // caused by an empty filter reads as "nothing found", which is a lie.
    go({ kinds: next.length === 0 ? KINDS : next });
  }

  /** A sale has no status; the others use their own words. */
  const statusLabel = (hit: SearchHit) => {
    if (!hit.status) return null;
    return hit.kind === 'order'
      ? tOrders(`status.${hit.status}`)
      : tAlt(`status.${hit.status}`);
  };

  const lastPage = Math.max(1, Math.ceil(results.total / results.pageSize));

  return (
    <div className="space-y-4">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          go({ term, page: 1 });
        }}
        className="flex flex-wrap items-end gap-2"
      >
        <div className="relative min-w-[18rem] flex-1">
          <Label htmlFor="q" className="mb-2 text-xs text-muted-foreground">
            {t('label')}
          </Label>
          <Search className="pointer-events-none absolute left-2.5 top-[2.15rem] size-4 text-muted-foreground" />
          <Input
            id="q"
            value={term}
            onChange={(event) => setTerm(event.target.value)}
            placeholder={t('placeholder')}
            className="pl-8"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="from" className="text-xs text-muted-foreground">
            {t('from')}
          </Label>
          <Input
            id="from"
            type="date"
            value={query.from}
            onChange={(event) => go({ from: event.target.value, page: 1 })}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="to" className="text-xs text-muted-foreground">
            {t('to')}
          </Label>
          <Input
            id="to"
            type="date"
            value={query.to}
            onChange={(event) => go({ to: event.target.value, page: 1 })}
          />
        </div>

        <Button type="submit">{t('search')}</Button>
      </form>

      <div className="flex flex-wrap items-center gap-2">
        {KINDS.map((kind) => (
          <Button
            key={kind}
            type="button"
            size="sm"
            variant={query.kinds.includes(kind) ? 'default' : 'outline'}
            onClick={() => toggleKind(kind)}
          >
            {t(`kind.${kind}`)}
          </Button>
        ))}

        <span className="mx-1 h-5 w-px bg-border" />

        {/* Only narrows the two kinds that have a status. A sale simply
            happened, so choosing a stage excludes sales entirely rather than
            pretending they have one. */}
        <Button
          type="button"
          size="sm"
          variant={query.stage === '' ? 'default' : 'outline'}
          onClick={() => go({ stage: '', page: 1 })}
        >
          {t('anyStage')}
        </Button>
        {JOB_STAGES.map((stage) => (
          <Button
            key={stage}
            type="button"
            size="sm"
            variant={query.stage === stage ? 'default' : 'outline'}
            onClick={() => go({ stage, page: 1 })}
          >
            {t(`stage.${stage}`)}
          </Button>
        ))}
      </div>

      <p className="text-sm text-muted-foreground">
        {results.total === 0 ? t('noResults') : t('resultCount', { count: results.total })}
      </p>

      <div className="space-y-2">
        {results.hits.map((hit) => {
          const Icon = ICON[hit.kind];
          const status = statusLabel(hit);
          return (
            <Card key={`${hit.kind}:${hit.id}`}>
              <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div className="flex min-w-0 items-start gap-3">
                  <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2">
                      <Badge variant="secondary" className="font-mono text-[0.7rem]">
                        {hit.reference}
                      </Badge>
                      {status ? (
                        <Badge variant="outline" className="text-[0.7rem]">
                          {status}
                        </Badge>
                      ) : null}
                    </p>
                    <p className="mt-1 truncate text-sm font-medium">
                      {hit.customerName}
                      {hit.studentName ? (
                        <span className="text-muted-foreground"> · {hit.studentName}</span>
                      ) : null}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {formatDateTime(hit.occurredAt, locale)}
                      {hit.phone ? ` · ${hit.phone}` : ''}
                    </p>
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-3">
                  <span className="tabular-nums text-sm font-medium">
                    {formatMoney(hit.amount, locale)}
                  </span>
                  <Button asChild variant="outline" size="sm">
                    <Link href={hrefForHit(hit)}>{t('open')}</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {lastPage > 1 ? (
        <div className="flex items-center justify-between gap-3 pt-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={results.page <= 1}
            onClick={() => go({ page: results.page - 1 })}
          >
            {t('previous')}
          </Button>
          <span className="text-sm text-muted-foreground">
            {t('pageOf', { page: results.page, pages: lastPage })}
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={results.page >= lastPage}
            onClick={() => go({ page: results.page + 1 })}
          >
            {t('next')}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
