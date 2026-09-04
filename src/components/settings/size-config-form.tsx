'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { updateSizeConfig } from '@/actions/size-config';
import { expandSizes, type SizeConfig } from '@/lib/sizes';
import type { SizeMode } from '@/types/database.types';

/**
 * The size set (A-FR-4.2): the Super Admin picks letters or numbers and the
 * result is what shows as boxes at the counter. A live preview renders the exact
 * set that will appear, because "20 to 46 by 2" is easy to get subtly wrong and
 * the mistake only shows when a seller cannot find a size mid-sale.
 */
export function SizeConfigForm({ config }: { config: SizeConfig }) {
  const t = useTranslations('Settings');
  const [isPending, startTransition] = useTransition();

  const [mode, setMode] = useState<SizeMode>(config.mode);
  const [letters, setLetters] = useState(config.letters.join(', '));
  const [min, setMin] = useState(String(config.metricMin));
  const [max, setMax] = useState(String(config.metricMax));
  const [step, setStep] = useState(String(config.metricStep));

  const parsedLetters = letters
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  const preview =
    mode === 'letters'
      ? expandSizes({ mode, letters: parsedLetters, metricMin: 0, metricMax: 0, metricStep: 1 })
      : expandSizes({
          mode,
          letters: [],
          metricMin: Number(min) || 0,
          metricMax: Number(max) || 0,
          metricStep: Number(step) || 1
        });

  function save() {
    startTransition(async () => {
      const res = await updateSizeConfig({
        mode,
        letters: parsedLetters,
        metricMin: Number(min),
        metricMax: Number(max),
        metricStep: Number(step)
      });
      if (!res.ok) {
        toast.error(sizeError(res.error, t));
        return;
      }
      toast.success(t('saved'));
    });
  }

  return (
    <div className="space-y-4">
      {/* Mode toggle */}
      <div>
        <Label className="text-xs">{t('sizeMode')}</Label>
        <div
          className="mt-1.5 inline-flex overflow-hidden rounded-md border"
          role="group"
          aria-label={t('sizeMode')}
        >
          {(['metrics', 'letters'] as SizeMode[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              aria-pressed={mode === m}
              className={
                mode === m
                  ? 'bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground'
                  : 'px-3 py-1.5 text-sm font-medium hover:bg-muted'
              }
            >
              {m === 'metrics' ? t('modeMetrics') : t('modeLetters')}
            </button>
          ))}
        </div>
      </div>

      {mode === 'letters' ? (
        <div className="space-y-1.5">
          <Label htmlFor="size-letters" className="text-xs">
            {t('lettersLabel')}
          </Label>
          <Input
            id="size-letters"
            value={letters}
            onChange={(e) => setLetters(e.target.value)}
            placeholder="S, M, L, XL"
          />
          <p className="text-xs text-muted-foreground">{t('lettersHint')}</p>
        </div>
      ) : (
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="size-min" className="text-xs">
              {t('minLabel')}
            </Label>
            <Input
              id="size-min"
              type="number"
              min={0}
              value={min}
              onChange={(e) => setMin(e.target.value)}
              className="w-24"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="size-max" className="text-xs">
              {t('maxLabel')}
            </Label>
            <Input
              id="size-max"
              type="number"
              min={0}
              value={max}
              onChange={(e) => setMax(e.target.value)}
              className="w-24"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="size-step" className="text-xs">
              {t('stepLabel')}
            </Label>
            <Input
              id="size-step"
              type="number"
              min={1}
              value={step}
              onChange={(e) => setStep(e.target.value)}
              className="w-20"
            />
          </div>
        </div>
      )}

      {/* Live preview of the exact boxes the counter will show. */}
      <div className="space-y-1.5">
        <Label className="text-xs">{t('preview')}</Label>
        {preview.length === 0 ? (
          <p className="text-xs text-muted-foreground">{t('noSizes')}</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {preview.map((s) => (
              <span
                key={s}
                className="rounded-md border bg-muted/50 px-2 py-1 text-xs font-medium tabular-nums"
              >
                {s}
              </span>
            ))}
          </div>
        )}
      </div>

      <Button size="sm" onClick={save} disabled={isPending || preview.length === 0}>
        {isPending ? t('saving') : t('save')}
      </Button>
    </div>
  );
}

function sizeError(code: string, t: ReturnType<typeof useTranslations<'Settings'>>) {
  switch (code) {
    case 'lettersEmpty':
      return t('sizeErrLettersEmpty');
    case 'metricRange':
      return t('sizeErrRange');
    case 'metricStep':
      return t('sizeErrStep');
    case 'metricTooMany':
    case 'lettersTooMany':
      return t('sizeErrTooMany');
    case 'unauthorized':
      return t('errorUnauthorized');
    default:
      return t('errorGeneric');
  }
}
