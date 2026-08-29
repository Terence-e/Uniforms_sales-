'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { PencilIcon, PlusIcon, TriangleAlertIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { createProduct, updateProduct, type ProductResult } from '@/actions/catalogue';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';

type Product = {
  id: string;
  name_en: string;
  name_fr: string;
  size: string | null;
  category: string;
  unit_price: number;
  reorderLevel: number;
};

type FieldErrors = Record<string, string>;

export function ProductForm({ product }: { product?: Product }) {
  const t = useTranslations('Catalogue');
  const tv = useTranslations('Validation');
  const router = useRouter();
  const isEdit = Boolean(product);

  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [duplicate, setDuplicate] = useState(false);

  const [nameEn, setNameEn] = useState(product?.name_en ?? '');
  const [nameFr, setNameFr] = useState(product?.name_fr ?? '');
  const [size, setSize] = useState(product?.size ?? '');
  const [category, setCategory] = useState(product?.category ?? 'uniform');
  const [price, setPrice] = useState(product ? String(product.unit_price) : '');
  const [threshold, setThreshold] = useState(product ? String(product.reorderLevel) : '0');

  function resetForm() {
    setErrors({});
    setDuplicate(false);
    if (!isEdit) {
      setNameEn('');
      setNameFr('');
      setSize('');
      setCategory('uniform');
      setPrice('');
      setThreshold('0');
    }
  }

  async function submit(force: boolean) {
    setErrors({});
    setPending(true);
    const input = {
      name_en: nameEn,
      name_fr: nameFr,
      size,
      category,
      unit_price: price,
      reorder_level: threshold
    };
    const res: ProductResult = isEdit
      ? await updateProduct(product!.id, input)
      : await createProduct(input, { force });
    setPending(false);

    if (res.ok) {
      toast.success(isEdit ? t('updated') : t('created'));
      setOpen(false);
      resetForm();
      router.refresh();
      return;
    }
    if (res.warning === 'duplicate') {
      setDuplicate(true);
      return;
    }
    if (res.fieldErrors) {
      setErrors(res.fieldErrors);
      return;
    }
    toast.error(res.error === 'forbidden' ? t('forbidden') : t('error'));
  }

  const field = (key: string) => (errors[key] ? <p className="text-sm text-destructive">{tv(errors[key])}</p> : null);

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) resetForm();
      }}
    >
      <DialogTrigger asChild>
        {isEdit ? (
          <Button variant="outline" size="sm" className="gap-1.5">
            <PencilIcon className="size-4" />
            {t('edit')}
          </Button>
        ) : (
          <Button className="gap-2">
            <PlusIcon className="size-4" />
            {t('newProduct')}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? t('editTitle') : t('newProduct')}</DialogTitle>
        </DialogHeader>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit(false);
          }}
          className="space-y-4"
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="name_en">{t('garmentEn')}</Label>
              <Input id="name_en" value={nameEn} onChange={(e) => setNameEn(e.target.value)} />
              {field('name_en')}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="name_fr">{t('garmentFr')}</Label>
              <Input id="name_fr" value={nameFr} onChange={(e) => setNameFr(e.target.value)} placeholder={nameEn} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="size">{t('size')}</Label>
              <Input id="size" value={size} onChange={(e) => setSize(e.target.value)} />
              {field('size')}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="category">{t('category')}</Label>
              <Input id="category" value={category} onChange={(e) => setCategory(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="price">{t('price')}</Label>
              <Input
                id="price"
                inputMode="numeric"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
              />
              {field('unit_price')}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="threshold">{t('threshold')}</Label>
              <Input
                id="threshold"
                inputMode="numeric"
                value={threshold}
                onChange={(e) => setThreshold(e.target.value)}
              />
              {field('reorder_level')}
            </div>
          </div>

          {duplicate && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-400">
              <TriangleAlertIcon className="mt-0.5 size-4 shrink-0" />
              <span>{t('duplicateWarning')}</span>
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setOpen(false);
                resetForm();
              }}
              disabled={pending}
            >
              {t('cancel')}
            </Button>
            {duplicate ? (
              <Button type="button" onClick={() => submit(true)} disabled={pending} className="gap-2">
                {pending && <Spinner className="size-4 border-primary-foreground/40 border-t-primary-foreground" />}
                {t('createAnyway')}
              </Button>
            ) : (
              <Button type="submit" disabled={pending} className="gap-2">
                {pending && <Spinner className="size-4 border-primary-foreground/40 border-t-primary-foreground" />}
                {pending ? (isEdit ? t('saving') : t('creating')) : isEdit ? t('save') : t('create')}
              </Button>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
