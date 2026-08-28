'use client';

import { useState } from 'react';
import { KeyRoundIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { ChangePasswordForm } from '@/components/forms/change-password-form';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';

/** Change-your-own-password, inline on the profile (dashboard-gated). */
export function ChangeMyPassword() {
  const t = useTranslations('ChangePassword');
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button variant="outline" className="gap-2" onClick={() => setOpen(true)}>
        <KeyRoundIcon className="size-4" />
        {t('title')}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('title')}</DialogTitle>
          </DialogHeader>
          <ChangePasswordForm redirectOnSuccess={false} onSuccess={() => setOpen(false)} />
        </DialogContent>
      </Dialog>
    </>
  );
}
