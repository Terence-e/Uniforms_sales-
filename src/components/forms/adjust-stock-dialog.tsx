'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Scale, Minus, Plus } from 'lucide-react';
import { useRouter } from '@/i18n/navigation';
import { recordStockAdjustment } from '@/actions/stock';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

/**
 * Correcting one product's stock (A-FR-5.5).
 *
 * Opened from the row whose number is wrong, so there is no product picker to
 * get right -- you are looking at a count that disagrees and correcting that
 * line.
 *
 * The signed quantity is entered as a magnitude plus a direction rather than as
 * a number that might carry a minus sign. "-2" typed into a box is easy to mean
 * and easy to mistype, and the difference between +2 and -2 here is four
 * garments.
 */
export function AdjustStockDialog({
  productId,
  size,
  productLabel,
  currentQuantity
}: {
  productId: string;
  /** The (product, size) bucket being corrected -- stock is tracked per size. */
  size: string;
  productLabel: string;
  currentQuantity: number;
}) {
  const t = useTranslations('Adjustment');
  const tv = useTranslations('Validation');
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [open, setOpen] = useState(false);
  const [direction, setDirection] = useState<'add' | 'remove'>('remove');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [errors, setErrors] = useState<{ amount?: string; reason?: string }>({});

  const magnitude = Math.abs(Math.trunc(Number(amount) || 0));
  const signed = direction === 'add' ? magnitude : -magnitude;
  const resulting = currentQuantity + signed;

  function submit() {
    const next: typeof errors = {};
    if (magnitude === 0) next.amount = tv('nonZero');
    if (reason.trim().length < 3) next.reason = tv('reasonRequired');
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    startTransition(async () => {
      const result = await recordStockAdjustment({
        productId,
        size,
        quantity: signed,
        reason
      });

      if (!result.ok) {
        toast.error(result.error === 'validation' ? tv('reasonRequired') : result.error);
        return;
      }

      toast.success(t('recorded', { product: productLabel }));
      setOpen(false);
      setAmount('');
      setReason('');
      setErrors({});
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm">
          <Scale className="size-3.5" />
          {t('adjust')}
        </Button>
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
          <DialogDescription>{productLabel}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>{t('direction')}</Label>
            <div className="flex gap-2">
              <Button
                type="button"
                variant={direction === 'remove' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setDirection('remove')}
              >
                <Minus className="size-3.5" />
                {t('remove')}
              </Button>
              <Button
                type="button"
                variant={direction === 'add' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setDirection('add')}
              >
                <Plus className="size-3.5" />
                {t('add')}
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor={`adjust-amount-${productId}`}>{t('quantity')}</Label>
            <Input
              id={`adjust-amount-${productId}`}
              type="number"
              min={1}
              step={1}
              inputMode="numeric"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              aria-invalid={Boolean(errors.amount)}
            />
            {errors.amount ? (
              <p className="text-sm text-destructive">{errors.amount}</p>
            ) : null}
            {/* Shown before submitting, because a negative result is legitimate
                but should never be a surprise. */}
            {magnitude > 0 ? (
              <p
                className={
                  resulting < 0
                    ? 'text-xs font-medium text-amber-600 dark:text-amber-500'
                    : 'text-xs text-muted-foreground'
                }
              >
                {t('resulting', { from: currentQuantity, to: resulting })}
                {resulting < 0 ? ` — ${t('willGoNegative')}` : ''}
              </p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor={`adjust-reason-${productId}`}>{t('reason')}</Label>
            <Textarea
              id={`adjust-reason-${productId}`}
              rows={3}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder={t('reasonHint')}
              aria-invalid={Boolean(errors.reason)}
            />
            {errors.reason ? (
              <p className="text-sm text-destructive">{errors.reason}</p>
            ) : null}
          </div>

          {/* Said plainly: the count is not overwritten, the difference is
              recorded. That is what makes it auditable. */}
          <p className="text-xs text-muted-foreground">{t('ledgerNotice')}</p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            {t('cancel')}
          </Button>
          <Button onClick={submit} disabled={isPending}>
            {isPending ? t('recording') : t('record')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
