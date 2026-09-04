'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { logAudit } from '@/lib/audit';
import { notify, OVERSIGHT } from '@/lib/notify';
import { productSchema, type ProductInput } from '@/lib/validation/catalogue-schema';

type FieldErrors = Partial<
  Record<'name_en' | 'name_fr' | 'category' | 'unit_price' | 'reorder_level', string>
>;

export type ProductResult =
  | { ok: true }
  | { ok: false; error?: string; warning?: 'duplicate'; fieldErrors?: FieldErrors };

/** Returns the caller's id iff they are a Super Admin (checked server-side). */
async function superAdminId(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();
  return data?.role === 'super_admin' ? user.id : null;
}

function slug(s: string) {
  return s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 24);
}

function genSku(nameEn: string) {
  const rand = Math.random().toString(36).slice(2, 6);
  return [slug(nameEn) || 'item', rand].filter(Boolean).join('-');
}

/** All products, active and archived, with derived quantity + threshold. */
export async function listCatalogue() {
  const supabase = await createClient();
  const { data } = await supabase
    .from('products')
    .select(
      `id, sku, name_en, name_fr, category, unit_price, reorder_level, is_active,
       levels:stock_levels ( quantity )`
    )
    .order('is_active', { ascending: false })
    .order('name_en');

  return (data ?? []).map((p) => {
    // stock_levels is now one row per (product, size); the catalogue overview
    // sums them into a single on-hand figure per garment.
    const levels = Array.isArray(p.levels) ? p.levels : p.levels ? [p.levels] : [];
    const quantity = levels.reduce((sum, l) => sum + (l.quantity ?? 0), 0);
    return {
      ...p,
      quantity,
      reorderLevel: p.reorder_level
    };
  });
}

function parse(input: ProductInput): { ok: true; data: ReturnType<typeof productSchema.parse> } | { ok: false; fieldErrors: FieldErrors } {
  const parsed = productSchema.safeParse(input);
  if (parsed.success) return { ok: true, data: parsed.data };
  const fieldErrors: FieldErrors = {};
  for (const issue of parsed.error.issues) {
    const f = issue.path[0] as keyof FieldErrors;
    if (f) fieldErrors[f] ??= issue.message;
  }
  return { ok: false, fieldErrors };
}

export async function createProduct(
  input: ProductInput,
  opts?: { force?: boolean }
): Promise<ProductResult> {
  const p = parse(input);
  if (!p.ok) return { ok: false, fieldErrors: p.fieldErrors };

  const uid = await superAdminId();
  if (!uid) return { ok: false, error: 'forbidden' };

  const { name_en, name_fr, category, unit_price, reorder_level } = p.data;
  const admin = createAdminClient();

  // Duplicate warning (A-FR-4.4): same garment name among active products.
  if (!opts?.force) {
    const { data: dup } = await admin
      .from('products')
      .select('id')
      .eq('is_active', true)
      .ilike('name_en', name_en)
      .limit(1);
    if (dup && dup.length > 0) return { ok: false, warning: 'duplicate' };
  }

  const { data: created, error } = await admin
    .from('products')
    .insert({
      sku: genSku(name_en),
      name_en,
      name_fr: name_fr || name_en,
      category,
      unit_price,
      reorder_level
    })
    .select('id')
    .single();
  if (error || !created) return { ok: false, error: error?.message ?? 'createFailed' };

  // stock_levels rows are created per (product, size) by the first movement --
  // there is nothing to seed here. The low-stock threshold lives on the product.

  await logAudit({
    actorId: uid,
    action: 'product_created',
    targetTable: 'products',
    targetId: created.id,
    newValue: { name_en, name_fr: name_fr || name_en, category, unit_price, reorder_level }
  });

  revalidatePath('/', 'layout');
  return { ok: true };
}

export async function updateProduct(
  id: string,
  input: ProductInput,
  opts?: { force?: boolean }
): Promise<ProductResult> {
  const p = parse(input);
  if (!p.ok) return { ok: false, fieldErrors: p.fieldErrors };

  const uid = await superAdminId();
  if (!uid) return { ok: false, error: 'forbidden' };

  const { name_en, name_fr, category, unit_price, reorder_level } = p.data;
  const admin = createAdminClient();

  const { data: current } = await admin
    .from('products')
    .select('name_en, name_fr, category, unit_price')
    .eq('id', id)
    .single();
  if (!current) return { ok: false, error: 'notFound' };

  // Duplicate warning (A-FR-4.4): same garment name among *other* active
  // products. Excludes the row being edited so re-saving it is never flagged.
  if (!opts?.force) {
    const { data: dup } = await admin
      .from('products')
      .select('id')
      .eq('is_active', true)
      .neq('id', id)
      .ilike('name_en', name_en)
      .limit(1);
    if (dup && dup.length > 0) return { ok: false, warning: 'duplicate' };
  }

  const { error } = await admin
    .from('products')
    .update({ name_en, name_fr: name_fr || name_en, category, unit_price, reorder_level })
    .eq('id', id);
  if (error) return { ok: false, error: error.message };

  const priceChanged = Number(current.unit_price) !== unit_price;

  // Price change flow (A-FR-4.5): record old/new/who/when.
  if (priceChanged) {
    await admin.from('product_prices_history').insert({
      product_id: id,
      old_price: current.unit_price,
      new_price: unit_price,
      changed_by: uid
    });
    // A price change is its own audited event (A-FR-11.1).
    await logAudit({
      actorId: uid,
      action: 'price_changed',
      targetTable: 'products',
      targetId: id,
      previousValue: { unit_price: Number(current.unit_price) },
      newValue: { unit_price }
    });
    // Everyone who prices from the catalogue should know it moved.
    await notify({
      type: 'price_changed',
      recipients: { kind: 'roles', roles: OVERSIGHT },
      excludeActorId: uid,
      data: { product: name_en }
    });
  }

  // The edit itself is audited too, with the full before/after.
  await logAudit({
    actorId: uid,
    action: 'product_updated',
    targetTable: 'products',
    targetId: id,
    previousValue: current,
    newValue: { name_en, name_fr: name_fr || name_en, category, unit_price }
  });

  revalidatePath('/', 'layout');
  return { ok: true };
}

/** Archive (is_active=false) or restore a product. Archived products stay in
 * history but disappear from the sale screen (A-FR-4.6). */
export async function setProductActive(id: string, active: boolean): Promise<ProductResult> {
  const uid = await superAdminId();
  if (!uid) return { ok: false, error: 'forbidden' };

  const admin = createAdminClient();
  const { error } = await admin.from('products').update({ is_active: active }).eq('id', id);
  if (error) return { ok: false, error: error.message };

  await logAudit({
    actorId: uid,
    action: active ? 'product_restored' : 'product_archived',
    targetTable: 'products',
    targetId: id,
    previousValue: { is_active: !active },
    newValue: { is_active: active }
  });

  revalidatePath('/', 'layout');
  return { ok: true };
}
