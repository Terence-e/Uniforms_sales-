'use client';

import { useMemo, useState, useTransition } from 'react';
import { useFieldArray, useForm, useWatch } from 'react-hook-form';
import { standardSchemaResolver } from '@hookform/resolvers/standard-schema';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Trash2, Plus } from 'lucide-react';
import { useRouter } from '@/i18n/navigation';
import { createSale } from '@/actions/sales';
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
import { SignaturePad } from '@/components/signature-pad';
import { formatMoney } from '@/lib/format';
import { cn } from '@/lib/utils';
import {
  computeTotals,
  EMPTY_SALE_ITEM,
  PAYMENT_METHODS,
  saleSchema,
  type SaleInput
} from '@/lib/validation/sale-schema';

/**
 * Flip to true once phase 2 ships. The schema, the column and the pad component
 * are already in place; only the capture step is held back.
 */
const ENABLE_SIGNATURE = false;

export type ProductOption = {
  id: string;
  sku: string;
  name_en: string;
  name_fr: string;
  size: string | null;
  unit_price: number;
  category: string;
  /**
   * What can actually be sold: in stock minus what Ready orders have already
   * claimed (A-FR-9.10). Optional so the production form, which cares about
   * neither, can keep passing the same shape.
   */
  available?: number;
  inStock?: number;
  reserved?: number;
};

const DEFAULTS: SaleInput = {
  customerName: '',
  studentName: null,
  classLevel: null,
  phone: null,
  paymentMethod: 'cash',
  items: [{ ...EMPTY_SALE_ITEM }],
  discount: 0,
  notes: null,
  signature: null
};

