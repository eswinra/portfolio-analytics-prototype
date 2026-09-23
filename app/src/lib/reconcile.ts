import {
  CIO_VINTAGES,
  longDate,
  PERIODS,
  type CioEntity,
  type CioVintage,
} from '../fixtures/cioMonthly';
import { fiscalYearOf } from './cioNarrative';
import { monthsBetween } from './compare';

/** Reconciliation for a monthly report, from the arithmetic of returns — no threshold chosen by
 *  eye. Used by the Monthly run on a template file before its figures reach the dashboard.
 *
 *  Three checks, each against something the file does not control:
 *
 *  1. Within the report. Some periods are the same period: FYTD in July is the month itself, YTD
 *     in January is the month itself, and FYTD in June is the year. Those pairs are the same
 *     number printed twice, so they must be equal.
 *  2. Against the reports before it. Returns compound: this report's FYTD is last report's FYTD
 *     compounded with this month's return (within one fiscal year), YTD likewise within one
 *     calendar year, and three months is the last three one-month returns compounded. The only
 *     slack is rounding — every figure is printed to one decimal, so each can be off by 0.05 pp —
 *     and the tolerance is exactly that: 0.05 pp for each printed figure in the check.
 *  3. Against the published report for the same month, when there is one: every figure the file
 *     carries is compared with the report's own.
 *
 *  Across the sixteen published reports the chains hold within 0.13 pp in all 260 cases (fund,
 *  composites, returns and benchmarks) and the same-period pairs are equal in all 80: a check
 *  outside its tolerance is a keying error, or a restatement of earlier months that the report
 *  should footnote. It is listed to be looked at, never corrected. */

export const ROUNDING_PER_FIGURE = 0.05;
const EPS = 1e-9;

export type Fund = 'pension' | 'opeb';
const FUNDS: Fund[] = ['pension', 'opeb'];
const I = (p: string) => PERIODS.indexOf(p);

export interface Check {
  id: string;
  fund: Fund;
  /** "Total Fund" or the composite's name */
  line: string;
  series: 'return' | 'benchmark';
  rule: string;
  /** the figures the check used, in words */
  inputs: string;
  expected: number;
  actual: number;
  /** actual − expected, percentage points */
  diff: number;
  tolerance: number;
  ok: boolean;
}

export interface TieDiff {
  id: string;
  label: string;
  file: number | null;
  published: number | null;
  unit: '%' | '$M' | '$B' | 'months' | '';
}

export interface Reconciliation {
  /** pairs of periods that are the same period in this report */
  within: { checked: number; failed: Check[] };
  /** chains from the published reports before it */
  chained: {
    prior: CioVintage | null;
    checked: number;
    failed: Check[];
    /** why nothing, or not everything, could be chained */
    note?: string;
  };
  /** the published report for the same month */
  tieOut: {
    published: CioVintage | null;
    compared: number;
    differences: TieDiff[];
    note?: string;
  };
}

const pct = (v: number) => `${v < 0 ? '−' : ''}${Math.abs(v).toFixed(1)}%`;
const chain = (...rs: number[]) => (rs.reduce((acc, r) => acc * (1 + r / 100), 1) - 1) * 100;

interface Line {
  key: string;
  name: string;
  r: (number | null)[];
  b: (number | null)[];
}

function linesOf(e: CioEntity): Line[] {
  return [
    { key: 'total', name: 'Total Fund', r: e.total.r, b: e.total.b },
    ...e.comps.map((c) => ({ key: c.k, name: c.n, r: c.r, b: c.b })),
  ];
}

const has = (v: number | null | undefined): v is number =>
  v !== null && v !== undefined && Number.isFinite(v);

function check(
  o: Omit<Check, 'diff' | 'ok' | 'expected' | 'actual'> & { expected: number; actual: number },
): Check {
  const diff = o.actual - o.expected;
  return { ...o, diff, ok: Math.abs(diff) <= o.tolerance + EPS };
}

