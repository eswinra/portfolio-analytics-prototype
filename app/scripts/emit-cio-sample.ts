import { writeFileSync } from 'node:fs';

import { CIO_LATEST, type CioEntity } from '../src/fixtures/cioMonthly';
import { CIO_PERIOD_TOKENS } from '../src/lib/contract/schema';

/** Writes data/sample/cio_monthly_feed_demofund.csv — the latest public CIO Monthly vintage
 *  re-expressed as schema 1.4 `cio_monthly` contract rows for the DEMOFUND workspace, so the
 *  Workstation → CIO Monthly feed can be demonstrated with an import. Every row is
 *  reported_public and cites the report page; a workbook-produced feed would carry the same
 *  rows classified calculated. Run: `npm run emit:cio-sample`. */

const v = CIO_LATEST;
const e: CioEntity = v.ENT.pension;
const ENTITY = 'DEMOFUND';
const SOURCE = v.file;
const RETRIEVED = '2026-09-07';
const SCHEMA = '1.4.0';
const asOf = v.dataThrough;

const COLS = [
  'record_id',
  'record_type',
  'entity_id',
  'metric_id',
  'category_id',
  'value',
  'unit',
  'currency',
  'scale',
  'as_of_date',
  'period_start',
  'period_end',
  'period_type',
  'frequency',
  'classification',
  'source_type',
  'source_name',
  'page_table',
  'provider',
  'retrieved_date',
  'book_of_record',
  'return_method',
  'gross_net',
  'valuation_status',
  'benchmark_id',
  'method_id',
  'quality_status',
  'note',
  'schema_version',
  'entered_by',
  'reviewed_by',
  'review_status',
];

/** period_start for a trailing period ending at the as-of month end (fiscal year starts July 1) */
function periodStart(token: string, end: string): string {
  const y = Number(end.slice(0, 4));
  const m = Number(end.slice(5, 7));
  const first = (yy: number, mm: number) => `${yy}-${String(mm).padStart(2, '0')}-01`;
  const back = (months: number) => {
    const idx = y * 12 + (m - 1) - (months - 1);
    return first(Math.floor(idx / 12), (idx % 12) + 1);
  };
  switch (token) {
    case '1M':
      return back(1);
    case '3M':
      return back(3);
    case 'YTD':
      return first(y, 1);
    case 'FYTD':
      return m >= 7 ? first(y, 7) : first(y - 1, 7);
    case '1Y':
      return back(12);
    case '3Y':
      return back(36);
    case '5Y':
      return back(60);
    case '10Y':
      return back(120);
    default:
      return '';
  }
}

let n = 0;
const rows: string[][] = [];
function row(
  metric: string,
  category: string,
  value: number | null,
  unit: string,
  scale: string,
  period: string,
  page: string,
  note: string,
  extra: Partial<Record<string, string>> = {},
) {
  if (value === null) return;
  n += 1;
  const base: Record<string, string> = {
    record_id: `CIO-${String(n).padStart(4, '0')}`,
    record_type: 'cio_monthly',
    entity_id: ENTITY,
    metric_id: metric,
    category_id: category,
    value: String(value),
    unit,
    currency: 'USD',
    scale,
    as_of_date: asOf,
    period_start: period ? periodStart(period, asOf) : '',
    period_end: period ? asOf : '',
    period_type: period,
    frequency: 'Monthly',
    classification: 'reported_public',
    source_type: 'public_report',
    source_name: SOURCE,
    page_table: page,
    provider: 'LACERA',
    retrieved_date: RETRIEVED,
    book_of_record: 'n/a',
    return_method: 'n/a',
    gross_net: 'n/a',
    valuation_status: 'final',
    benchmark_id: '',
    method_id: '',
    quality_status: 'ok',
    note,
    schema_version: SCHEMA,
    entered_by: 'PA-ANALYST-1',
    reviewed_by: 'PA-LEAD-1',
    review_status: 'published',
    ...extra,
  };
  rows.push(COLS.map((c) => base[c] ?? ''));
}

