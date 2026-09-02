'use client';

import { useTranslations } from 'next-intl';
import { usePathname, useRouter } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DOCUMENT_KINDS, DOCUMENT_PREFIX, type DocumentKind } from '@/lib/documents';

/**
 * Type and date filters for the document ledger.
 *
 * State lives in the URL, not in component state. Three reasons, all of them
 * things a shop actually does: a filtered view can be bookmarked, it survives a
 * reload, and the back button steps through filters the way people expect. It
 * also keeps the page a server component -- the rows are fetched on the server
 * from the same query string.
 */
export function DocumentFilters({
  selected,
  from,
  to
}: {
  selected: DocumentKind[];
  from: string;
  to: string;
}) {
  const t = useTranslations('Documents');
  const router = useRouter();
  const pathname = usePathname();

  function apply(next: { kinds?: DocumentKind[]; from?: string; to?: string }) {
    const params = new URLSearchParams();
    const kinds = next.kinds ?? selected;
    const nextFrom = next.from ?? from;
    const nextTo = next.to ?? to;

    // All five selected is the same view as none selected, so it is written as
    // no parameter at all -- a URL that says nothing about type reads as "every
    // type", which is what an untouched filter means.
    if (kinds.length > 0 && kinds.length < DOCUMENT_KINDS.length) {
      params.set('kinds', kinds.join(','));
    }
    if (nextFrom) params.set('from', nextFrom);
    if (nextTo) params.set('to', nextTo);

    // Any filter change returns to page one. Staying on page 4 of a narrower
    // result set usually lands on an empty page, which reads as "nothing found"
    // when the truth is "nothing found *here*".
    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  }

  function toggle(kind: DocumentKind) {
    const next = selected.includes(kind)
      ? selected.filter((k) => k !== kind)
      : [...selected, kind];
    apply({ kinds: next });
  }

  const filtered = selected.length > 0 && selected.length < DOCUMENT_KINDS.length;
  const dirty = filtered || Boolean(from) || Boolean(to);

  return (
    <div className="space-y-4 rounded-lg border p-4">
      <div className="space-y-2">
        <Label className="text-xs uppercase text-muted-foreground">{t('type')}</Label>
        <div className="flex flex-wrap gap-2">
          {DOCUMENT_KINDS.map((kind) => {
            const on = selected.length === 0 || selected.includes(kind);
            return (
              <button
                key={kind}
                type="button"
                onClick={() => toggle(kind)}
                aria-pressed={on}
                className={
                  on
                    ? 'rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground'
                    : 'rounded-full border px-3 py-1 text-xs font-medium hover:bg-muted'
                }
              >
                {/* The prefix beside the name, because the prefix is what is
                    printed on the paper a parent brings back. */}
                <span className="font-mono">{DOCUMENT_PREFIX[kind]}</span>{' '}
                {t(`kinds.${kind}`)}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="from" className="text-xs">
            {t('from')}
          </Label>
          <Input
            id="from"
            type="date"
            value={from}
            onChange={(event) => apply({ from: event.target.value })}
            className="w-40"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="to" className="text-xs">
            {t('to')}
          </Label>
          <Input
            id="to"
            type="date"
            value={to}
            onChange={(event) => apply({ to: event.target.value })}
            className="w-40"
          />
        </div>
        {dirty ? (
          <Button variant="ghost" size="sm" onClick={() => router.push(pathname)}>
            {t('clear')}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
