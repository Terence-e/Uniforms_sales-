'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { BanIcon } from 'lucide-react';
import { cancelSale } from '@/actions/sales';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Spinner } from '@/components/ui/spinner';

/**
 * Cancels a sale after a mandatory reason (A-FR-6.9). Rendered only for roles
 * that may operate; the RPC refuses the call regardless, so a hidden button is
 * never the only guard. Cancelling is one-way, so it asks before it acts.
 */
export function SaleCancelButton({ saleId }: { saleId: string }) {
  const t = useTranslations('Sales');
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit() {
    if (reason.trim().length < 3) {
      setError('reasonRequired');
      return;
    }
    setError(null);
    setPending(true);
    const res = await cancelSale(saleId, reason);
    setPending(false);

    if (res.ok) {
      toast.success(t('cancelSuccess'));
      setOpen(false);
      router.refresh();
      return;
    }
    toast.error(res.error === 'reasonRequired' ? t('reasonRequired') : t('cancelError'));
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) {
          setReason('');
          setError(null);
        }
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5 text-destructive">
          <BanIcon className="size-4" />
          {t('cancel')}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('cancelTitle')}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">{t('cancelHint')}</p>
          <div className="space-y-1.5">
            <Label htmlFor="cancel-reason">{t('reason')}</Label>
            <Textarea
              id="cancel-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={t('reasonPlaceholder')}
              rows={3}
              aria-invalid={Boolean(error)}
            />
            {error ? <p className="text-sm text-destructive">{t(error)}</p> : null}
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
            {t('keep')}
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={submit}
            disabled={pending}
            className="gap-2"
          >
            {pending ? <Spinner className="size-4 border-white/40 border-t-white" /> : null}
            {pending ? t('cancelling') : t('confirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
