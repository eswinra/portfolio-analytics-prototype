import { CIO_VINTAGES, PERIODS, type CioEntity, type CioVintage } from '../fixtures/cioMonthly';

import { fiscalYearOf } from './cioNarrative';

/** Two reports side by side.
 *
 *  A comparison is only as honest as its rules about what is comparable, and three things make
 *  most report-to-report diffs quietly wrong:
 *
 *  1. Period-to-date figures reset. FYTD runs from July and YTD from January, so an FYTD from a
 *     June report (twelve months) and one from a July report (one month) measure different things.
 *     Across a reset they are not compared at all; within one year the later figure contains the
 *     earlier one, and the note says so.
 *  2. Trailing windows overlap. Three-year returns from two reports a year apart share 24 of their
 *     36 months, so the change is how the trailing figure moved — not a year of new performance.
 *     Every overlapping row says by how much.
 *  3. A change in market value is not a return. It includes contributions and benefit payments.
 *
 *  Plus the rule the existing "what changed" panel already keeps: a composite whose policy target
 *  moved has no comparable drift, because the two weights are measured against different policies.
 *
 *  Reports are always put in date order — earlier, then later — and every change is later minus
 *  earlier, whichever report the reader picked first. A change column whose sign depended on the
 *  order of two dropdowns would be a trap of its own. */

export type Entity = 'pension' | 'opeb';

export interface CompareLine {
  key: string;
  label: string;
  earlier: number | null;
  later: number | null;
  /** later minus earlier; null when either side is missing or the two are not comparable */
  change: number | null;
  comparable: boolean;
  /** past a threshold the site already uses elsewhere; never judged without one */
  material: boolean;
  /** why a row is not comparable, how much two windows overlap, or a policy change */
  note?: string;
  unit: 'bn' | 'mm' | 'pct' | 'usd';
}

export interface Comparison {
  earlier: CioVintage;
  later: CioVintage;
  entity: Entity;
  /** whole months between the two reports' data-through dates */
  gapMonths: number;
  fyReset: boolean;
  yearReset: boolean;
  fund: CompareLine[];
  returns: CompareLine[];
  excess: CompareLine[];
  allocation: CompareLine[];
  geography: CompareLine[];
}

/** The thresholds the "what changed" panel already applies; nothing here invents a new one. */
export const MATERIAL = {
  /** $ billions of market value */
  mvBn: 0.05,
  /** percentage points of return */
  returnPp: 0.1,
  /** percentage points of weight */
  weightPp: 0.5,
  /** percentage points of policy target — any real change */
  targetPp: 0.05,
} as const;

/** The return periods the "What changed" panel judges against the threshold — the decision
 *  periods. The others are shown with their change but never marked. */
export const JUDGED_PERIODS: ReadonlySet<string> = new Set(['FYTD', '1 Y']);

/** Length of each reported period in months; null for the period-to-date figures, which reset. */
export const PERIOD_MONTHS: Record<string, number | null> = {
  '1 M': 1,
  '3 M': 3,
  FYTD: null,
  YTD: null,
  '1 Y': 12,
  '3 Y': 36,
  '5 Y': 60,
  '10 Y': 120,
};

export function monthsBetween(from: string, to: string): number {
  const [fy, fm] = [Number(from.slice(0, 4)), Number(from.slice(5, 7))];
  const [ty, tm] = [Number(to.slice(0, 4)), Number(to.slice(5, 7))];
  return (ty - fy) * 12 + (tm - fm);
}

/** Months two trailing windows of the same length share, when they end `gap` months apart. */
export function windowOverlap(windowMonths: number, gapMonths: number): number {
  return Math.max(0, windowMonths - Math.abs(gapMonths));
}

function present(v: number | null | undefined): v is number {
  return v !== null && v !== undefined && Number.isFinite(v);
}

function line(
  key: string,
  label: string,
  earlier: number | null | undefined,
  later: number | null | undefined,
  unit: CompareLine['unit'],
  opts: { threshold?: number; comparable?: boolean; note?: string; forceMaterial?: boolean } = {},
): CompareLine {
  const a = present(earlier) ? earlier : null;
  const b = present(later) ? later : null;
  const comparable = opts.comparable ?? true;
  const change = comparable && a !== null && b !== null ? b - a : null;
  const material =
    opts.forceMaterial ??
    (change !== null && opts.threshold !== undefined && Math.abs(change) >= opts.threshold - 1e-9);
  return {
    key,
    label,
    earlier: a,
    later: b,
    change,
    comparable,
    material,
    ...(opts.note ? { note: opts.note } : {}),
    unit,
  };
}

/** The note on a period row: a reset, an overlap, or nothing when the windows are disjoint. */
function periodNote(
  period: string,
  gap: number,
  fyReset: boolean,
  yearReset: boolean,
  fyEarlier: number,
  fyLater: number,
): { comparable: boolean; note?: string } {
  if (period === 'FYTD') {
    return fyReset
      ? {
          comparable: false,
          note: `Different fiscal years (FY${fyEarlier} and FY${fyLater}) — not compared`,
        }
      : {
          comparable: true,
          note: 'Same fiscal year: the later figure includes the earlier months',
        };
  }
  if (period === 'YTD') {
    return yearReset
      ? { comparable: false, note: 'Different calendar years — not compared' }
      : {
          comparable: true,
          note: 'Same calendar year: the later figure includes the earlier months',
        };
  }
  const len = PERIOD_MONTHS[period];
  if (len === null || len === undefined) return { comparable: true };
  const shared = windowOverlap(len, gap);
  return shared > 0
    ? { comparable: true, note: `The two windows share ${shared} of ${len} months` }
    : { comparable: true };
}

