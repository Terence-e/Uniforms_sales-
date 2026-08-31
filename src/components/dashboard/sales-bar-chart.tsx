import { formatMoney } from '@/lib/format';

type Point = { key: string; total: number; count: number };

function niceMax(v: number) {
  if (v <= 0) return 1;
  const pow = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / pow;
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10;
  return step * pow;
}

/**
 * Monthly sales, one orange series. Single series ⇒ no legend (the card title
 * names it); recessive gridlines, rounded bar tops, per-bar hover tooltip.
 */
export function SalesBarChart({
  data,
  locale,
  emptyLabel
}: {
  data: Point[];
  locale: string;
  emptyLabel: string;
}) {
  const maxVal = Math.max(...data.map((d) => d.total), 0);
  const nice = niceMax(maxVal);
  const allZero = maxVal === 0;
  const monthFmt = new Intl.DateTimeFormat(locale, { month: 'short' });
  const compact = new Intl.NumberFormat(locale, {
    notation: 'compact',
    maximumFractionDigits: 1
  });
  const monthLabel = (key: string) => monthFmt.format(new Date(`${key}-01T00:00:00`));
  const grid = [1, 0.75, 0.5, 0.25, 0];

  return (
    <div>
      <div className="relative h-60">
        {grid.map((f) => (
          <div
            key={f}
            className="absolute inset-x-0 flex items-center gap-2"
            style={{ top: `${(1 - f) * 100}%` }}
          >
            <span className="w-11 shrink-0 text-right text-[11px] tabular-nums text-muted-foreground/70">
              {f === 0 ? '0' : compact.format(nice * f)}
            </span>
            <div className="h-px flex-1 bg-border/70" />
          </div>
        ))}

        <div className="absolute inset-0 flex items-end gap-2 pl-[52px]">
          {data.map((d) => {
            const h = allZero ? 0 : (d.total / nice) * 100;
            return (
              <div
                key={d.key}
                className="group relative flex h-full flex-1 flex-col justify-end"
              >
                <div className="pointer-events-none absolute -top-2 left-1/2 z-10 hidden -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-md border bg-popover px-2 py-1 text-center text-xs shadow-md group-hover:block">
                  <p className="font-medium">{monthLabel(d.key)}</p>
                  <p className="text-muted-foreground">
                    {formatMoney(d.total, locale)} · {d.count}
                  </p>
                </div>
                <div
                  className="mx-auto w-full max-w-[26px] rounded-t-md bg-primary/80 transition-colors group-hover:bg-primary"
                  style={{ height: `max(3px, ${h}%)` }}
                />
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-2 flex gap-2 pl-[52px]">
        {data.map((d) => (
          <span
            key={d.key}
            className="flex-1 text-center text-[11px] text-muted-foreground"
          >
            {monthLabel(d.key)}
          </span>
        ))}
      </div>

      {allZero && (
        <p className="mt-3 text-center text-sm text-muted-foreground">{emptyLabel}</p>
      )}
    </div>
  );
}
