import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { getProfile } from '@/actions/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { CreateAccountForm } from '@/components/forms/create-account-form';
import { ResetPasswordButton } from '@/components/forms/reset-password-button';
import { AccountActions } from '@/components/forms/account-actions';
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
import type { UserRole } from '@/types/database.types';

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'Accounts' });
  return { title: t('title') };
}

export default async function AccountsPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const [profile, t, tRoles] = await Promise.all([
    getProfile(),
    getTranslations('Accounts'),
    getTranslations('Dashboard')
  ]);

  // Server-side authorisation: only the Super Admin manages accounts.
  if (!profile || profile.role !== 'super_admin') notFound();

  const admin = createAdminClient();
  const [{ data: userData }, { data: profs }] = await Promise.all([
    admin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
    admin.from('profiles').select('id, full_name, role, is_active')
  ]);

  const byId = new Map((profs ?? []).map((p) => [p.id, p]));
  const rows = (userData?.users ?? [])
    .map((u) => {
      const p = byId.get(u.id);
      if (!p) return null;
      const meta = u.user_metadata as { full_name?: string; must_change_password?: boolean };
      return {
        id: u.id,
        email: u.email ?? '',
        full_name: p.full_name || meta?.full_name || '',
        role: p.role as UserRole,
        is_active: p.is_active,
        mustChange: meta?.must_change_password === true
      };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null)
    .sort((a, b) => a.full_name.localeCompare(b.full_name));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t('title')}</h1>
        <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('createHeading')}</CardTitle>
        </CardHeader>
        <CardContent>
          <CreateAccountForm />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {t('listHeading')} ({rows.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('fullName')}</TableHead>
                  <TableHead>{t('email')}</TableHead>
                  <TableHead>{t('role')}</TableHead>
                  <TableHead>{t('status')}</TableHead>
                  <TableHead className="text-right">{t('actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.full_name || '—'}</TableCell>
                    <TableCell className="text-muted-foreground">{r.email}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{tRoles(`roles.${r.role}`)}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1.5">
                        <Badge variant={r.is_active ? 'secondary' : 'destructive'}>
                          {r.is_active ? t('active') : t('inactive')}
                        </Badge>
                        {r.mustChange && (
                          <Badge variant="outline" className="text-amber-600 dark:text-amber-500">
                            {t('mustChange')}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex flex-wrap items-center justify-end gap-1.5">
                        <ResetPasswordButton userId={r.id} name={r.full_name || r.email} />
                        <AccountActions
                          userId={r.id}
                          name={r.full_name || r.email}
                          isActive={r.is_active}
                          isSelf={r.id === profile.id}
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
