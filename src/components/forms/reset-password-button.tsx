'use client';

import { useState } from 'react';
import { KeyRoundIcon, CopyIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { resetUserPassword } from '@/actions/accounts';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import { Spinner } from '@/components/ui/spinner';

/** Super-Admin action: set a fresh temporary password for a user (or oneself). */
export function ResetPasswordButton({ userId, name }: { userId: string; name: string }) {
  const t = useTranslations('Accounts');
  const [pending, setPending] = useState(false);
  const [password, setPassword] = useState<string | null>(null);

  async function onReset() {
    setPending(true);
    const res = await resetUserPassword(userId);
    setPending(false);
    if (res.ok) {
      setPassword(res.password);
    } else {
      toast.error(
        ['forbidden', 'unauthorized'].includes(res.error) ? t(res.error) : t('resetFailed')
      );
    }
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="gap-1.5"
        onClick={onReset}
        disabled={pending}
      >
        {pending ? <Spinner className="size-4" /> : <KeyRoundIcon className="size-4" />}
        {t('resetPassword')}
      </Button>

      <Dialog open={Boolean(password)} onOpenChange={(o) => !o && setPassword(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('resetDoneTitle')}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">{t('resetDoneBody', { name })}</p>
          {password && (
            <div className="flex items-center justify-between gap-3 rounded-lg border bg-muted/40 px-3 py-2">
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">{t('tempPassword')}</p>
                <p className="truncate font-mono text-sm">{password}</p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                aria-label={t('copy')}
                onClick={() => {
                  navigator.clipboard?.writeText(password);
                  toast.success(t('copied'));
                }}
              >
                <CopyIcon className="size-4" />
              </Button>
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setPassword(null)}>{t('done')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
