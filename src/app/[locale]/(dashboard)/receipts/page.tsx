import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Copy, Printer } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { listDocuments } from '@/actions/documents';
import { DocumentFilters } from '@/components/documents/document-filters';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  DOCUMENTS_PAGE_SIZE,
  DOCUMENT_KINDS,
  DOCUMENT_PREFIX,
  hrefForDocument,
  reprintHref,
  type DocumentKind
} from '@/lib/documents';
import { formatDateTime, formatMoney } from '@/lib/format';

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ kinds?: string; from?: string; to?: string; page?: string }>;
};

export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'Documents' });
  return { title: t('title') };
}

/**
 * Every printed document in one list (A-FR-7.1, A-FR-7.12).
 *
 * Not a second search. A-FR-7.6 makes search the way to find one transaction
 * when a parent turns up without their paper; this answers the other question --
 * "what has been issued" -- which wants a date range and a type filter rather
 * than a search term.
 *
 * Filter state lives in the URL, so the page stays a server component and a
 * filtered view can be bookmarked, reloaded and stepped back through.
 */
export default async function ReceiptsPage({ params, searchParams }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const query = await searchParams;
  const t = await getTranslations('Documents');

  // Anything unrecognised in the URL is dropped rather than passed through --
  // a hand-edited query string should narrow the list, never break the page.
  const kinds = (query.kinds?.split(',') ?? []).filter((k): k is DocumentKind =>
    (DOCUMENT_KINDS as readonly string[]).includes(k)
  );
  const from = query.from ?? '';
  const to = query.to ?? '';
  const page = Math.max(Number(query.page) || 1, 1);

  const { rows, total } = await listDocuments({ kinds, from, to, page });
  const pages = Math.max(Math.ceil(total / DOCUMENTS_PAGE_SIZE), 1);

  const pageHref = (n: number) => {
    const params = new URLSearchParams();
    if (kinds.length > 0 && kinds.length < DOCUMENT_KINDS.length) {
      params.set('kinds', kinds.join(','));
    }
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    if (n > 1) params.set('page', String(n));
    const q = params.toString();
    return q ? `/receipts?${q}` : '/receipts';
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t('title')}</h1>
        <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
      </div>

      <DocumentFilters selected={kinds} from={from} to={to} />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {t('issued', { count: total })}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('none')}</p>
          ) : (
            rows.map((doc) => (
              <div
                key={`${doc.kind}:${doc.id}`}
                className="flex flex-wrap items-center justify-between gap-3 border-b pb-3 last:border-0 last:pb-0"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      href={hrefForDocument(doc.kind, doc.id)}
                      className="font-mono text-sm font-semibold hover:underline"
                    >
                      {doc.reference}
                    </Link>
                    <Badge variant="secondary" className="text-[0.7rem]">
                      {t(`kinds.${doc.kind}`)}
                    </Badge>
                    {/* A reprint count is worth seeing: a receipt reissued
                        repeatedly is a question, and A-FR-7.12 already records
                        every one of them. */}
                    {doc.reprint_count > 0 ? (
                      <Badge variant="outline" className="text-[0.7rem]">
                        {t('reprinted', { count: doc.reprint_count })}
                      </Badge>
                    ) : null}
                  </div>
                  <p className="truncate text-xs text-muted-foreground">
                    {formatDateTime(doc.issued_at, locale)} &middot; {doc.customer_name}
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-sm tabular-nums">
                    {/* Signed for returns: a refund is money leaving. */}
                    {doc.amount < 0
                      ? `− ${formatMoney(Math.abs(Number(doc.amount)), locale)}`
                      : formatMoney(Number(doc.amount), locale)}
                  </span>
                  <Button asChild variant="ghost" size="sm">
                    <Link href={hrefForDocument(doc.kind, doc.id)}>
                      <Printer className="size-4" />
                      <span className="sr-only">{t('open')}</span>
                    </Link>
                  </Button>
                  {/* Links to the existing reprint URL rather than doing
                      anything itself: rendering that page is what stamps
                      DUPLICATE and writes the audit row. */}
                  <Button asChild variant="outline" size="sm">
                    <Link href={reprintHref(doc.kind, doc.id)}>
                      <Copy className="size-4" />
                      {t('reprint')}
                    </Link>
                  </Button>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {pages > 1 ? (
        <div className="flex items-center justify-between">
          {/* Rendered, not disabled: `disabled` on an asChild Button becomes an
              anchor attribute the browser ignores, so the control would still
              navigate. At the first page there is nowhere to go, so there is no
              link. */}
          {page > 1 ? (
            <Button asChild variant="outline" size="sm">
              <Link href={pageHref(page - 1)}>{t('previous')}</Link>
            </Button>
          ) : (
            <span className="text-sm text-muted-foreground">{t('previous')}</span>
          )}
          <span className="text-sm text-muted-foreground">
            {t('pageOf', { page, pages })}
          </span>
          {page < pages ? (
            <Button asChild variant="outline" size="sm">
              <Link href={pageHref(page + 1)}>{t('next')}</Link>
            </Button>
          ) : (
            <span className="text-sm text-muted-foreground">{t('next')}</span>
          )}
        </div>
      ) : null}

      {/* The prefixes are printed on the paper, so the key belongs beside the
          list a parent's reference gets matched against (A-FR-7.3). */}
      <p className="text-xs text-muted-foreground">
        {DOCUMENT_KINDS.map((kind) => `${DOCUMENT_PREFIX[kind]} ${t(`kinds.${kind}`)}`).join(
          ' · '
        )}
      </p>
    </div>
  );
}
