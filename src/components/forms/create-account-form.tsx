'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { RefreshCwIcon, CopyIcon, UserPlusIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { createAccount } from '@/actions/accounts';
import { ROLES, type Role } from '@/lib/validation/auth-schema';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';

function genPassword() {
  const letters = 'abcdefghjkmnpqrstuvwxyz';
  const pick = (n: number) =>
    Array.from({ length: n }, () => letters[Math.floor(Math.random() * letters.length)]).join('');
  return `Frst-${pick(4)}${Math.floor(1000 + Math.random() * 9000)}`;
}

type FieldErrors = Partial<Record<'full_name' | 'email' | 'role' | 'password', string>>;

export function CreateAccountForm() {
  const t = useTranslations('Accounts');
  const tv = useTranslations('Validation');
  const tRoles = useTranslations('Dashboard');
  const router = useRouter();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Role>('seller');
  const [password, setPassword] = useState(genPassword);
  const [pending, setPending] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [created, setCreated] = useState<{ email: string; password: string } | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrors({});
    setPending(true);
    const res = await createAccount({ full_name: fullName, email, role, password });
    setPending(false);

    if (res.ok) {
      setCreated({ email: res.email, password });
      setFullName('');
      setEmail('');
      setRole('seller');
      setPassword(genPassword());
      router.refresh();
      return;
    }
    if (res.fieldErrors) {
      setErrors(res.fieldErrors);
      return;
    }
    const known = ['forbidden', 'unauthorized', 'createFailed'];
    if (res.error && /already|registered|exists/i.test(res.error)) {
      setErrors({ email: 'emailInUse' });
    } else {
      toast.error(known.includes(res.error ?? '') ? t(res.error as string) : t('createFailed'));
    }
  }

  function copy(text: string) {
    navigator.clipboard?.writeText(text).then(
      () => toast.success(t('copied')),
      () => toast.error(t('createFailed'))
    );
  }

  return (
    <>
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="full_name">{t('fullName')}</Label>
            <Input
              id="full_name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              maxLength={120}
              aria-invalid={Boolean(errors.full_name)}
            />
            {errors.full_name && <p className="text-sm text-destructive">{tv(errors.full_name)}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="email">{t('email')}</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              aria-invalid={Boolean(errors.email)}
            />
            {errors.email && <p className="text-sm text-destructive">{tv(errors.email)}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="role">{t('role')}</Label>
            <Select value={role} onValueChange={(v) => setRole(v as Role)}>
              <SelectTrigger id="role">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ROLES.map((r) => (
                  <SelectItem key={r} value={r}>
                    {tRoles(`roles.${r}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="password">{t('tempPassword')}</Label>
            <div className="flex gap-2">
              <Input
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                aria-invalid={Boolean(errors.password)}
                className="font-mono"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                title={t('generate')}
                onClick={() => setPassword(genPassword())}
              >
                <RefreshCwIcon className="size-4" />
              </Button>
            </div>
            {errors.password && <p className="text-sm text-destructive">{tv(errors.password)}</p>}
          </div>
        </div>

        <Button type="submit" className="gap-2" disabled={pending}>
          {pending ? (
            <Spinner className="size-4 border-primary-foreground/40 border-t-primary-foreground" />
          ) : (
            <UserPlusIcon className="size-4" />
          )}
          {pending ? t('creating') : t('createBtn')}
        </Button>
      </form>

      <Dialog open={Boolean(created)} onOpenChange={(o) => !o && setCreated(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('createdTitle')}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">{t('createdBody')}</p>
          {created && (
            <div className="space-y-2">
              {(
                [
                  { label: t('email'), value: created.email },
                  { label: t('tempPassword'), value: created.password }
                ] as const
              ).map((row) => (
                <div
                  key={row.label}
                  className="flex items-center justify-between gap-3 rounded-lg border bg-muted/40 px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">{row.label}</p>
                    <p className="truncate font-mono text-sm">{row.value}</p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={t('copy')}
                    onClick={() => copy(row.value)}
                  >
                    <CopyIcon className="size-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
          <DialogFooter>
            <Button type="button" onClick={() => setCreated(null)}>
              {t('done')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
