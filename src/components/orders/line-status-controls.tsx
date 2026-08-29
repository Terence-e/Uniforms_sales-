'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { ArrowRight, Undo2, Ban } from 'lucide-react';
import { useRouter } from '@/i18n/navigation';
import {
  advanceOrderLine,
  cancelOrderLine,
  revertOrderLine
} from '@/actions/orders';
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
import { canCancel, isTerminal, nextStatus, previousStatus } from '@/lib/order-status';
import { PAYMENT_METHODS, type PaymentMethodValue } from '@/lib/validation/sale-schema';
import type { OrderStatus } from '@/types/database.types';

/**
 * Per-line workflow controls (A-FR-9.4, A-FR-9.6, A-FR-9.24).
 *
 * Forward is one tap and asks nothing. Backwards and cancel both open a dialog,
 * because both demand a written reason -- the database rejects them without one,
 * so a dialog is the honest UI rather than a courtesy.
 *
 * Which buttons exist comes from the shared sequence helpers, the same rules the
 * trigger enforces. A line handed over at the counter (status null) has no
 * workflow and gets no controls at all.
 */

type Props = {
  lineId: string;
  status: OrderStatus | null;
};

export function LineStatusControls({ lineId, status }: Props) {
  const t = useTranslations('Orders');
  const tSales = useTranslations('Sales');
  const tv = useTranslations('Validation');
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [revertOpen, setRevertOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [refundMethod, setRefundMethod] = useState<PaymentMethodValue>('cash');
  const [reasonError, setReasonError] = useState<string | null>(null);

  // A line the parent already took home was never in the workflow.
  if (status === null) {
    return (
      <Badge variant="outline" className="text-[0.7rem]">
        {t('handedOverBadge')}
      </Badge>
    );
  }

  // Collection is NOT a one-tap move. Reaching 'collected' means goods left the
  // shop, which needs a COL slip, a named collector and a stock deduction
  // (A-FR-9.7) -- so the last step is driven by the collection panel, not by a
  // button here. Everything before it stays one tap.
  const step = nextStatus(status);
  const forward = step === 'collected' ? null : step;
  const back = previousStatus(status);

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
      setReason('');
      setReasonError(null);
      router.refresh();
    });
  }

  /** Mirrors the schema's min(3): "x" is not a reason worth auditing. */
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

      {isTerminal(status) ? null : (
        <>
          {forward ? (
            <Button
              size="sm"
              variant="outline"
              disabled={isPending}
              onClick={() => run(() => advanceOrderLine({ lineId }))}
            >
              <ArrowRight className="size-3.5" />
              {/* Named as an action, not a state: "En production" beside a
                  "Commandée" badge reads as a second label rather than a
                  button. */}
              {t('advanceTo', { status: t(`status.${forward}`) })}
            </Button>
          ) : null}

          {step === 'collected' ? (
            <span className="text-xs text-muted-foreground">{t('collectViaPanel')}</span>
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
              {t('cancelLine')}
            </Button>
          ) : null}
        </>
      )}

      {/* ------------------------------------------------ step back */}
      <Dialog open={revertOpen} onOpenChange={setRevertOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('stepBackTitle')}</DialogTitle>
            <DialogDescription>
              {back ? t('stepBackTo', { status: t(`status.${back}`) }) : null}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label htmlFor={`revert-reason-${lineId}`}>{t('reason')}</Label>
            <Textarea
              id={`revert-reason-${lineId}`}
              rows={3}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              aria-invalid={Boolean(reasonError)}
            />
            {reasonError ? (
              <p className="text-sm text-destructive">{reasonError}</p>
            ) : null}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setRevertOpen(false)}>
              {t('cancelDialog')}
            </Button>
            <Button
              disabled={isPending}
              onClick={() => {
                if (!reasonIsValid()) return;
                run(() => revertOrderLine({ lineId, reason }));
              }}
            >
              {t('confirmStepBack')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ------------------------------------------------ cancel + refund */}
      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('cancelTitle')}</DialogTitle>
            <DialogDescription>{t('cancelHint')}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t('refundMethod')}</Label>
              <Select
                value={refundMethod}
                onValueChange={(value) => setRefundMethod(value as PaymentMethodValue)}
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

            <div className="space-y-2">
              <Label htmlFor={`cancel-reason-${lineId}`}>{t('reason')}</Label>
              <Textarea
                id={`cancel-reason-${lineId}`}
                rows={3}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                aria-invalid={Boolean(reasonError)}
              />
              {reasonError ? (
                <p className="text-sm text-destructive">{reasonError}</p>
              ) : null}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelOpen(false)}>
              {t('cancelDialog')}
            </Button>
            <Button
              variant="destructive"
              disabled={isPending}
              onClick={() => {
                if (!reasonIsValid()) return;
                run(() => cancelOrderLine({ lineId, reason, refundMethod }));
              }}
            >
              {t('confirmCancel')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