export function SaleForm({ products }: { products: ProductOption[] }) {
  const t = useTranslations('Sales');
  const tv = useTranslations('Validation');
  const locale = useLocale();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [signature, setSignature] = useState<string | null>(null);

  const form = useForm<SaleInput>({
    resolver: standardSchemaResolver(saleSchema),
    defaultValues: DEFAULTS,
    mode: 'onSubmit'
  });

  const { control, register, handleSubmit, setValue, formState } = form;
  const { fields, append, remove } = useFieldArray({ control, name: 'items' });

  // Watched separately from `formState` so the totals recompute on every
  // keystroke without re-rendering the whole form tree twice.
  const watchedItems = useWatch({ control, name: 'items' });
  const watchedDiscount = useWatch({ control, name: 'discount' });

  const totals = useMemo(() => {
    const lines = (watchedItems ?? []).map((item) => ({
      unitPrice: Number(item?.unitPrice) || 0,
      quantity: Number(item?.quantity) || 0
    }));
    return computeTotals(lines, Number(watchedDiscount) || 0);
  }, [watchedItems, watchedDiscount]);

  const productLabel = (product: ProductOption) => {
    const name = locale === 'fr' ? product.name_fr : product.name_en;
    return product.size ? `${name} — ${product.size}` : name;
  };

  /** Selecting a product pre-fills the line but leaves it editable. */
  function applyProduct(index: number, productId: string) {
    const product = products.find((candidate) => candidate.id === productId);
    if (!product) return;
    setValue(`items.${index}.productId`, product.id, { shouldDirty: true });
    setValue(`items.${index}.description`, productLabel(product), {
      shouldDirty: true
    });
    setValue(`items.${index}.size`, product.size, { shouldDirty: true });
    setValue(`items.${index}.unitPrice`, product.unit_price, {
      shouldDirty: true
    });
  }

  /** Turns a schema message key into localised text, falling back to the raw text. */
  function message(key?: string) {
    if (!key) return null;
    const known = [
      'required',
      'minItems',
      'positive',
      'nonNegative',
      'discountTooLarge'
    ];
    return known.includes(key) ? tv(key as never) : key;
  }

  const onSubmit = handleSubmit((values) => {
    startTransition(async () => {
      const result = await createSale({ ...values, signature });

      if (!result.ok) {
        if (result.error === 'validation' && result.fieldErrors) {
          for (const [path, error] of Object.entries(result.fieldErrors)) {
            form.setError(path as never, { message: error });
          }
        }
        toast.error(
          result.error === 'validation'
            ? tv('required')
            : result.error === 'unauthorized'
              ? t('submit')
              : result.error
        );
        return;
      }

      toast.success(t('success', { receiptNo: result.receiptNo }));
      form.reset(DEFAULTS);
      setSignature(null);
      router.push(`/sales/${result.saleId}/receipt`);
    });
  });

  const itemsError = formState.errors.items?.message ?? formState.errors.items?.root?.message;

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-6">
      {/* ------------------------------------------------------- customer */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('title')}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field
            label={t('customerName')}
            error={message(formState.errors.customerName?.message)}
          >
            <Input
              {...register('customerName')}
              autoComplete="name"
              aria-invalid={Boolean(formState.errors.customerName)}
            />
          </Field>

          <Field label={t('studentName')}>
            <Input {...register('studentName')} />
          </Field>

          <Field label={t('classLevel')}>
            <Input {...register('classLevel')} />
          </Field>

          <Field label={t('phone')}>
            <Input {...register('phone')} type="tel" inputMode="tel" />
          </Field>

          <Field label={t('paymentMethod')}>
            <Select
              defaultValue="cash"
              onValueChange={(value) =>
                setValue('paymentMethod', value as SaleInput['paymentMethod'], {
                  shouldDirty: true
                })
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAYMENT_METHODS.map((method) => (
                  <SelectItem key={method} value={method}>
                    {t(`payment.${method}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </CardContent>
      </Card>

      {/* ---------------------------------------------------------- items */}
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">{t('items')}</CardTitle>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => append({ ...EMPTY_SALE_ITEM })}
          >
            <Plus className="size-4" />
            {t('addItem')}
          </Button>
        </CardHeader>

        <CardContent className="space-y-4">
          {fields.map((field, index) => {
            const itemErrors = formState.errors.items?.[index];
            const chosenId = watchedItems?.[index]?.productId;
            const chosen = chosenId
              ? products.find((candidate) => candidate.id === chosenId)
              : undefined;
            const wanted = Number(watchedItems?.[index]?.quantity) || 0;
            const line =
              (Number(watchedItems?.[index]?.unitPrice) || 0) *
              (Number(watchedItems?.[index]?.quantity) || 0);

            return (
              <div
                key={field.id}
                className="grid gap-3 rounded-lg border p-3 sm:grid-cols-12"
              >
                <div className="sm:col-span-5">
                  <Label className="mb-2 text-xs text-muted-foreground">
                    {t('product')}
                  </Label>
                  <Select onValueChange={(value) => applyProduct(index, value)}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder={t('selectProduct')} />
                    </SelectTrigger>
                    <SelectContent>
                      {products.map((product) => (
                        <SelectItem key={product.id} value={product.id}>
                          <span className="flex w-full items-center justify-between gap-3">
                            <span>{productLabel(product)}</span>
                            {/* Availability sits beside the name so the seller
                                reads it while choosing rather than discovering
                                it afterwards. */}
                            {typeof product.available === 'number' ? (
                              <span
                                className={
                                  product.available <= 0
                                    ? 'text-xs font-medium text-destructive'
                                    : 'text-xs text-muted-foreground'
                                }
                              >
                                {t('availableShort', { count: product.available })}
                              </span>
                            ) : null}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    {...register(`items.${index}.description`)}
                    placeholder={t('product')}
                    className="mt-2"
                    aria-invalid={Boolean(itemErrors?.description)}
                  />
                  {itemErrors?.description ? (
                    <p className="mt-1 text-xs text-destructive">
                      {message(itemErrors.description.message)}
                    </p>
                  ) : null}
                </div>

                <div className="sm:col-span-2">
                  <Label className="mb-2 text-xs text-muted-foreground">
                    {t('unitPrice')}
                  </Label>
                  <Input
                    {...register(`items.${index}.unitPrice`)}
                    type="number"
                    min={0}
                    step="0.01"
                    inputMode="decimal"
                    aria-invalid={Boolean(itemErrors?.unitPrice)}
                  />
                </div>

                <div className="sm:col-span-2">
                  <Label className="mb-2 text-xs text-muted-foreground">
                    {t('quantity')}
                  </Label>
                  <Input
                    {...register(`items.${index}.quantity`)}
                    type="number"
                    min={1}
                    step={1}
                    inputMode="numeric"
                    aria-invalid={Boolean(itemErrors?.quantity)}
                  />
                  {/* Shown, never enforced: selling below stock is allowed with
                      a warning, an override and an audit row, which is a
                      separate issue. A hard cap here would have to be undone
                      there. */}
                  {chosen && typeof chosen.available === 'number' ? (
                    <p
                      className={
                        wanted > chosen.available
                          ? 'mt-1 text-xs font-medium text-amber-600 dark:text-amber-500'
                          : 'mt-1 text-xs text-muted-foreground'
                      }
                    >
                      {t('availableShort', { count: chosen.available })}
                    </p>
                  ) : null}
                </div>

                <div className="flex items-end justify-between gap-2 sm:col-span-3">
                  <div className="flex-1">
                    <Label className="mb-2 text-xs text-muted-foreground">
                      {t('lineTotal')}
                    </Label>
                    <p className="tabular-nums py-2 text-sm font-medium">
                      {formatMoney(line, locale)}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={t('removeItem')}
                    disabled={fields.length === 1}
                    onClick={() => remove(index)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>
            );
          })}

          {itemsError ? (
            <p className="text-sm text-destructive">{message(itemsError)}</p>
          ) : null}
        </CardContent>
      </Card>

      {/* --------------------------------------------------------- totals */}
      <Card>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-4">
            <Field
              label={t('discount')}
              error={message(formState.errors.discount?.message)}
            >
              <Input
                {...register('discount')}
                type="number"
                min={0}
                step="0.01"
                inputMode="decimal"
                aria-invalid={Boolean(formState.errors.discount)}
              />
            </Field>

            <Field label={t('notes')}>
              <Input {...register('notes')} />
            </Field>

            {ENABLE_SIGNATURE ? (
              <SignaturePad label={t('notes')} onChange={setSignature} />
            ) : null}
          </div>

          <dl className="space-y-2 self-end rounded-lg bg-muted/50 p-4 text-sm">
            <Row label={t('subtotal')} value={formatMoney(totals.subtotal, locale)} />
            <Row label={t('discount')} value={`− ${formatMoney(totals.discount, locale)}`} />
            <Row
              label={t('grandTotal')}
              value={formatMoney(totals.total, locale)}
              emphasis
            />
          </dl>
        </CardContent>
      </Card>

      <Button type="submit" size="lg" disabled={isPending} className="w-full sm:w-auto">
        {isPending ? t('submitting') : t('submit')}
      </Button>
    </form>
  );
}

// ------------------------------------------------------------------ bits

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

function Row({
  label,
  value,
  emphasis
}: {
  label: string;
  value: string;
  emphasis?: boolean;
}) {
  return (
    <div
      className={cn(
        'flex items-baseline justify-between gap-4',
        emphasis && 'border-t pt-2 text-base font-semibold'
      )}
    >
      <dt className={cn(!emphasis && 'text-muted-foreground')}>{label}</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  );
}
