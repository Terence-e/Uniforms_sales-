'use client';

import { useMemo, useTransition } from 'react';
import { useFieldArray, useForm, useWatch } from 'react-hook-form';
import { standardSchemaResolver } from '@hookform/resolvers/standard-schema';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Trash2, Plus } from 'lucide-react';
import { useRouter } from '@/i18n/navigation';
import { createOrder } from '@/actions/orders';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { formatMoney } from '@/lib/format';
import { cn } from '@/lib/utils';
import { computeTotals, PAYMENT_METHODS } from '@/lib/validation/sale-schema';
import {
  EMPTY_ORDER_ITEM,
  orderSchema,
  type OrderInput
} from '@/lib/validation/order-schema';
import type { ProductOption } from '@/components/forms/sale-form';

/**
 * Order entry. Structurally the sale form plus an expected-ready date and a
 * measurements box, and minus the signature pad -- nothing is handed over here,
 * so there is nothing for the parent to sign for.
 *
 * Payment is taken in full at this point (A-FR-9.1), which is why the totals
 * block reads "paid in full" rather than "total due". Placing the order writes
 * no stock movement; see createOrder().
 */

const DEFAULTS: OrderInput = {
  customerName: '',
  studentName: null,
  classLevel: null,
  phone: null,
  paymentMethod: 'cash',
  items: [{ ...EMPTY_ORDER_ITEM }],
  discount: 0,
  expectedReadyDate: null,
  measurements: null,
  notes: null
};

export function OrderForm({ products }: { products: ProductOption[] }) {
  const t = useTranslations('Orders');
  const tSales = useTranslations('Sales');
  const tv = useTranslations('Validation');
  const locale = useLocale();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const form = useForm<OrderInput>({
    resolver: standardSchemaResolver(orderSchema),
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
    setValue(`items.${index}.description`, productLabel(product), { shouldDirty: true });
    setValue(`items.${index}.size`, product.size, { shouldDirty: true });
    setValue(`items.${index}.unitPrice`, product.unit_price, { shouldDirty: true });
  }

  /** Turns a schema message key into localised text, falling back to the raw text. */
  function message(key?: string) {
    if (!key) return null;
    const known = [
      'required',
      'minItems',
      'positive',
      'nonNegative',
      'discountTooLarge',
      'invalidDate'
    ];
    return known.includes(key) ? tv(key as never) : key;
  }

  const onSubmit = handleSubmit((values) => {
    startTransition(async () => {
      const result = await createOrder(values);

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

      toast.success(t('success', { orderNo: result.orderNo }));
      form.reset(DEFAULTS);
      router.push(`/orders/${result.orderId}/receipt`);
    });
  });

  const itemsError =
    formState.errors.items?.message ?? formState.errors.items?.root?.message;

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-6">
      {/* ------------------------------------------------------- customer */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('customerSection')}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field
            label={tSales('customerName')}
            error={message(formState.errors.customerName?.message)}
          >
            <Input
              {...register('customerName')}
              autoComplete="name"
              aria-invalid={Boolean(formState.errors.customerName)}
            />
          </Field>

          <Field label={tSales('studentName')}>
            <Input {...register('studentName')} />
          </Field>

          <Field label={tSales('classLevel')}>
            <Input {...register('classLevel')} />
          </Field>

          <Field label={tSales('phone')}>
            <Input {...register('phone')} type="tel" inputMode="tel" />
          </Field>

          <Field label={tSales('paymentMethod')}>
            <Select
              defaultValue="cash"
              onValueChange={(value) =>
                setValue('paymentMethod', value as OrderInput['paymentMethod'], {
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
                    {tSales(`payment.${method}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field
            label={t('expectedReadyDate')}
            error={message(formState.errors.expectedReadyDate?.message)}
          >
            <Input
              {...register('expectedReadyDate')}
              type="date"
              aria-invalid={Boolean(formState.errors.expectedReadyDate)}
            />
          </Field>
        </CardContent>
      </Card>

      {/* ---------------------------------------------------------- items */}
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">{tSales('items')}</CardTitle>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => append({ ...EMPTY_ORDER_ITEM })}
          >
            <Plus className="size-4" />
            {tSales('addItem')}
          </Button>
        </CardHeader>

        <CardContent className="space-y-4">
          {fields.map((field, index) => {
            const itemErrors = formState.errors.items?.[index];
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
                    {tSales('product')}
                  </Label>
                  <Select onValueChange={(value) => applyProduct(index, value)}>
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
                  <Input
                    {...register(`items.${index}.description`)}
                    placeholder={tSales('product')}
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
                    {tSales('unitPrice')}
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
                    {tSales('quantity')}
                  </Label>
                  <Input
                    {...register(`items.${index}.quantity`)}
                    type="number"
                    min={1}
                    step={1}
                    inputMode="numeric"
                    aria-invalid={Boolean(itemErrors?.quantity)}
                  />
                </div>

                <div className="flex items-end justify-between gap-2 sm:col-span-3">
                  <div className="flex-1">
                    <Label className="mb-2 text-xs text-muted-foreground">
                      {tSales('lineTotal')}
                    </Label>
                    <p className="tabular-nums py-2 text-sm font-medium">
                      {formatMoney(line, locale)}
                    </p>
                  </div>
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

                {/* A ticked line goes home with the parent today and never
                    enters the status workflow -- the server stores its status
                    as NULL (A-FR-9.5). */}
                <div className="flex items-center gap-2 border-t pt-3 sm:col-span-12">
                  <Checkbox
                    id={`handedOver-${field.id}`}
                    checked={Boolean(watchedItems?.[index]?.handedOver)}
                    onCheckedChange={(checked) =>
                      setValue(`items.${index}.handedOver`, checked === true, {
                        shouldDirty: true
                      })
                    }
                  />
                  <Label
                    htmlFor={`handedOver-${field.id}`}
                    className="text-xs font-normal text-muted-foreground"
                  >
                    {t('handedOverNow')}
                  </Label>
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
              label={tSales('discount')}
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

            <Field label={t('measurements')} hint={t('measurementsHint')}>
              <Textarea {...register('measurements')} rows={3} />
            </Field>

            <Field label={tSales('notes')}>
              <Input {...register('notes')} />
            </Field>
          </div>

          <dl className="space-y-2 self-end rounded-lg bg-muted/50 p-4 text-sm">
            <Row label={tSales('subtotal')} value={formatMoney(totals.subtotal, locale)} />
            <Row
              label={tSales('discount')}
              value={`− ${formatMoney(totals.discount, locale)}`}
            />
            <Row
              label={t('paidInFull')}
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
  hint,
  error,
  children
}: {
  label: string;
  hint?: string;
  error?: string | null;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
      {hint && !error ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
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
