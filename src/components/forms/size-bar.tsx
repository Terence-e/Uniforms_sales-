'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

/**
 * The size picker shown once a product is chosen (A-FR-4.2). Boxes for the set
 * the Super Admin configured in Settings, plus a free-typed custom size for the
 * one-off that is not in the set -- so a seller is never stuck mid-sale and no
 * code change is needed to sell an odd size.
 *
 * Mobile-first (P-7): big tap targets, no dropdown. The chosen size sits beside
 * the product on the line and prints on the receipt.
 */
export function SizeBar({
  sizes,
  value,
  onChange,
  label
}: {
  sizes: string[];
  value: string | null;
  onChange: (size: string | null) => void;
  label?: string;
}) {
  const t = useTranslations('Sizes');
  const chosen = value ?? '';
  // A value that is set but not one of the boxes is a custom size; keep the
  // custom field open for it so it stays visible and editable.
  const isCustom = chosen !== '' && !sizes.includes(chosen);
  const [customOpen, setCustomOpen] = useState(isCustom);

  const box = (selected: boolean) =>
    selected
      ? 'rounded-md border border-primary bg-primary px-2.5 py-1.5 text-sm font-semibold text-primary-foreground'
      : 'rounded-md border bg-background px-2.5 py-1.5 text-sm font-medium hover:bg-muted';

  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label ?? t('chooseSize')}</Label>
      <div className="flex flex-wrap items-center gap-1.5">
        {sizes.map((s) => (
          <button
            key={s}
            type="button"
            aria-pressed={!isCustom && chosen === s}
            onClick={() => {
              setCustomOpen(false);
              onChange(chosen === s ? null : s);
            }}
            className={box(!isCustom && chosen === s)}
          >
            {s}
          </button>
        ))}
        <button
          type="button"
          aria-pressed={customOpen || isCustom}
          onClick={() => {
            const next = !(customOpen || isCustom);
            setCustomOpen(next);
            // Leaving custom clears a custom value so it cannot linger unseen.
            if (!next && isCustom) onChange(null);
          }}
          className={box(customOpen || isCustom)}
        >
          {t('custom')}
        </button>
      </div>

      {customOpen || isCustom ? (
        <Input
          value={chosen}
          onChange={(e) => onChange(e.target.value || null)}
          placeholder={t('customPlaceholder')}
          className="w-40"
          autoComplete="off"
        />
      ) : null}
    </div>
  );
}
