'use client';

import { useMemo, useTransition } from 'react';
import { useFieldArray, useForm, useWatch } from 'react-hook-form';
import { standardSchemaResolver } from '@hookform/resolvers/standard-schema';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Trash2, Plus, Factory, ClipboardList } from 'lucide-react';
import { useRouter } from '@/i18n/navigation';
import { recordProductionBatch } from '@/actions/stock';
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
import type { ProductOption } from '@/components/forms/sale-form';
import type { WaitingCount } from '@/actions/orders';
import { toDateInputValue } from '@/lib/format';
import {
  EMPTY_PRODUCTION_LINE,
  productionBatchSchema,
  totalUnits,
  type ProductionBatchInput
} from '@/lib/validation/production-schema';

/**
 * Production entry (A-FR-5.2, A-FR-5.3).
 *
 * Multi-line by default rather than as an "add batch" mode: this shop makes its
 * uniforms continuously, so a run coming off the machines is normally several
 * sizes at once. Making the single-line case a batch of one costs the seller
 * nothing and removes a mode from the screen.
 *
 * The batch is submitted whole to record_production_batch(); the form never
 * writes stock levels, and there is no field anywhere that sets a quantity
 * directly (A-FR-5.4).
 */

export function ProductionForm({
  products,
  tailors,
  waiting
}: {
  products: ProductOption[];
  tailors: string[];
  /** product_id -> outstanding orders waiting on it (A-FR-9.11). */
  waiting: Record<string, WaitingCount>;
}) {
  const t = useTranslations('Production');
  const tSales = useTranslations('Sales');
  const tv = useTranslations('Validation');
  const locale = useLocale();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const form = useForm<ProductionBatchInput>({
    resolver: standardSchemaResolver(productionBatchSchema),
    defaultValues: {
      lines: [{ ...EMPTY_PRODUCTION_LINE }],
      // Today, because production is nearly always entered the day it happened
      // -- but editable, because "nearly always" is not always.
      occurredOn: toDateInputValue(new Date()),
      tailorName: null,
      note: null
    },
    mode: 'onSubmit'
  });

  const { control, register, handleSubmit, setValue, formState } = form;
  const { fields, append, remove } = useFieldArray({ control, name: 'lines' });
  const watchedLines = useWatch({ control, name: 'lines' });

  const units = useMemo(() => totalUnits(watchedLines ?? []), [watchedLines]);

  const productLabel = (product: ProductOption) => {
    const name = locale === 'fr' ? product.name_fr : product.name_en;
    return product.size ? `${name} — ${product.size}` : name;
  };

  function message(key?: string) {
    if (!key) return null;
    const known = ['required', 'minItems', 'positive', 'nonNegative', 'wholeNumber', 'invalidDate'];
    return known.includes(key) ? tv(key as never) : key;
  }

  const onSubmit = handleSubmit((values) => {
    startTransition(async () => {
      const result = await recordProductionBatch(values);

      if (!result.ok) {
        if (result.error === 'validation' && result.fieldErrors) {
          for (const [path, error] of Object.entries(result.fieldErrors)) {
            form.setError(path as never, { message: error });
          }
        }
        toast.error(result.error === 'validation' ? tv('required') : result.error);
        return;
      }

      toast.success(
        t('success', { units: result.totalUnits, lines: result.lineCount })
      );
      form.reset({
        lines: [{ ...EMPTY_PRODUCTION_LINE }],
        occurredOn: values.occurredOn,
        tailorName: values.tailorName,
        note: null
      });
      router.refresh();
    });
  });

  const linesError = formState.errors.lines?.message ?? formState.errors.lines?.root?.message;

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-6">
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">{t('title')}</CardTitle>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => append({ ...EMPTY_PRODUCTION_LINE })}
          >
            <Plus className="size-4" />
            {t('addLine')}
          </Button>
        </CardHeader>

        <CardContent className="space-y-4">
          {fields.map((field, index) => {
            const lineErrors = formState.errors.lines?.[index];
            const chosen = watchedLines?.[index]?.productId;
            const waitingHere = chosen ? waiting[chosen] : undefined;
            return (
              <div key={field.id} className="grid gap-3 rounded-lg border p-3 sm:grid-cols-12">
                <div className="sm:col-span-8">
                  <Label className="mb-2 text-xs text-muted-foreground">
                    {tSales('product')}
                  </Label>
                  <Select
                    onValueChange={(value) =>
                      setValue(`lines.${index}.productId`, value, { shouldDirty: true })
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder={tSales('selectProduct')} />
                    </SelectTrigger>
                    <SelectContent>
                      {products.map((product) => (
                        <SelectItem key={product.id} value={product.id}>
                          {productLabel(product)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {lineErrors?.productId ? (
                    <p className="mt-1 text-xs text-destructive">
                      {message(lineErrors.productId.message)}
                    </p>
                  ) : null}

                  {/* Informational only -- it never blocks the entry. Absent
                      entirely when nothing is waiting, rather than showing a
                      zero, so it reads as news and not as a permanent label
                      (A-FR-9.11). */}
                  {waitingHere ? (
                    <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-amber-600 dark:text-amber-500">
                      <ClipboardList className="size-3.5 shrink-0" />
                      {t('waitingOrders', {
                        orders: waitingHere.orders,
                        units: waitingHere.units
                      })}
                    </p>
                  ) : null}
                </div>

                <div className="sm:col-span-3">
                  <Label className="mb-2 text-xs text-muted-foreground">
                    {t('quantityMade')}
                  </Label>
                  <Input
                    {...register(`lines.${index}.quantity`)}
                    type="number"
                    min={1}
                    step={1}
                    inputMode="numeric"
                    aria-invalid={Boolean(lineErrors?.quantity)}
                  />
                  {lineErrors?.quantity ? (
                    <p className="mt-1 text-xs text-destructive">
                      {message(lineErrors.quantity.message)}
                    </p>
                  ) : null}
                </div>

                <div className="flex items-end sm:col-span-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={tSales('removeItem')}
                    disabled={fields.length === 1}
                    onClick={() => remove(index)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>
            );
          })}

          {linesError ? (
            <p className="text-sm text-destructive">{message(linesError)}</p>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="occurredOn">{t('dateMade')}</Label>
            <Input
              id="occurredOn"
              {...register('occurredOn')}
              type="date"
              max={toDateInputValue(new Date())}
              aria-invalid={Boolean(formState.errors.occurredOn)}
            />
            {formState.errors.occurredOn ? (
              <p className="text-sm text-destructive">
                {message(formState.errors.occurredOn.message)}
              </p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="tailorName">{t('tailor')}</Label>
            {/* A datalist rather than a select: the tailors are not users of
                this system, and a name that has never been typed before must
                still be enterable. */}
            <Input id="tailorName" {...register('tailorName')} list="tailor-names" />
            <datalist id="tailor-names">
              {tailors.map((name) => (
                <option key={name} value={name} />
              ))}
            </datalist>
          </div>

          <div className="space-y-2">
            <Label htmlFor="note">{t('note')}</Label>
            <Input id="note" {...register('note')} />
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center gap-4">
        <Button type="submit" size="lg" disabled={isPending}>
          <Factory className="size-4" />
          {isPending ? t('recording') : t('record')}
        </Button>
        <p className="text-sm text-muted-foreground">
          {t('batchTotal', { units, lines: fields.length })}
        </p>
      </div>
    </form>
  );
}
