'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { PackageCheck } from 'lucide-react';
import { useRouter } from '@/i18n/navigation';
import { collectOrderLines } from '@/actions/orders';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { formatMoney } from '@/lib/format';

/**
 * Records a collection (A-FR-9.7, A-FR-9.8).
 *
 * Only Ready lines appear: a garment still in production has not been made, and
 * one already collected has left. Collection is per line and per visit, so the
 * seller ticks what the parent is actually taking today -- the rest stay Ready
 * and get their own slip when they are picked up.
 *
 * The panel disappears entirely once nothing is Ready, rather than sitting there
 * disabled: an order with nothing to hand over should not show a hand-over form.
 */

export type CollectableLine = {
  id: string;
  description: string;
  size: string | null;
  quantity: number;
  line_total: number;
};

type Props = {
  orderId: string;
  lines: CollectableLine[];
  staff: { id: string; full_name: string }[];
  currentUserId: string;
  locale: string;
};

export function CollectionPanel({
  orderId,
  lines,
  staff,
  currentUserId,
  locale
}: Props) {
  const t = useTranslations('Orders');
  const tv = useTranslations('Validation');
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Everything ready is pre-ticked: the common case is the parent taking all of
  // it, and unticking one is less work than ticking three.
  const [selected, setSelected] = useState<string[]>(() => lines.map((l) => l.id));
  const [collectorName, setCollectorName] = useState('');
  const [handedOverBy, setHandedOverBy] = useState(currentUserId);
  const [nameError, setNameError] = useState<string | null>(null);

  if (lines.length === 0) return null;

  function toggle(id: string, checked: boolean) {
    setSelected((current) =>
      checked ? [...current, id] : current.filter((value) => value !== id)
    );
  }

  function submit() {
    if (collectorName.trim().length < 2) {
      setNameError(tv('required'));
      return;
    }
    setNameError(null);

    if (selected.length === 0) {
      toast.error(t('selectLinesToCollect'));
      return;
    }

    startTransition(async () => {
      const result = await collectOrderLines({
        orderId,
        lineIds: selected,
        collectorName,
        handedOverBy
      });

      if (!result.ok) {
        toast.error(result.error === 'validation' ? tv('required') : result.error);
        return;
      }

      toast.success(t('collectionRecorded'));
      // Straight to the slip: the parent is standing there waiting for it.
      router.push(`/collections/${result.collectionId}`);
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t('collectTitle')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">{t('collectHint')}</p>

        <div className="space-y-2">
          {lines.map((line) => (
            <div key={line.id} className="flex items-center gap-3 rounded-lg border p-3">
              <Checkbox
                id={`collect-${line.id}`}
                checked={selected.includes(line.id)}
                onCheckedChange={(checked) => toggle(line.id, checked === true)}
              />
              <Label htmlFor={`collect-${line.id}`} className="flex-1 font-normal">
                {line.description}
                {line.size ? (
                  <span className="text-muted-foreground"> ({line.size})</span>
                ) : null}
                <span className="text-muted-foreground">
                  {' '}
                  × {line.quantity} — {formatMoney(line.line_total, locale)}
                </span>
              </Label>
            </div>
          ))}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="collector-name">{t('collectorName')}</Label>
            <Input
              id="collector-name"
              value={collectorName}
              onChange={(event) => setCollectorName(event.target.value)}
              placeholder={t('collectorNameHint')}
              aria-invalid={Boolean(nameError)}
            />
            {nameError ? <p className="text-sm text-destructive">{nameError}</p> : null}
          </div>

          <div className="space-y-2">
            <Label>{t('handedOverBy')}</Label>
            <Select value={handedOverBy} onValueChange={setHandedOverBy}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {staff.map((person) => (
                  <SelectItem key={person.id} value={person.id}>
                    {person.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Said plainly, because this is the moment the numbers change and the
            seller should know it is happening. */}
        <p className="text-xs text-muted-foreground">{t('collectStockNotice')}</p>

        <Button onClick={submit} disabled={isPending} size="lg">
          <PackageCheck className="size-4" />
          {isPending ? t('collecting') : t('confirmCollection')}
        </Button>
      </CardContent>
    </Card>
  );
}
