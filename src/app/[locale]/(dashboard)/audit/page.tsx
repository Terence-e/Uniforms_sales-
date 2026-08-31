import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { AUDIT_ACTIONS, listAuditActors, listAuditLog, type AuditEntry } from '@/lib/audit';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import { formatDateTime } from '@/lib/format';
import type { Json } from '@/types/database.types';

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ from?: string; to?: string; user?: string; action?: string }>;
};

export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'Audit' });
  return { title: t('title') };
}

const DESTRUCTIVE = new Set(['login_failed', 'login_blocked', 'product_archived']);

/** Compact one-line rendering of a jsonb value for the table. */
function summarize(value: Json | null): string {
  if (value == null) return '';
  if (typeof value !== 'object' || Array.isArray(value)) return String(value);
  return Object.entries(value)
    .filter(([, v]) => v !== null && v !== undefined && v !== '')
    .map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`)
    .join(' · ');
}

export default async function AuditPage({ params, searchParams }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const sp = await searchParams;

  const filters = {
    from: sp.from || undefined,
    to: sp.to || undefined,
    actorId: sp.user || undefined,
    action: sp.action || undefined
  };

  // Readable by every role (A-FR-11.4) via the audit_select_all policy; the
  // "user" options come from the log itself, so this works even for roles that
  // cannot list profiles.
  const [t, rows, actors] = await Promise.all([
    getTranslations('Audit'),
    listAuditLog(filters),
    listAuditActors()
  ]);

  const actionLabel = (action: string) =>
    (AUDIT_ACTIONS as readonly string[]).includes(action) ? t(`actions.${action}`) : action;

  const actorOf = (r: AuditEntry) => {
    if (r.actor_name) return r.actor_name;
    const meta = (r.meta as { email?: string }) ?? {};
    return meta.email ?? '—';
  };

  const targetOf = (r: AuditEntry) => {
    if (!r.target_table) return '—';
    const shortId = r.target_id ? `${r.target_id.slice(0, 8)}…` : '';
    return `${r.target_table}${shortId ? ` · ${shortId}` : ''}`;
  };

  const inputCls =
    'h-9 rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:ring-2 focus-visible:ring-ring';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t('title')}</h1>
        <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
      </div>

      {/* Filters (A-FR-11.4). Plain GET form -- no client JS, works for every role. */}
      <Card>
        <CardContent className="p-4">
          <form method="get" className="flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-1">
              <label htmlFor="from" className="text-xs font-medium text-muted-foreground">
                {t('from')}
              </label>
              <input id="from" name="from" type="date" defaultValue={sp.from ?? ''} className={inputCls} />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="to" className="text-xs font-medium text-muted-foreground">
                {t('to')}
              </label>
              <input id="to" name="to" type="date" defaultValue={sp.to ?? ''} className={inputCls} />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="user" className="text-xs font-medium text-muted-foreground">
                {t('user')}
              </label>
              <select id="user" name="user" defaultValue={sp.user ?? ''} className={inputCls}>
                <option value="">{t('allUsers')}</option>
                {actors.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="action" className="text-xs font-medium text-muted-foreground">
                {t('action')}
              </label>
              <select id="action" name="action" defaultValue={sp.action ?? ''} className={inputCls}>
                <option value="">{t('allActions')}</option>
                {AUDIT_ACTIONS.map((a) => (
                  <option key={a} value={a}>
                    {t(`actions.${a}`)}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="submit"
              className="h-9 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90"
            >
              {t('apply')}
            </button>
            <Link
              href="/audit"
              className="h-9 rounded-md px-3 text-sm font-medium leading-9 text-muted-foreground hover:text-foreground"
            >
              {t('clear')}
            </Link>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('showing', { n: rows.length })}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('time')}</TableHead>
                  <TableHead>{t('action')}</TableHead>
                  <TableHead>{t('actor')}</TableHead>
                  <TableHead>{t('target')}</TableHead>
                  <TableHead>{t('change')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                      {filters.from || filters.to || filters.actorId || filters.action
                        ? t('noMatch')
                        : t('empty')}
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((r) => {
                    const prev = summarize(r.previous_value);
                    const next = summarize(r.new_value);
                    return (
                      <TableRow key={r.id}>
                        <TableCell className="whitespace-nowrap text-muted-foreground">
                          {formatDateTime(r.created_at, locale)}
                        </TableCell>
                        <TableCell>
                          <Badge variant={DESTRUCTIVE.has(r.action) ? 'destructive' : 'secondary'}>
                            {actionLabel(r.action)}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-medium">{actorOf(r)}</TableCell>
                        <TableCell className="whitespace-nowrap font-mono text-xs text-muted-foreground">
                          {targetOf(r)}
                        </TableCell>
                        <TableCell className="max-w-md text-xs text-muted-foreground">
                          {prev && (
                            <span className="line-through opacity-70">{t('previous')}: {prev}</span>
                          )}
                          {prev && next ? <br /> : null}
                          {next && (
                            <span>
                              {prev ? `${t('next')}: ` : ''}
                              {next}
                            </span>
                          )}
                          {!prev && !next ? '—' : null}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