/** 1. Periods that are the same period in this report. */
export function withinReport(v: CioVintage): { checked: number; failed: Check[] } {
  const month = v.dataThrough.slice(5, 7);
  const pairs: [string, string, string][] = [];
  if (month === '07') pairs.push(['FYTD', '1 M', 'In July, fiscal year to date is the month']);
  if (month === '01') pairs.push(['YTD', '1 M', 'In January, year to date is the month']);
  if (month === '06') pairs.push(['FYTD', '1 Y', 'In June, fiscal year to date is the year']);
  const all: Check[] = [];
  for (const fund of FUNDS) {
    for (const line of linesOf(v.ENT[fund])) {
      for (const series of ['return', 'benchmark'] as const) {
        const xs = series === 'return' ? line.r : line.b;
        for (const [a, b, rule] of pairs) {
          const x = xs[I(a)];
          const y = xs[I(b)];
          if (!has(x) || !has(y)) continue;
          all.push(
            check({
              id: `within:${fund}:${line.key}:${series}:${a}`,
              fund,
              line: line.name,
              series,
              rule,
              inputs: `${a} ${pct(x)} and ${b} ${pct(y)}`,
              expected: y,
              actual: x,
              // the same number printed twice: no rounding between them
              tolerance: 0,
            }),
          );
        }
      }
    }
  }
  return { checked: all.length, failed: all.filter((c) => !c.ok) };
}

/** The published report with data through the month before `iso`, if the series has one. */
function publishedMonthBefore(iso: string, months: number): CioVintage | null {
  return (
    CIO_VINTAGES.find((x) => x.origin !== 'file' && monthsBetween(x.dataThrough, iso) === months) ??
    null
  );
}

/** 2. Chains from the published reports before this one. */
export function chainedFromPrior(v: CioVintage): Reconciliation['chained'] {
  const prior = publishedMonthBefore(v.dataThrough, 1);
  const before = publishedMonthBefore(v.dataThrough, 2);
  if (!prior) {
    const earlier = CIO_VINTAGES.filter((x) => x.dataThrough < v.dataThrough).at(-1);
    return {
      prior: null,
      checked: 0,
      failed: [],
      note: earlier
        ? `No published report has data through the month before (the latest earlier one runs to ${longDate(earlier.dataThrough)}), so nothing can be chained.`
        : 'There is no earlier published report to chain from.',
    };
  }
  const sameFy = fiscalYearOf(prior.dataThrough) === fiscalYearOf(v.dataThrough);
  const sameYear = prior.dataThrough.slice(0, 4) === v.dataThrough.slice(0, 4);
  const all: Check[] = [];
  for (const fund of FUNDS) {
    const prevLines = linesOf(prior.ENT[fund]);
    const beforeLines = before ? linesOf(before.ENT[fund]) : [];
    for (const line of linesOf(v.ENT[fund])) {
      const pl = prevLines.find((x) => x.key === line.key);
      const bl = beforeLines.find((x) => x.key === line.key);
      if (!pl) continue;
      for (const series of ['return', 'benchmark'] as const) {
        const cur = series === 'return' ? line.r : line.b;
        const prv = series === 'return' ? pl.r : pl.b;
        const m1 = cur[I('1 M')];
        if (!has(m1)) continue;
        for (const [period, same, word] of [
          ['FYTD', sameFy, 'fiscal year'],
          ['YTD', sameYear, 'calendar year'],
        ] as const) {
          const now = cur[I(period)];
          const was = prv[I(period)];
          if (!same || !has(now) || !has(was)) continue;
          all.push(
            check({
              id: `chain:${fund}:${line.key}:${series}:${period}`,
              fund,
              line: line.name,
              series,
              rule: `${period} compounds from the prior report's ${period} and this month (same ${word})`,
              inputs: `${pct(was)} (${prior.reportLabel} report) with this month's ${pct(m1)}`,
              expected: chain(was, m1),
              actual: now,
              tolerance: 3 * ROUNDING_PER_FIGURE,
            }),
          );
        }
        // three months: the last three one-month returns, from three reports
        const m3 = cur[I('3 M')];
        const bset = bl ? (series === 'return' ? bl.r : bl.b) : null;
        const a = bset?.[I('1 M')];
        const b = prv[I('1 M')];
        if (before && has(m3) && has(a) && has(b)) {
          all.push(
            check({
              id: `chain:${fund}:${line.key}:${series}:3M`,
              fund,
              line: line.name,
              series,
              rule: 'Three months compounds the last three one-month returns',
              inputs: `${pct(a)} (${before.reportLabel}), ${pct(b)} (${prior.reportLabel}) and ${pct(m1)}`,
              expected: chain(a, b, m1),
              actual: m3,
              tolerance: 4 * ROUNDING_PER_FIGURE,
            }),
          );
        }
      }
    }
  }
  const notes = [
    sameFy ? '' : 'FYTD restarted in July, so it is not chained across the new fiscal year.',
    sameYear ? '' : 'YTD restarted in January, so it is not chained across the new year.',
    before ? '' : 'Three-month returns need the report two months back, which the series lacks.',
  ].filter(Boolean);
  return {
    prior,
    checked: all.length,
    failed: all.filter((c) => !c.ok),
    ...(notes.length ? { note: notes.join(' ') } : {}),
  };
}

