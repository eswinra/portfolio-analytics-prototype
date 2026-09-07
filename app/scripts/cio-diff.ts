import { CIO_VINTAGES, longDate, PERIODS, type CioVintage } from '../src/fixtures/cioMonthly';

/** What changed between two CIO Monthly vintages — the analyst's monthly checklist.
 *  Usage: `npm run cio:diff` (latest vs prior) or `npm run cio:diff -- 2026-04-30 2026-05-31`. */

const args = process.argv.slice(2);
const pick = (key: string | undefined, fallback: CioVintage): CioVintage => {
  if (!key) return fallback;
  const v = CIO_VINTAGES.find((x) => x.dataThrough === key);
  if (!v) throw new Error(`no vintage with data through ${key}`);
  return v;
};
const b = pick(args[1], CIO_VINTAGES[CIO_VINTAGES.length - 1]!);
const a = pick(args[0], CIO_VINTAGES[CIO_VINTAGES.length - 2]!);

const f1 = (v: number | null | undefined) => (v === null || v === undefined ? '—' : v.toFixed(1));
const sgn = (v: number, dp = 1) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v).toFixed(dp)}`;
const row = (label: string, x: number | null, y: number | null, unit = '') =>
  console.log(
    `  ${label.padEnd(34)} ${f1(x).padStart(8)} → ${f1(y).padStart(8)}${
      x !== null && y !== null ? `   (${sgn(y - x)}${unit})` : ''
    }`,
  );

console.log(
  `CIO Monthly: ${a.reportLabel} (data through ${longDate(a.dataThrough)}) → ${b.reportLabel} (data through ${longDate(b.dataThrough)})`,
);
for (const key of ['pension', 'opeb'] as const) {
  const x = a.ENT[key];
  const y = b.ENT[key];
  console.log(`\n${y.name}`);
  row('Market value ($M)', x.mv, y.mv);
  row('Cash and equivalents ($M)', x.cash, y.cash);
  for (const [i, p] of PERIODS.entries()) {
    row(`Return ${p} (%)`, x.total.r[i] ?? null, y.total.r[i] ?? null, ' pp');
    row(
      `Excess vs benchmark ${p} (pp)`,
      x.total.r[i] !== null && x.total.b[i] !== null ? x.total.r[i]! - x.total.b[i]! : null,
      y.total.r[i] !== null && y.total.b[i] !== null ? y.total.r[i]! - y.total.b[i]! : null,
      ' pp',
    );
  }
  for (const c of y.comps) {
    const cx = x.comps.find((k) => k.k === c.k);
    row(`${c.short} weight (%)`, cx?.pct ?? null, c.pct, ' pp');
    row(`${c.short} target (%)`, cx?.tgt ?? null, c.tgt, ' pp');
  }
  row('Net rebalancing flow ($M)', x.netflow, y.netflow);
  row('Histogram mean (%)', x.hist.mean, y.hist.mean);
  row('Histogram std dev (%)', x.hist.sd, y.hist.sd);
  row('US share of AUM (%)', x.geo.top[0]?.[1] ?? null, y.geo.top[0]?.[1] ?? null, ' pp');
  const targetsChanged = y.comps.some((c) => x.comps.find((k) => k.k === c.k)?.tgt !== c.tgt);
  if (targetsChanged)
    console.log(
      '  ! SAA targets changed between these reports — check the policy version before comparing drift',
    );
}
console.log(
  `\nMarket table: ${a.MKT ? 'readable' : 'absent'} → ${b.MKT ? 'readable' : 'absent'}${b.marketAsOf ? ` (as of ${longDate(b.marketAsOf)})` : ''}`,
);
console.log(
  'Editorial content (macro strip, items) is hand-maintained in src/fixtures/cioMonthly.data.ts — refresh it for the new report and set EDITORIAL_FOR.',
);
