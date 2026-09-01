import { getTranslations } from 'next-intl/server';
import type { ReportCell, ReportColumnType, ReportResult, ReportStamp } from '@/lib/report-types';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import { formatDate, formatDateTime, formatMoney } from '@/lib/format';

const RIGHT: ReportColumnType[] = ['money', 'number'];

function formatCell(cell: ReportCell, type: ReportColumnType, locale: string): string {
  if (cell === null || cell === '') return '';
  if (type === 'money') return formatMoney(Number(cell), locale);
  // Date columns can carry a label instead of a date in the totals row (e.g.
  // "Total", "Avg (days)"). Only format genuine dates; pass anything else
  // through as text so a summary row never crashes the table.
  if (type === 'date' || type === 'datetime') {
    const parsed = new Date(String(cell));
    if (Number.isNaN(parsed.getTime())) return String(cell);
    return type === 'date' ? formatDate(parsed, locale) : formatDateTime(parsed, locale);
  }
  return String(cell);
}

/**
 * Renders any report as a stamped table. The stamp (period + who + when) is part
 * of the printed output on purpose (A-FR-12.5) -- the print-to-PDF captures this
 * whole block. Used on-screen and as the print target; the page's print CSS
 * hides everything else.
 */
export async function ReportView({
  result,
  stamp,
  locale
}: {
  result: ReportResult;
  stamp: ReportStamp;
  locale: string;
}) {
  const t = await getTranslations('Reports');

  return (
    <div className="report-print-area space-y-4">
      <header className="space-y-0.5">
        <h3 className="text-lg font-semibold tracking-tight">{result.title}</h3>
        <p className="text-sm text-muted-foreground">
          {t('suite.period', { from: stamp.from, to: stamp.to })}
        </p>
        <p className="text-xs text-muted-foreground">
          {t('suite.stamp', { name: stamp.generatedBy, at: stamp.generatedAt })}
        </p>
      </header>

      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              {result.columns.map((col) => (
                <TableHead key={col.key} className={RIGHT.includes(col.type) ? 'text-right' : ''}>
                  {col.label}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {result.rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={result.columns.length}
                  className="py-8 text-center text-muted-foreground"
                >
                  {t('suite.none')}
                </TableCell>
              </TableRow>
            ) : (
              result.rows.map((row, i) => (
                <TableRow key={i}>
                  {result.columns.map((col) => (
                    <TableCell
                      key={col.key}
                      className={
                        RIGHT.includes(col.type) ? 'text-right tabular-nums' : ''
                      }
                    >
                      {formatCell(row[col.key], col.type, locale)}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
            {result.totals ? (
              <TableRow className="border-t-2 font-semibold">
                {result.columns.map((col) => (
                  <TableCell
                    key={col.key}
                    className={RIGHT.includes(col.type) ? 'text-right tabular-nums' : ''}
                  >
                    {formatCell(result.totals![col.key], col.type, locale)}
                  </TableCell>
                ))}
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
