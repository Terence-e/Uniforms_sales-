'use client';

import { useState, useTransition } from 'react';
import { PowerIcon, PowerOffIcon, Trash2Icon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { useRouter } from '@/i18n/navigation';
import { setAccountActive, deleteAccount } from '@/actions/accounts';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import { Spinner } from '@/components/ui/spinner';

/**
 * Super-Admin account controls: (de)activate and delete (A-FR-P4).
 *
 * A row for the Super Admin's own account shows neither -- deactivating or
 * deleting yourself is a lock-out the UI should never offer, and the server
 * refuses it regardless.
 */
export function AccountActions({
  userId,
  name,
  isActive,
  isSelf
}: {
  userId: string;
  name: string;
  isActive: boolean;
  isSelf: boolean;
}) {
  const t = useTranslations('Accounts');
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [confirmOpen, setConfirmOpen] = useState(false);

  if (isSelf) return null;

  function toggleActive() {
    startTransition(async () => {
      const res = await setAccountActive(userId, !isActive);
      if (res.ok) {
        toast.success(isActive ? t('deactivatedToast', { name }) : t('activatedToast', { name }));
        router.refresh();
      } else {
        toast.error(accountError(res.error, t));
      }
    });
  }

  function confirmDelete() {
    startTransition(async () => {
      const res = await deleteAccount(userId);
      if (res.ok) {
        toast.success(t('deletedToast', { name }));
        setConfirmOpen(false);
        router.refresh();
      } else {
        toast.error(accountError(res.error, t));
      }
    });
  }

  return (
    <div className="inline-flex items-center gap-1.5">
      <Button variant="outline" size="sm" className="gap-1.5" onClick={toggleActive} disabled={isPending}>
        {isPending ? (
          <Spinner className="size-4" />
        ) : isActive ? (
          <PowerOffIcon className="size-4" />
        ) : (
          <PowerIcon className="size-4" />
        )}
        {isActive ? t('deactivate') : t('activate')}
      </Button>

      <Button
        variant="ghost"
        size="sm"
        className="gap-1.5 text-destructive hover:text-destructive"
        onClick={() => setConfirmOpen(true)}
        disabled={isPending}
      >
        <Trash2Icon className="size-4" />
        {t('delete')}
      </Button>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('deleteConfirmTitle')}</DialogTitle>
            <DialogDescription>{t('deleteConfirmBody', { name })}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)} disabled={isPending}>
              {t('cancel')}
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDelete}
              disabled={isPending}
              className="gap-1.5"
            >
              {isPending ? <Spinner className="size-4" /> : <Trash2Icon className="size-4" />}
              {t('delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function accountError(code: string, t: ReturnType<typeof useTranslations<'Accounts'>>) {
  switch (code) {
    case 'cannotSelf':
      return t('cannotSelf');
    case 'hasActivity':
      return t('hasActivity');
    case 'forbidden':
    case 'unauthorized':
      return t(code);
    default:
      return t('actionFailed');
  }
}
