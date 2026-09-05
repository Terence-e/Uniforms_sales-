'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { ArrowRight, Undo2, Ban, Banknote } from 'lucide-react';
import { useRouter } from '@/i18n/navigation';
import {
  advanceAlteration,
  cancelAlteration,
  payAlteration,
  revertAlteration
} from '@/actions/alterations';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { canCancel, isTerminal, nextStatus, previousStatus } from '@/lib/alteration-status';
import { PAYMENT_METHODS, type PaymentMethodValue } from '@/lib/validation/sale-schema';
import type { AlterationStatus } from '@/types/database.types';

/**
 * Alteration workflow controls (A-FR-9.13).
 *
 * Deliberately the same interaction as the order controls: forward is one tap,
 * backwards and cancel open a dialog because both demand a written reason that
 * the database will reject them without.
 *
 * Payment sits alongside the workflow rather than inside it. The shop takes the
 * money at intake sometimes and on return other times, so "record payment" is
 * available at any point while something is owed -- including after the garment
 * has gone back, which is a real thing that happens.
 */

type Props = {
  alterationId: string;
  status: AlterationStatus;
  charge: number;
  paidAt: string | null;
  /**
   * Administration has no write path anywhere (A-FR-2.2); can_operate() would
   * refuse every one of these actions server-side regardless. The status and
   * unpaid badges still render -- only the buttons and their dialogs are
   * withheld.
   */
  canOperate: boolean;
};

export function AlterationStatusControls({
  alterationId,
  status,
  charge,
  paidAt,
  canOperate
}: Props) {
  const t = useTranslations('Alterations');
  const tSales = useTranslations('Sales');
  const tv = useTranslations('Validation');
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [revertOpen, setRevertOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [reasonError, setReasonError] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodValue>('cash');

  const forward = nextStatus(status);
  const back = previousStatus(status);
  const owes = charge > 0 && !paidAt;

  function run(action: () => Promise<{ ok: boolean; error?: string }>) {
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        toast.error(result.error === 'validation' ? tv('reasonRequired') : result.error);
        return;
      }
      toast.success(t('statusUpdated'));
      setRevertOpen(false);
      setCancelOpen(false);
      setPayOpen(false);
      setReason('');
      setReasonError(null);
      router.refresh();
    });
  }

  function reasonIsValid() {
    if (reason.trim().length < 3) {
      setReasonError(tv('reasonRequired'));
      return false;
    }
    setReasonError(null);
    return true;
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Badge
        variant={status === 'cancelled' ? 'destructive' : 'secondary'}
        className="text-[0.7rem]"
      >
        {t(`status.${status}`)}
      </Badge>

      {owes ? (
        <Badge variant="outline" className="border-amber-500 text-[0.7rem] text-amber-600">
          {t('unpaid')}
        </Badge>
      ) : null}

      {!canOperate || isTerminal(status) ? null : (
        <>
          {forward ? (
            <Button
              size="sm"
              variant="outline"
              disabled={isPending}
              onClick={() => run(() => advanceAlteration({ alterationId }))}
            >
              <ArrowRight className="size-3.5" />
              {t('advanceTo', { status: t(`status.${forward}`) })}
            </Button>
          ) : null}

          {back ? (
            <Button
              size="sm"
              variant="ghost"
              disabled={isPending}
              onClick={() => setRevertOpen(true)}
            >
              <Undo2 className="size-3.5" />
              {t('stepBack')}
            </Button>
          ) : null}

          {canCancel(status) ? (
            <Button
              size="sm"
              variant="ghost"
              className="text-destructive"
              disabled={isPending}
              onClick={() => setCancelOpen(true)}
            >
              <Ban className="size-3.5" />
              {t('cancelAlteration')}
            </Button>
          ) : null}
        </>
      )}

      {/* Offered whenever money is owed, terminal status included: a parent who
          collected on Friday and paid on Monday is not an error. */}
      {canOperate && owes ? (
        <Button size="sm" variant="outline" disabled={isPending} onClick={() => setPayOpen(true)}>
          <Banknote className="size-3.5" />
          {t('recordPayment')}
        </Button>
      ) : null}

      {/* All three dialogs are only ever opened from buttons hidden above when
          read-only, so their state can never flip true -- skipping the mount
          leaves no interactive control in the DOM at all. */}
      {canOperate ? (
        <>
          {/* -------------------------------------------------- step back */}
          <Dialog open={revertOpen} onOpenChange={setRevertOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t('stepBackTitle')}</DialogTitle>
              <DialogDescription>
                {back ? t('stepBackTo', { status: t(`status.${back}`) }) : null}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              <Label htmlFor={`alt-revert-${alterationId}`}>{t('reason')}</Label>
              <Textarea
                id={`alt-revert-${alterationId}`}
                rows={3}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                aria-invalid={Boolean(reasonError)}
              />
              {reasonError ? <p className="text-sm text-destructive">{reasonError}</p> : null}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setRevertOpen(false)}>
                {t('close')}
              </Button>
              <Button
                disabled={isPending}
                onClick={() => {
                  if (!reasonIsValid()) return;
                  run(() => revertAlteration({ alterationId, reason }));
                }}
              >
                {t('confirmStepBack')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* -------------------------------------------------- cancel */}
        <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t('cancelTitle')}</DialogTitle>
              <DialogDescription>{t('cancelHint')}</DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              <Label htmlFor={`alt-cancel-${alterationId}`}>{t('reason')}</Label>
              <Textarea
                id={`alt-cancel-${alterationId}`}
                rows={3}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                aria-invalid={Boolean(reasonError)}
              />
              {reasonError ? <p className="text-sm text-destructive">{reasonError}</p> : null}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCancelOpen(false)}>
                {t('close')}
              </Button>
              <Button
                variant="destructive"
                disabled={isPending}
                onClick={() => {
                  if (!reasonIsValid()) return;
                  run(() => cancelAlteration({ alterationId, reason }));
                }}
              >
                {t('confirmCancel')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* -------------------------------------------------- payment */}
        <Dialog open={payOpen} onOpenChange={setPayOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t('recordPaymentTitle')}</DialogTitle>
              <DialogDescription>{t('recordPaymentHint')}</DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              <Label>{tSales('paymentMethod')}</Label>
              <Select
                value={paymentMethod}
                onValueChange={(value) => setPaymentMethod(value as PaymentMethodValue)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHODS.map((method) => (
                    <SelectItem key={method} value={method}>
                      {tSales(`payment.${method}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setPayOpen(false)}>
                {t('close')}
              </Button>
              <Button
                disabled={isPending}
                onClick={() => run(() => payAlteration({ alterationId, paymentMethod }))}
              >
                {t('confirmPayment')}
              </Button>
            </DialogFooter>
          </DialogContent>
            </Dialog>
        </>
      ) : null}
    </div>
  );
}