function excessAt(e: CioEntity, i: number): number | null {
  const r = e.total.r[i];
  const b = e.total.b[i];
  return present(r) && present(b) ? r - b : null;
}

/** Two reports, one fund, everything that can honestly be put side by side. */
export function compareReports(x: CioVintage, y: CioVintage, entity: Entity): Comparison {
  const [earlier, later] = x.dataThrough <= y.dataThrough ? [x, y] : [y, x];
  const a = earlier.ENT[entity];
  const b = later.ENT[entity];
  const gap = monthsBetween(earlier.dataThrough, later.dataThrough);
  const fyA = fiscalYearOf(earlier.dataThrough);
  const fyB = fiscalYearOf(later.dataThrough);
  const fyReset = fyA !== fyB;
  const yearReset = earlier.dataThrough.slice(0, 4) !== later.dataThrough.slice(0, 4);

  const fund: CompareLine[] = [
    line('mv', 'Total market value', a.aum, b.aum, 'bn', {
      threshold: MATERIAL.mvBn,
      note: 'Includes contributions and benefit payments — a change in value, not a return',
    }),
    line('cash', 'Cash and equivalents', a.cash, b.cash, 'mm'),
    line('god', 'Growth of a dollar, trailing 5 years', a.god, b.god, 'usd', {
      ...(windowOverlap(60, gap) > 0
        ? { note: `The two windows share ${windowOverlap(60, gap)} of 60 months` }
        : {}),
    }),
  ];

  const returns: CompareLine[] = [];
  const excess: CompareLine[] = [];
  PERIODS.forEach((p, i) => {
    const pn = periodNote(p, gap, fyReset, yearReset, fyA, fyB);
    returns.push(
      line(`r-${p}`, p, a.total.r[i], b.total.r[i], 'pct', {
        // only the periods "What changed" judges: marking every period would mark nearly every
        // row a year apart, and a marker on everything tells the reader nothing
        ...(JUDGED_PERIODS.has(p) ? { threshold: MATERIAL.returnPp } : {}),
        comparable: pn.comparable,
        ...(pn.note ? { note: pn.note } : {}),
      }),
    );
    const ea = excessAt(a, i);
    const eb = excessAt(b, i);
    // a sign change in excess is the one excess movement the site already treats as material
    const flipped =
      pn.comparable && ea !== null && eb !== null && ((ea > 0 && eb < 0) || (ea < 0 && eb > 0));
    excess.push(
      line(`x-${p}`, p, ea, eb, 'pct', {
        comparable: pn.comparable,
        forceMaterial: flipped,
        ...(flipped
          ? {
              note: `Turned ${eb! > 0 ? 'positive' : 'negative'}${pn.note ? ' · ' + pn.note.toLowerCase() : ''}`,
            }
          : pn.note
            ? { note: pn.note }
            : {}),
      }),
    );
  });

  // every composite either report carries, matched on its key, never on its position
  const keys = [...new Set([...a.comps.map((c) => c.k), ...b.comps.map((c) => c.k)])];
  const allocation: CompareLine[] = keys.map((k) => {
    const ca = a.comps.find((c) => c.k === k);
    const cb = b.comps.find((c) => c.k === k);
    const name = (cb ?? ca)!.n;
    if (!ca || !cb) {
      return line(`w-${k}`, name, ca?.pct, cb?.pct, 'pct', {
        comparable: false,
        note: `Not in the ${!ca ? 'earlier' : 'later'} report`,
      });
    }
    const targetMoved = Math.abs(cb.tgt - ca.tgt) >= MATERIAL.targetPp;
    return line(`w-${k}`, name, ca.pct, cb.pct, 'pct', {
      threshold: MATERIAL.weightPp,
      ...(targetMoved
        ? {
            forceMaterial: true,
            note: `Policy target moved ${ca.tgt.toFixed(1)}% → ${cb.tgt.toFixed(1)}% — drift is not comparable across policies`,
          }
        : { note: `Target ${cb.tgt.toFixed(1)}%` }),
    });
  });

  const top = (e: CioEntity, name: string) => e.geo.top.find((t) => t[0] === name)?.[1] ?? null;
  const geography: CompareLine[] = [
    line('dm', 'Developed markets', a.geo.dm, b.geo.dm, 'pct'),
    line('em', 'Emerging and frontier markets', a.geo.em, b.geo.em, 'pct'),
    line('us', 'United States', top(a, 'United States'), top(b, 'United States'), 'pct'),
  ];

  return {
    earlier,
    later,
    entity,
    gapMonths: gap,
    fyReset,
    yearReset,
    fund,
    returns,
    excess,
    allocation,
    geography,
  };
}

/** The report to compare with by default: the same month a year earlier, which puts both reports
 *  at the same point of the fiscal year and gives disjoint one-year windows. Failing that, the
 *  report before. Published reports only — a template file or an import is not in the series. */
export function defaultPartner(v: CioVintage): CioVintage | null {
  const published = CIO_VINTAGES.filter((x) => x.origin !== 'file');
  const yearAgo = published.find((x) => monthsBetween(x.dataThrough, v.dataThrough) === 12);
  if (yearAgo) return yearAgo;
  const earlier = published.filter((x) => x.dataThrough < v.dataThrough);
  return earlier.at(-1) ?? published.find((x) => x.dataThrough !== v.dataThrough) ?? null;
}

/** Every line in a comparison, for counting and filtering. */
export function allLines(c: Comparison): CompareLine[] {
  return [...c.fund, ...c.returns, ...c.excess, ...c.allocation, ...c.geography];
}
