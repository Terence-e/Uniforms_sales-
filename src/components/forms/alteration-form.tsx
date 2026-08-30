'use client';

import { useTransition } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { standardSchemaResolver } from '@hookform/resolvers/standard-schema';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Scissors } from 'lucide-react';
import { useRouter } from '@/i18n/navigation';
import { createAlteration } from '@/actions/alterations';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { PAYMENT_METHODS } from '@/lib/validation/sale-schema';
import {
  alterationSchema,
  type AlterationInput
} from '@/lib/validation/alteration-schema';

/**
 * Taking a garment in (A-FR-9.12, A-FR-9.14).
 *
 * There is no product picker here, and that is the point: the garment belongs
 * to the parent. It is one specific object, possibly bought years ago or
 * somewhere else entirely, so it is described rather than selected -- and
 * nothing on this screen can move stock.
 *
 * Payment is offered but not required. The shop takes the money at intake
 * sometimes and on return other times; leaving it unticked prints the charge on
 * the slip as due on return, and the detail page can record it later.
 */

const DEFAULTS: AlterationInput = {
  customerName: '',
  studentName: null,
  classLevel: null,
  phone: null,
  garment: '',
  size: null,
  workRequired: '',
  expectedReadyDate: null,
  charge: 0,
  paidNow: false,
  paymentMethod: null,
  notes: null
};

export function AlterationForm() {
  const t = useTranslations('Alterations');
  const tSales = useTranslations('Sales');
  const tv = useTranslations('Validation');
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const form = useForm<AlterationInput>({
    resolver: standardSchemaResolver(alterationSchema),
    defaultValues: DEFAULTS,
    mode: 'onSubmit'
  });

  const { control, register, handleSubmit, setValue, formState } = form;
  const charge = useWatch({ control, name: 'charge' });
  const paidNow = useWatch({ control, name: 'paidNow' });
  const hasCharge = (Number(charge) || 0) > 0;

  function message(key?: string) {
    if (!key) return null;
    const known = [
      'required',
      'positive',
      'nonNegative',
      'invalidDate',
      'workRequired',
      'nothingToPay'
    ];
    return known.includes(key) ? tv(key as never) : key;
  }

  const onSubmit = handleSubmit((values) => {
    startTransition(async () => {
      const result = await createAlteration(values);

      if (!result.ok) {
        if (result.error === 'validation' && result.fieldErrors) {
          for (const [path, error] of Object.entries(result.fieldErrors)) {
            form.setError(path as never, { message: error });
          }
        }
        toast.error(result.error === 'validation' ? tv('required') : result.error);
        return;
      }

      toast.success(t('success', { alterationNo: result.alterationNo }));
      form.reset(DEFAULTS);
      // Straight to the deposit slip: the parent is waiting for proof the
      // school has their garment.
      router.push(`/alterations/${result.alterationId}/slip`);
    });
  });

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('intakeTitle')}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field label={t('parentName')} error={message(formState.errors.customerName?.message)}>
            <Input
              {...register('customerName')}
              autoComplete="name"
              aria-invalid={Boolean(formState.errors.customerName)}
            />
          </Field>

          <Field label={tSales('phone')}>
            <Input {...register('phone')} type="tel" inputMode="tel" />
          </Field>

          <Field label={tSales('studentName')}>
            <Input {...register('studentName')} />
          </Field>

          <Field label={tSales('classLevel')}>
            <Input {...register('classLevel')} />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('garmentTitle')}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field label={t('garment')} error={message(formState.errors.garment?.message)}>
            <Input
              {...register('garment')}
              placeholder={t('garmentHint')}
              aria-invalid={Boolean(formState.errors.garment)}
            />
          </Field>

          <Field label={tSales('size')}>
            <Input {...register('size')} />
          </Field>

          <div className="sm:col-span-2">
            <Field
              label={t('workRequired')}
              error={message(formState.errors.workRequired?.message)}
            >
              <Textarea
                {...register('workRequired')}
                rows={3}
                placeholder={t('workRequiredHint')}
                aria-invalid={Boolean(formState.errors.workRequired)}
              />
            </Field>
          </div>

          <Field
            label={t('expectedReadyDate')}
            error={message(formState.errors.expectedReadyDate?.message)}
          >
            <Input {...register('expectedReadyDate')} type="date" />
          </Field>

          <Field label={t('notes')}>
            <Input {...register('notes')} />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('chargeTitle')}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field label={t('charge')} error={message(formState.errors.charge?.message)}>
            <Input
              {...register('charge')}
              type="number"
              min={0}
              step="0.01"
              inputMode="decimal"
            />
          </Field>

          {/* Only offered once there is something to pay -- a "paid" tick on a
              free alteration would be meaningless, and the schema rejects it. */}
          {hasCharge ? (
            <>
              <div className="flex items-end">
                <div className="flex items-center gap-2 pb-2">
                  <Checkbox
                    id="paidNow"
                    checked={Boolean(paidNow)}
                    onCheckedChange={(checked) =>
                      setValue('paidNow', checked === true, { shouldDirty: true })
                    }
                  />
                  <Label htmlFor="paidNow" className="font-normal">
                    {t('paidNow')}
                  </Label>
                </div>
              </div>

              {paidNow ? (
                <Field
                  label={tSales('paymentMethod')}
                  error={message(formState.errors.paymentMethod?.message)}
                >
                  <Select
                    onValueChange={(value) =>
                      setValue('paymentMethod', value as AlterationInput['paymentMethod'], {
                        shouldDirty: true
                      })
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder={tSales('paymentMethod')} />
                    </SelectTrigger>
                    <SelectContent>
                      {PAYMENT_METHODS.map((method) => (
                        <SelectItem key={method} value={method}>
                          {tSales(`payment.${method}`)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              ) : (
                <p className="self-end pb-2 text-sm text-muted-foreground">
                  {t('dueOnReturnHint')}
                </p>
              )}
            </>
          ) : null}
        </CardContent>
      </Card>

      {/* Said plainly: this is the rule the whole issue turns on. */}
      <p className="text-sm text-muted-foreground">{t('noStockNotice')}</p>

      <Button type="submit" size="lg" disabled={isPending}>
        <Scissors className="size-4" />
        {isPending ? t('receiving') : t('receive')}
      </Button>
    </form>
  );
}

function Field({
  label,
  error,
  children
}: {
  label: string;
  error?: string | null;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