/** 3. Every figure the file carries against the published report for the same month. */
export function tieOut(v: CioVintage): Reconciliation['tieOut'] {
  const published = CIO_VINTAGES.find(
    (x) => x.origin !== 'file' && x.dataThrough === v.dataThrough && x !== v,
  );
  if (!published) {
    return {
      published: null,
      compared: 0,
      differences: [],
      note: `No report with data through ${longDate(v.dataThrough)} is published yet, so there is nothing to tie out to; the chains from the earlier reports are the independent check.`,
    };
  }
  const pairs: TieDiff[] = [];
  const add = (
    id: string,
    label: string,
    file: number | null | undefined,
    pub: number | null | undefined,
    unit: TieDiff['unit'],
  ) => pairs.push({ id, label, file: file ?? null, published: pub ?? null, unit });

  for (const fund of FUNDS) {
    const f = v.ENT[fund];
    const p = published.ENT[fund];
    const who = p.short;
    add(`${fund}:aum`, `${who} · market value`, f.aum, p.aum, '$B');
    add(`${fund}:mv`, `${who} · market value`, f.mv, p.mv, '$M');
    add(`${fund}:cash`, `${who} · cash and equivalents`, f.cash, p.cash, '$M');
    PERIODS.forEach((per, i) => {
      add(`${fund}:r:${per}`, `${who} · return ${per}`, f.total.r[i], p.total.r[i], '%');
      add(`${fund}:b:${per}`, `${who} · benchmark ${per}`, f.total.b[i], p.total.b[i], '%');
      add(`${fund}:h:${per}`, `${who} · actuarial hurdle ${per}`, f.total.h[i], p.total.h[i], '%');
    });
    for (const pc of p.comps) {
      const fc = f.comps.find((x) => x.k === pc.k);
      add(`${fund}:${pc.k}:mv`, `${who} · ${pc.n} market value`, fc?.mv, pc.mv, '$M');
      add(`${fund}:${pc.k}:pct`, `${who} · ${pc.n} weight`, fc?.pct, pc.pct, '%');
      add(`${fund}:${pc.k}:tgt`, `${who} · ${pc.n} target`, fc?.tgt, pc.tgt, '%');
      PERIODS.forEach((per, i) => {
        add(`${fund}:${pc.k}:r:${per}`, `${who} · ${pc.n} return ${per}`, fc?.r[i], pc.r[i], '%');
        add(
          `${fund}:${pc.k}:b:${per}`,
          `${who} · ${pc.n} benchmark ${per}`,
          fc?.b[i],
          pc.b[i],
          '%',
        );
      });
    }
    add(`${fund}:dm`, `${who} · developed markets`, f.geo.dm, p.geo.dm, '%');
    add(`${fund}:em`, `${who} · emerging markets`, f.geo.em, p.geo.em, '%');
    if (p.hist) {
      p.hist.c.forEach((n, j) =>
        add(
          `${fund}:bin:${j}`,
          `${who} · months in return bin ${j + 1}`,
          f.hist?.c[j],
          n,
          'months',
        ),
      );
    }
  }
  const differences = pairs.filter(
    (d) =>
      (d.file === null) !== (d.published === null) ||
      (d.file !== null && d.published !== null && Math.abs(d.file - d.published) > EPS),
  );
  return { published, compared: pairs.length, differences };
}

export function reconcile(v: CioVintage): Reconciliation {
  return { within: withinReport(v), chained: chainedFromPrior(v), tieOut: tieOut(v) };
}
