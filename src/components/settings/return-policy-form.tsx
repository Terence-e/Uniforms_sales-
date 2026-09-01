'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { updateReturnPolicy, type PolicyRow } from '@/actions/return-policy';
import type { GarmentCondition, ReturnKind } from '@/types/database.types';

/**
 * The four return windows (A-FR-8.8).
 *
 * Days, not "3 months". A month is not a fixed length, and a policy that has to
 * be argued about at the counter is worse than one that reads awkwardly: 90 is
 * unambiguous in a way that "3 months" is not when the sale was on 30 November.
 * The screen shows the rough equivalent beside the number so nobody has to do
 * the arithmetic to recognise the school's stated rule.
 *
 * "Not permitted" is its own checkbox rather than an empty day-count box: a
 * blank field reads as "not filled in yet", and this is a deliberate, meaningful
 * state -- the fourth cell of the spec's own table.
 */
export function ReturnPolicyForm({ rows }: { rows: PolicyRow[] }) {
  const t = useTranslations('Settings');

  return (
    <div className="space-y-4">
      {rows.map((row) => (
        <PolicyRowEditor key={`${row.kind}:${row.condition}`} row={row} t={t} />
      ))}
    </div>
  );
}

function PolicyRowEditor({
  row,
  t
}: {
  row: PolicyRow;
  t: ReturnType<typeof useTranslations<'Settings'>>;
}) {
  const [isPending, startTransition] = useTransition();
  const [permitted, setPermitted] = useState(row.window_days !== null);
  // Kept when the box is unticked, so ticking it again does not lose what was
  // typed. Defaults to 30 for a row that has never had a window.
  const [days, setDays] = useState(String(row.window_days ?? 30));

  const dirty =
    (permitted ? Number(days) : null) !== row.window_days
    && (!permitted || days.trim() !== '');

  function save() {
    startTransition(async () => {
      const result = await updateReturnPolicy({
        kind: row.kind as ReturnKind,
        condition: row.condition as GarmentCondition,
        windowDays: permitted ? Number(days) : null
      });
      if (!result.ok) {
        toast.error(
          result.error === 'windowTooLong'
            ? t('errorTooLong')
            : result.error === 'invalidWindow'
              ? t('errorInvalid')
              : result.error === 'unauthorized'
                ? t('errorUnauthorized')
                : t('errorGeneric')
        );
        return;
      }
      toast.success(t('saved'));
    });
  }

  return (
    <div className="flex flex-wrap items-end gap-4 rounded-lg border p-4">
      <div className="min-w-40 flex-1">
        <p className="font-medium">
          {t(`kinds.${row.kind}`)} &middot; {t(`conditions.${row.condition}`)}
        </p>
        <p className="text-xs text-muted-foreground">
          {t(`hints.${row.kind}_${row.condition}`)}
        </p>
      </div>

      <div className="flex items-center gap-2">
        <Checkbox
          id={`permitted-${row.kind}-${row.condition}`}
          checked={permitted}
          onCheckedChange={(value) => setPermitted(value === true)}
        />
        <Label htmlFor={`permitted-${row.kind}-${row.condition}`} className="text-sm">
          {permitted ? t('permitted') : t('notPermitted')}
        </Label>
      </div>

      {permitted ? (
        <div className="space-y-1.5">
          <Label htmlFor={`days-${row.kind}-${row.condition}`} className="text-xs">
            {t('windowDays')}
          </Label>
          <div className="flex items-center gap-2">
            <Input
              id={`days-${row.kind}-${row.condition}`}
              type="number"
              min={0}
              max={3650}
              value={days}
              onChange={(event) => setDays(event.target.value)}
              className="w-24"
            />
            <span className="text-xs text-muted-foreground">{approx(Number(days), t)}</span>
          </div>
        </div>
      ) : null}

      <Button size="sm" onClick={save} disabled={!dirty || isPending}>
        {isPending ? t('saving') : t('save')}
      </Button>
    </div>
  );
}

/**
 * "90 days" beside "about 3 months", so a Super Admin can recognise the
 * school's stated rule without converting it in their head. Approximate on
 * purpose -- the stored number is the rule, this is only a reading aid.
 */
function approx(days: number, t: ReturnType<typeof useTranslations<'Settings'>>) {
  if (!Number.isFinite(days) || days <= 0) return '';
  if (days >= 60) return t('aboutMonths', { count: Math.round(days / 30) });
  if (days >= 14) return t('aboutWeeks', { count: Math.round(days / 7) });
  return '';
}
