'use client';

import { useMemo, useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { TriangleAlert } from 'lucide-react';
import { useRouter } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { recordReturn } from '@/actions/returns';
import type { Verdict } from '@/actions/return-policy';
import { formatMoney } from '@/lib/format';
import { withSaveDeadline } from '@/lib/save-outcome';
import { PAYMENT_METHODS } from '@/lib/validation/sale-schema';
import {
  GARMENT_CONDITIONS,
  RETURN_KINDS,
  type GarmentCondition,
  type ReturnKind
} from '@/lib/validation/return-schema';

type SaleLine = {
  id: string;
  description: string;
  size: string | null;
  unit_price: number;
  quantity: number;
  /** Already given back on an earlier return. */
  returned: number;
  /** What is still returnable. Zero means this line is spent. */
  returnable: number;
};

type Product = {
  id: string;
  name_en: string;
  name_fr: string | null;
  size: string | null;
  unit_price: number;
  available: number;
};

type OutgoingLine = { productId: string; quantity: number };

/**
 * Recording a return or exchange against a sale (A-FR-8.1 to A-FR-8.6).
 *
 * The money is shown but never sent. Everything below the line count is a
 * preview: the server re-prices what comes back from the original sale line and
 * what goes out from the catalogue, and derives the difference itself. A form
 * that could name its own refund amount could refund more than the garment ever
 * cost, so this one is not allowed to try.
 *
 * That is also why the payment-method fields appear on a prediction. The seller
 * has to be asked something before the server answers, and asking "how are you
 * refunding this?" when the numbers say a refund is due is the least surprising
 * way to do it. If the prediction is wrong the server rejects and says so.
 */
export function ReturnForm({
  saleId,
  receiptNo,
  lines,
  products,
  staff,
  currentUserId,
  verdicts
}: {
  saleId: string;
  receiptNo: string;
  lines: SaleLine[];
  products: Product[];
  staff: { id: string; full_name: string }[];
  currentUserId: string;
  /**
   * All four combinations, keyed `${kind}:${condition}`, resolved on the server
   * before this page rendered (A-FR-8.10).
   *
   * Fetched up front rather than per toggle so the banner answers the instant
   * the seller changes the type or the condition. A verdict that arrives after
   * they have moved on is not one shown "before anything is entered".
   */
  verdicts: Record<string, Verdict>;
}) {
  const t = useTranslations('Returns');
  const tSales = useTranslations('Sales');
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [kind, setKind] = useState<ReturnKind>('exchange');
  const [condition, setCondition] = useState<GarmentCondition>('unworn');
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [receivedBy, setReceivedBy] = useState(currentUserId);
  const [refundMethod, setRefundMethod] = useState<string>('cash');
  const [collectedMethod, setCollectedMethod] = useState<string>('cash');
  const [error, setError] = useState<string | null>(null);
  const [overrideReason, setOverrideReason] = useState('');

  /** saleItemId -> quantity coming back. Absent or zero means not selected. */
  const [returning, setReturning] = useState<Record<string, number>>({});
  const [outgoing, setOutgoing] = useState<OutgoingLine[]>([]);

  // The verdict for what the seller currently has selected. Recomputed on every
  // render from data already in the browser, so it never lags the control.
  const verdict = verdicts[`${kind}:${condition}`] ?? null;
  const outOfPolicy = verdict ? !verdict.withinPolicy : false;

  const returnable = lines.filter((line) => line.returnable > 0);

  const valueIn = useMemo(
    () =>
      lines.reduce(
        (sum, line) => sum + (returning[line.id] ?? 0) * Number(line.unit_price),
        0
      ),
    [lines, returning]
  );

  const valueOut = useMemo(
    () =>
      outgoing.reduce((sum, line) => {
        const product = products.find((p) => p.id === line.productId);
        return sum + (product ? Number(product.unit_price) * line.quantity : 0);
      }, 0),
    [outgoing, products]
  );

  // A-FR-8.1: same price moves no money, dearer collects, cheaper refunds.
  const difference = kind === 'exchange' ? valueOut - valueIn : -valueIn;
  const refundDue = difference < 0 ? -difference : 0;
  const collectDue = difference > 0 ? difference : 0;

  const linesChosen = Object.values(returning).filter((quantity) => quantity > 0).length;
  const canSubmit =
    linesChosen > 0
    && reason.trim().length >= 3
    && (kind === 'return' || outgoing.some((line) => line.productId && line.quantity > 0))
    // Out of policy warns and demands an explanation -- it never blocks
    // (A-FR-8.11). What is blocked is submitting the override SILENTLY.
    && (!outOfPolicy || overrideReason.trim().length >= 3);

  function setQuantity(line: SaleLine, raw: number) {
    // Clamped to what is still returnable. The database enforces the same limit
    // independently -- this is the version that stops the seller before they
    // have typed a whole transaction that cannot be saved.
    const quantity = Math.max(0, Math.min(raw, line.returnable));
    setReturning((current) => ({ ...current, [line.id]: quantity }));
  }

  function submit() {
    setError(null);

    startTransition(async () => {
      const attempt = await withSaveDeadline(() =>
        recordReturn({
          saleId,
          kind,
          reason,
          condition,
          returnedItems: Object.entries(returning)
            .filter(([, quantity]) => quantity > 0)
            .map(([saleItemId, quantity]) => ({ saleItemId, quantity })),
          outgoingItems:
            kind === 'exchange'
              ? outgoing
                  .filter((line) => line.productId && line.quantity > 0)
                  .map((line) => ({ productId: line.productId, quantity: line.quantity }))
              : [],
          // Sent regardless of the prediction: the server decides which one it
          // actually needs, and sending both costs nothing.
          refundMethod: refundMethod as never,
          collectedMethod: collectedMethod as never,
          receivedBy,
          notes: notes.trim() || null,
          overrideReason: outOfPolicy ? overrideReason.trim() : null
        })
      );

      if (!attempt.ok) {
        if (attempt.reason === 'threw') console.error('return save failed', attempt.error);
        setError(t('errorUnknown'));
        return;
      }

      const result = attempt.value;
      if (!result.ok) {
        console.error('return rejected', result.error);
        setError(
          result.error === 'validation'
            ? t('errorValidation')
            : result.error === 'unauthorized'
              ? t('errorUnauthorized')
              : // Postgres raises these with messages written for the seller --
                // "Only 1 of that item remain returnable" -- so they are shown
                // as-is rather than flattened into a generic sentence.
                result.error
        );
        return;
      }

      toast.success(t('success', { returnNo: result.returnNo }));
      router.push(`/returns/${result.returnId}/receipt`);
    });
  }

  return (
    <div className="space-y-6">
      {error ? (
        <div
          role="alert"
          className="space-y-1 rounded-lg border-2 border-destructive bg-destructive/5 p-4"
        >
          <p className="flex items-center gap-2 font-semibold">
            <TriangleAlert className="size-4 shrink-0" />
            {t('errorTitle')}
          </p>
          <p className="text-sm">{error}</p>
        </div>
      ) : null}

      {/* A-FR-8.10: the verdict comes BEFORE the form, not after submitting it.
          "Sold 47 days ago. Unworn: exchange allowed, refund outside window."
          The seller sees where they stand before starting, not after. */}
      {verdict ? (
        <div
          role="status"
          className={
            outOfPolicy
              ? 'space-y-2 rounded-lg border-2 border-amber-500 bg-amber-50 p-4 dark:bg-amber-950/30'
              : 'space-y-1 rounded-lg border bg-muted/40 p-4'
          }
        >
          <p className="flex items-center gap-2 font-semibold">
            {outOfPolicy ? <TriangleAlert className="size-4 shrink-0" /> : null}
            {t('soldDaysAgo', { days: verdict.elapsedDays })}
          </p>
          <p className="text-sm">
            {outOfPolicy
              ? verdict.windowDays === null
                ? t('verdictNotPermitted', {
                    kind: t(`kindsShort.${kind}`),
                    condition: t(`conditions.${condition}`)
                  })
                : t('verdictOutside', {
                    kind: t(`kindsShort.${kind}`),
                    condition: t(`conditions.${condition}`),
                    window: verdict.windowDays
                  })
              : t('verdictAllowed', {
                  kind: t(`kindsShort.${kind}`),
                  condition: t(`conditions.${condition}`),
                  window: verdict.windowDays ?? 0
                })}
          </p>
          {/* Never "you cannot". The policy is enforced by visibility, not by
              refusal -- blocking would push the transaction onto paper, which
              costs the school more than the override does (A-FR-8.11). */}
          {outOfPolicy ? (
            <p className="text-sm font-medium">{t('overrideAllowed')}</p>
          ) : null}
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('whatKind')}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>{t('kind')}</Label>
            <Select value={kind} onValueChange={(value) => setKind(value as ReturnKind)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {RETURN_KINDS.map((value) => (
                  <SelectItem key={value} value={value}>
                    {t(`kinds.${value}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">{t(`kindHint.${kind}`)}</p>
          </div>

          <div className="space-y-1.5">
            {/* Declared, not assessed (A-FR-8.9). It is not the software's job
                to judge the state of a garment. */}
            <Label>{t('condition')}</Label>
            <Select
              value={condition}
              onValueChange={(value) => setCondition(value as GarmentCondition)}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {GARMENT_CONDITIONS.map((value) => (
                  <SelectItem key={value} value={value}>
                    {t(`conditions.${value}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">{t('conditionHint')}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('comingBack')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {returnable.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('nothingReturnable')}</p>
          ) : (
            returnable.map((line) => (
              <div
                key={line.id}
                className="flex flex-wrap items-center gap-3 border-b pb-3 last:border-0 last:pb-0"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {line.description}
                    {line.size ? (
                      <span className="text-muted-foreground"> ({line.size})</span>
                    ) : null}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatMoney(Number(line.unit_price))} &middot;{' '}
                    {t('returnableOf', {
                      returnable: line.returnable,
                      sold: line.quantity
                    })}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Label htmlFor={`qty-${line.id}`} className="text-xs">
                    {t('quantityBack')}
                  </Label>
                  <Input
                    id={`qty-${line.id}`}
                    type="number"
                    min={0}
                    max={line.returnable}
                    value={returning[line.id] ?? 0}
                    onChange={(event) =>
                      setQuantity(line, Number(event.target.value) || 0)
                    }
                    className="w-20"
                  />
                </div>
              </div>
            ))
          )}
          {/* Lines already fully returned are listed but not offered, so the
              seller can see the sale is complete rather than wonder where the
              missing shirt went. */}
          {lines.filter((line) => line.returnable === 0).length > 0 ? (
            <p className="text-xs text-muted-foreground">
              {t('alreadyReturnedNote', {
                count: lines.filter((line) => line.returnable === 0).length
              })}
            </p>
          ) : null}
        </CardContent>
      </Card>

      {kind === 'exchange' ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('goingOut')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {outgoing.map((line, index) => (
              <div key={index} className="flex flex-wrap items-end gap-3">
                <div className="min-w-0 flex-1 space-y-1.5">
                  <Label>{t('product')}</Label>
                  <Select
                    value={line.productId}
                    onValueChange={(value) =>
                      setOutgoing((current) =>
                        current.map((item, i) =>
                          i === index ? { ...item, productId: value } : item
                        )
                      )
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder={t('choose')} />
                    </SelectTrigger>
                    <SelectContent>
                      {products.map((product) => (
                        <SelectItem key={product.id} value={product.id}>
                          {product.name_en}
                          {product.size ? ` — ${product.size}` : ''} ·{' '}
                          {formatMoney(Number(product.unit_price))}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>{t('quantity')}</Label>
                  <Input
                    type="number"
                    min={1}
                    value={line.quantity}
                    onChange={(event) =>
                      setOutgoing((current) =>
                        current.map((item, i) =>
                          i === index
                            ? { ...item, quantity: Number(event.target.value) || 1 }
                            : item
                        )
                      )
                    }
                    className="w-20"
                  />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    setOutgoing((current) => current.filter((_, i) => i !== index))
                  }
                >
                  {t('remove')}
                </Button>
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                setOutgoing((current) => [...current, { productId: '', quantity: 1 }])
              }
            >
              {t('addOutgoing')}
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('theMoney')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <dl className="space-y-1 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">{t('valueBack')}</dt>
              <dd className="tabular-nums">{formatMoney(valueIn)}</dd>
            </div>
            {kind === 'exchange' ? (
              <div className="flex justify-between">
                <dt className="text-muted-foreground">{t('valueOut')}</dt>
                <dd className="tabular-nums">{formatMoney(valueOut)}</dd>
              </div>
            ) : null}
            <div className="flex justify-between border-t pt-1 font-semibold">
              <dt>
                {refundDue > 0
                  ? t('toRefund')
                  : collectDue > 0
                    ? t('toCollect')
                    : t('nothingMoves')}
              </dt>
              <dd className="tabular-nums">
                {formatMoney(refundDue > 0 ? refundDue : collectDue)}
              </dd>
            </div>
          </dl>

          {/* A-FR-8.5: the refund method is free to differ from how the sale was
              paid. A MoMo sale may be refunded in cash. */}
          {refundDue > 0 ? (
            <div className="space-y-1.5">
              <Label>{t('refundMethod')}</Label>
              <Select value={refundMethod} onValueChange={setRefundMethod}>
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
              <p className="text-xs text-muted-foreground">{t('refundMethodHint')}</p>
            </div>
          ) : null}

          {collectDue > 0 ? (
            <div className="space-y-1.5">
              <Label>{t('collectedMethod')}</Label>
              <Select value={collectedMethod} onValueChange={setCollectedMethod}>
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
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('whyTitle')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            {/* Mandatory (A-FR-8.3). This is what the out-of-policy report gets
                read back for months later. */}
            <Label htmlFor="reason">{t('reason')}</Label>
            <Input
              id="reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder={t('reasonPlaceholder')}
              maxLength={500}
            />
            <p className="text-xs text-muted-foreground">{t('reasonHint')}</p>
          </div>

          {outOfPolicy ? (
            <div className="space-y-1.5">
              <Label htmlFor="overrideReason" className="text-amber-700 dark:text-amber-500">
                {t('overrideReason')}
              </Label>
              <Input
                id="overrideReason"
                value={overrideReason}
                onChange={(event) => setOverrideReason(event.target.value)}
                placeholder={t('overrideReasonPlaceholder')}
                maxLength={500}
              />
              {/* Separate from the ordinary reason above, and required only
                  here. Reusing that field would make an override
                  indistinguishable from an ordinary explanation, and the
                  out-of-policy report has to count exactly the overrides. */}
              <p className="text-xs text-muted-foreground">{t('overrideReasonHint')}</p>
            </div>
          ) : null}

          <div className="space-y-1.5">
            <Label>{t('receivedBy')}</Label>
            <Select value={receivedBy} onValueChange={setReceivedBy}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {staff.map((person) => (
                  <SelectItem key={person.id} value={person.id}>
                    {person.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="notes">{t('notes')}</Label>
            <Input
              id="notes"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              maxLength={500}
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {t('against', { receiptNo })}
        </p>
        <Button onClick={submit} disabled={!canSubmit || isPending} size="lg">
          {isPending ? t('saving') : t('record')}
        </Button>
      </div>
    </div>
  );
}
