import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { getProfile } from '@/actions/auth';
import { listCatalogue } from '@/actions/catalogue';
import { ArchiveToggle } from '@/components/catalogue/archive-toggle';
import { ProductForm } from '@/components/forms/product-form';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import { formatMoney } from '@/lib/format';

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'Catalogue' });
  return { title: t('title') };
}

export default async function CataloguePage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const [profile, t] = await Promise.all([getProfile(), getTranslations('Catalogue')]);

  // Only the Super Admin manages the catalogue (A-FR-4.3), enforced server-side.
  if (!profile || profile.role !== 'super_admin') notFound();

  const products = await listCatalogue();

  // Previously-entered sizes, distinct and sorted, feed the size autocomplete
  // (A-FR-4.1). Kept as free text so '10' and 'Size 10' can deliberately coexist
  // while the existing value still surfaces as a suggestion.
  const sizes = Array.from(
    new Set(products.map((p) => p.size).filter((s): s is string => Boolean(s)))
  ).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t('title')}</h1>
          <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
        </div>
        <ProductForm sizes={sizes} />
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('garment')}</TableHead>
                  <TableHead>{t('size')}</TableHead>
                  <TableHead className="text-right">{t('price')}</TableHead>
                  <TableHead className="text-right">{t('quantity')}</TableHead>
                  <TableHead>{t('status')}</TableHead>
                  <TableHead className="text-right">{t('actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {products.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                      {t('empty')}
                    </TableCell>
                  </TableRow>
                ) : (
                  products.map((p) => (
                    <TableRow key={p.id} className={p.is_active ? '' : 'opacity-60'}>
                      <TableCell className="font-medium">
                        {locale === 'fr' ? p.name_fr : p.name_en}
                      </TableCell>
                      <TableCell>{p.size || '—'}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatMoney(p.unit_price, locale)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{p.quantity}</TableCell>
                      <TableCell>
                        <Badge variant={p.is_active ? 'secondary' : 'outline'}>
                          {p.is_active ? t('active') : t('archived')}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-1">
                          <ProductForm
                            sizes={sizes}
                            product={{
                              id: p.id,
                              name_en: p.name_en,
                              name_fr: p.name_fr,
                              size: p.size,
                              category: p.category,
                              unit_price: p.unit_price,
                              reorderLevel: p.reorderLevel
                            }}
                          />
                          <ArchiveToggle
                            id={p.id}
                            active={p.is_active}
                            name={locale === 'fr' ? p.name_fr : p.name_en}
                          />
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
