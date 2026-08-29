import { getTranslations, setRequestLocale } from 'next-intl/server';
import { createClient } from '@/lib/supabase/server';
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

type Props = { params: Promise<{ locale: string }> };

const KNOWN_ACTIONS = ['login_failed', 'login_blocked', 'login_success'];

export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'Audit' });
  return { title: t('title') };
}

export default async function AuditPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const [t, supabase] = await Promise.all([getTranslations('Audit'), createClient()]);

  // Readable by every role (A-FR-11.4) via the audit_select_all policy.
  const { data } = await supabase
    .from('audit_log')
    .select('id, action, ip, meta, created_at')
    .order('created_at', { ascending: false })
    .limit(100);

  const rows = data ?? [];

  const actionLabel = (action: string) =>
    KNOWN_ACTIONS.includes(action) ? t(`actions.${action}`) : action;
  const actionVariant = (action: string) =>
    action === 'login_failed' || action === 'login_blocked' ? 'destructive' : 'secondary';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t('title')}</h1>
        <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {t('recent')} ({rows.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('time')}</TableHead>
                  <TableHead>{t('action')}</TableHead>
                  <TableHead>{t('actor')}</TableHead>
                  <TableHead>{t('ip')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                      {t('empty')}
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((r) => {
                    const meta = (r.meta as { email?: string }) ?? {};
                    return (
                      <TableRow key={r.id}>
                        <TableCell className="whitespace-nowrap text-muted-foreground">
                          {formatDateTime(r.created_at, locale)}
                        </TableCell>
                        <TableCell>
                          <Badge variant={actionVariant(r.action)}>{actionLabel(r.action)}</Badge>
                        </TableCell>
                        <TableCell className="font-medium">{meta.email ?? '—'}</TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">
                          {r.ip ?? '—'}
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
