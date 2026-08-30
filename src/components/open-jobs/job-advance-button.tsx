'use client';

import { useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { ArrowRight, PackageCheck } from 'lucide-react';
import { Link, useRouter } from '@/i18n/navigation';
import { advanceOrderLine } from '@/actions/orders';
import { advanceAlteration } from '@/actions/alterations';
import { Button } from '@/components/ui/button';
import { nextStatus as nextOrderStatus } from '@/lib/order-status';
import { nextStatus as nextAlterationStatus } from '@/lib/alteration-status';
import type { OpenJob } from '@/lib/open-jobs';
import type { AlterationStatus, OrderStatus } from '@/types/database.types';

/**
 * Moving a job forward without leaving the board (A-FR-9.21).
 *
 * Forward only. Going back needs a written reason, and a reason needs a dialog
 * -- that stays on the detail pages, where there is room to read what was
 * already recorded before overwriting it.
 *
 * The one exception is an order line reaching `collected`. That is not a status
 * change but a handover: it needs a COL slip, a named collector, and the stock
 * deduction, all in one transaction (A-FR-9.7). The database would happily
 * accept the bare status move, which is exactly the danger -- the line would go
 * green, no slip would exist, and stock would silently never be deducted. So
 * this button navigates to the collection panel instead of performing it: still
 * one tap from the card, but the slip and the stock movement still happen.
 */
export function JobAdvanceButton({ job }: { job: OpenJob }) {
  const t = useTranslations('OpenJobs');
  const tOrders = useTranslations('Orders');
  const tAlt = useTranslations('Alterations');
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const target =
    job.kind === 'order'
      ? nextOrderStatus(job.statusLabel as OrderStatus)
      : nextAlterationStatus(job.statusLabel as AlterationStatus);

  if (!target) return null;

  // An order line's last step is the collection flow, not a status tap.
  if (job.kind === 'order' && target === 'collected') {
    return (
      <Button asChild size="sm" variant="outline" className="w-full">
        <Link href={job.href}>
          <PackageCheck className="size-3.5" />
          {t('goToCollection')}
        </Link>
      </Button>
    );
  }

  const label =
    job.kind === 'order'
      ? tOrders(`status.${target}`)
      : tAlt(`status.${target}`);

  function advance() {
    startTransition(async () => {
      const result =
        job.kind === 'order'
          ? await advanceOrderLine({ lineId: job.id })
          : await advanceAlteration({ alterationId: job.id });

      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(t('moved', { status: label }));
      // Refresh rather than navigate: the seller is working down a list, and
      // sending them elsewhere after every tap would lose their place.
      router.refresh();
    });
  }

  return (
    <Button
      size="sm"
      variant="outline"
      className="w-full"
      disabled={isPending}
      onClick={advance}
    >
      <ArrowRight className="size-3.5" />
      {t('markAs', { status: label })}
    </Button>
  );
}