const dec = (pct: number | null) => (pct === null ? null : Math.round(pct * 1000) / 100000);
const pages = e.pages;
const NOTE = 'public figures re-expressed in the contract for the feed demonstration';
const CATS: [string, CioEntity['comps'][number] | null][] = [
  ['GROWTH', e.comps[0]!],
  ['CREDIT', e.comps[1]!],
  ['RAIH', e.comps[2]!],
  ['RRM', e.comps[3]!],
];

CIO_PERIOD_TOKENS.forEach((p, i) => {
  row('return', 'TOTAL', dec(e.total.r[i] ?? null), '%', '1', p, pages, NOTE, {
    return_method: 'TWR',
    gross_net: 'net',
    book_of_record: 'IBOR',
  });
  row('benchmark_return', 'TOTAL', dec(e.total.b[i] ?? null), '%', '1', p, pages, NOTE, {
    benchmark_id: 'BM-TOTAL',
    return_method: 'TWR',
    gross_net: 'net',
  });
  row('hurdle_return', 'TOTAL', dec(e.total.h[i] ?? null), '%', '1', p, pages, NOTE);
  for (const [cat, c] of CATS) {
    row('return', cat, dec(c!.r[i] ?? null), '%', '1', p, pages, NOTE, {
      return_method: 'TWR',
      gross_net: 'net',
      book_of_record: 'IBOR',
    });
    row('benchmark_return', cat, dec(c!.b[i] ?? null), '%', '1', p, pages, NOTE, {
      benchmark_id: `BM-${cat}`,
      return_method: 'TWR',
      gross_net: 'net',
    });
  }
});
row('market_value', 'TOTAL', e.mv, 'USD', '1000000', '', pages, NOTE, { book_of_record: 'IBOR' });
row('cash', 'TOTAL', e.cash, 'USD', '1000000', '', pages, NOTE);
for (const [cat, c] of CATS) {
  row('market_value', cat, c!.mv, 'USD', '1000000', '', pages, NOTE, { book_of_record: 'IBOR' });
  row('weight', cat, dec(c!.pct), '%', '1', '', pages, NOTE);
  row('target_weight', cat, dec(c!.tgt), '%', '1', '', pages, '2024 SAA target as printed');
  row(
    'flow',
    cat,
    c!.flow,
    'USD',
    '1000000',
    '',
    `p. ${v.pages.flows}`,
    'monthly rebalancing activity as printed',
  );
}
if (e.other) {
  row(
    'market_value',
    'OTHER',
    e.other.mv,
    'USD',
    '1000000',
    '',
    pages,
    `${e.other.n}; no policy target`,
    { book_of_record: 'IBOR' },
  );
  row('weight', 'OTHER', dec(e.other.pct), '%', '1', '', pages, e.other.n);
  row('flow', 'OTHER', e.other.flow, 'USD', '1000000', '', `p. ${v.pages.flows}`, e.other.n);
}
e.hist.c.forEach((count, i) =>
  row(
    'hist_count',
    `BIN_${String(i).padStart(2, '0')}`,
    count,
    'count',
    '1',
    '',
    pages,
    'months in bin, last 120 months',
  ),
);
row('hist_stat', 'MEAN', dec(e.hist.mean), '%', '1', '', pages, 'mean monthly return');
row('hist_stat', 'SAA', dec(e.hist.saa), '%', '1', '', pages, '2024 SAA expected monthly return');
row(
  'hist_stat',
  'SD',
  dec(e.hist.sd),
  '%',
  '1',
  '',
  pages,
  'standard deviation of monthly returns',
);
row('hist_stat', 'MIN', dec(e.hist.min), '%', '1', '', pages, 'minimum monthly return');
row('hist_stat', 'MAX', dec(e.hist.max), '%', '1', '', pages, 'maximum monthly return');
row('hist_stat', 'LATEST', dec(e.hist.latest), '%', '1', '', pages, 'latest monthly return');

const csv = (cell: string) => (/[",\n]/.test(cell) ? `"${cell.replaceAll('"', '""')}"` : cell);
const out = new URL('../../data/sample/cio_monthly_feed_demofund.csv', import.meta.url);
writeFileSync(out, [COLS, ...rows].map((r) => r.map(csv).join(',')).join('\n') + '\n');
console.log(`wrote ${rows.length} cio_monthly rows for ${ENTITY}, as of ${asOf}, from ${SOURCE}`);
