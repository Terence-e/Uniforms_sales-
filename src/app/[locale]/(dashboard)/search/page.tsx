import { getTranslations, setRequestLocale } from 'next-intl/server';
import { searchTransactions } from '@/actions/search';
import type { TransactionKind } from '@/lib/search';
import { SearchPanel } from '@/components/search/search-panel';

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{
    q?: string;
    kind?: string;
    stage?: string;
    from?: string;
    to?: string;
    page?: string;
  }>;
};

const ALL_KINDS: TransactionKind[] = ['sale', 'order', 'alteration'];

export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'Search' });
  return { title: t('title') };
}

export default async function SearchPage({ params, searchParams }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const sp = await searchParams;

  // The whole query lives in the URL so a search can be bookmarked, shared with
  // a colleague or survive a reload -- on a screen whose job is "find it
  // again", losing the search on refresh would be the wrong failure.
  const kinds = sp.kind
    ? (sp.kind.split(',').filter((k) => ALL_KINDS.includes(k as TransactionKind)) as TransactionKind[])
    : ALL_KINDS;

  const [results, t] = await Promise.all([
    searchTransactions({
      term: sp.q ?? null,
      kinds,
      stage: sp.stage ?? null,
      from: sp.from ?? null,
      to: sp.to ?? null,
      page: Number(sp.page) || 1
    }),
    getTranslations('Search')
  ]);

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">{t('title')}</h1>
        <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
      </div>

      <SearchPanel
        results={results}
        query={{
          term: sp.q ?? '',
          kinds,
          stage: sp.stage ?? '',
          from: sp.from ?? '',
          to: sp.to ?? ''
        }}
      />
    </div>
  );
}
