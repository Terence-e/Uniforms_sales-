'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArchiveIcon, ArchiveRestoreIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { setProductActive } from '@/actions/catalogue';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@/components/ui/dialog';
import { Spinner } from '@/components/ui/spinner';

export function ArchiveToggle({
  id,
  active,
  name
}: {
  id: string;
  active: boolean;
  name: string;
}) {
  const t = useTranslations('Catalogue');
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);

  async function run(next: boolean) {
    setPending(true);
    const res = await setProductActive(id, next);
    setPending(false);
    if (res.ok) {
      toast.success(next ? t('restoredToast') : t('archivedToast'));
      setOpen(false);
      router.refresh();
    } else {
      toast.error(res.error === 'forbidden' ? t('forbidden') : t('error'));
    }
  }

  // Restoring is low-risk -> immediate. Archiving asks for confirmation.
  if (!active) {
    return (
      <Button variant="ghost" size="sm" className="gap-1.5" disabled={pending} onClick={() => run(true)}>
        {pending ? <Spinner className="size-4" /> : <ArchiveRestoreIcon className="size-4" />}
        {t('restore')}
      </Button>
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground">
          <ArchiveIcon className="size-4" />
          {t('archive')}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('archiveConfirmTitle')}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">{t('archiveConfirmBody', { name })}</p>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
            {t('cancel')}
          </Button>
          <Button onClick={() => run(false)} disabled={pending} className="gap-2">
            {pending && <Spinner className="size-4 border-primary-foreground/40 border-t-primary-foreground" />}
            {t('archive')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
