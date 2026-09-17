import type { FactorModel } from './factors';
import { isStale, monthKey, transformedAt, valueAt } from './series';
import type { MacroSnapshot } from './types';

/**
 * The regime read answers two different questions, kept apart because they can disagree:
 *
 * 1. WHERE the economy sits — the growth and inflation factors against their long-run norms
 *    (z-scores). A quadrant is named only when both readings are clear of the near-norm band;
 *    a growth reading of -0.05 does not make an economy "stagflationary".
 * 2. WHICH WAY it is moving — rules over the last three months of core PCE inflation,
 *    unemployment and payrolls, evaluated on their latest common month. The thresholds are
 *    analyst assumptions, stated on the page; they are not a recession model or a LACERA control.
 */

export type Quadrant = 'overheating' | 'stagflation' | 'contraction' | 'goldilocks';

export const QUADRANT_NAME: Record<Quadrant, string> = {
  overheating: 'Overheating',
  stagflation: 'Stagflation',
  contraction: 'Disinflationary slowdown',
  goldilocks: 'Goldilocks',
};

export function quadrantOf(growthZ: number, inflationZ: number): Quadrant {
  if (growthZ >= 0) return inflationZ >= 0 ? 'overheating' : 'goldilocks';
  return inflationZ >= 0 ? 'stagflation' : 'contraction';
}

/** Readings within this many standard deviations of the norm are "near the norm": the sign of a
 *  z-score that small says little, so no quadrant is named on it. */
export const NEAR_NORM = 0.5;

/** Plain-language distance from the norm. */
export function magnitude(z: number): string {
  const a = Math.abs(z);
  if (a < NEAR_NORM) return 'close to';
  if (a < 1) return 'moderately';
  if (a < 2) return 'well';
  return 'far';
}

const levelWord = (z: number) =>
  z >= NEAR_NORM ? 'above-norm' : z <= -NEAR_NORM ? 'below-norm' : 'near-norm';

/** Where the reading sits, naming a quadrant only when both axes are clear of the near-norm band. */
export function placement(growthZ: number, inflationZ: number): string {
  const gNear = Math.abs(growthZ) < NEAR_NORM;
  const iNear = Math.abs(inflationZ) < NEAR_NORM;
  const name = (g: number, i: number) => QUADRANT_NAME[quadrantOf(g, i)];
  if (gNear && iNear) return 'Near the centre — no quadrant is clearly indicated';
  if (gNear) return `On the border between ${name(1, inflationZ)} and ${name(-1, inflationZ)}`;
  if (iNear) return `On the border between ${name(growthZ, 1)} and ${name(growthZ, -1)}`;
  return `In the ${name(growthZ, inflationZ)} quadrant`;
}

export interface LevelRead {
  month: number;
  growthZ: number;
  inflationZ: number;
  quadrant: Quadrant;
  /** e.g. "Above-norm inflation, near-norm growth" */
  headline: string;
  /** e.g. "On the border between Overheating and Stagflation" */
  where: string;
  /** e.g. "Inflation moderately above its long-run norm; growth close to its long-run norm." */
  sentence: string;
  /** last 12 months of the path, oldest first (null months skipped) */
  trail: { month: number; g: number; i: number }[];
}

export function levelRead(model: FactorModel): LevelRead | null {
  const g = model.factors.growth;
  const inf = model.factors.inflation;
  if (g.z === null || inf.z === null) return null;
  const phrase = (name: string, z: number) => {
    const m = magnitude(z);
    return m === 'close to'
      ? `${name} close to its long-run norm`
      : `${name} ${m} ${z >= 0 ? 'above' : 'below'} its long-run norm`;
  };
  const trail: LevelRead['trail'] = [];
  for (let k = 11; k >= 0; k--) {
    const gz = g.hist[g.hist.length - 1 - k];
    const iz = inf.hist[inf.hist.length - 1 - k];
    if (gz !== null && gz !== undefined && iz !== null && iz !== undefined) {
      trail.push({ month: model.end - k, g: gz, i: iz });
    }
  }
  const head = `${levelWord(inf.z)} inflation, ${levelWord(g.z)} growth`;
  return {
    month: model.end,
    growthZ: g.z,
    inflationZ: inf.z,
    quadrant: quadrantOf(g.z, inf.z),
    headline: head.charAt(0).toUpperCase() + head.slice(1),
    where: placement(g.z, inf.z),
    sentence: `${phrase('Inflation', inf.z)}; ${phrase('growth', g.z)}.`,
    trail,
  };
}

export type InflationDirection = 'rising' | 'easing' | 'steady';
export type LaborDirection = 'softening' | 'firm' | 'mixed';

export interface DirectionRead {
  /** latest month in which core PCE, unemployment and payrolls are all published */
  month: number;
  corePce: number;
  /** change in core PCE year-over-year inflation over three months, percentage points */
  inflationDelta: number;
  inflation: InflationDirection;
  /** latest three-month average unemployment minus the preceding three-month average, pp */
  laborDelta: number;
  /** average monthly payroll change over the last three months, thousands */
  payrolls: number;
  labor: LaborDirection;
  label: string;
}

export const RULES = {
  inflationBand: 0.15,
  laborSoftening: 0.15,
  laborFirm: 0.1,
} as const;

export function directionRead(snap: MacroSnapshot, end: number): DirectionRead | null {
  const pce = snap.series.PCEPILFE;
  const u = snap.series.UNRATE;
  const p = snap.series.PAYEMS;
  if (!pce || !u || !p) return null;
  let month: number | null = null;
  for (let i = end; i > end - 24; i--) {
    if (
      transformedAt(pce, i, 'yoy') !== null &&
      valueAt(u, i) !== null &&
      transformedAt(p, i, 'chg1m') !== null
    ) {
      month = i;
      break;
    }
  }
  // a read built on a stopped feed is not a current read: missing stays missing
  if (month === null || isStale('M', monthKey(month), snap.retrieved)) return null;
  const core = transformedAt(pce, month, 'yoy');
  const past = transformedAt(pce, month - 3, 'yoy');
  const avg = (f: (i: number) => number | null, from: number, n: number) => {
    const xs = Array.from({ length: n }, (_, k) => f(from - k));
    return xs.every((x) => x !== null) ? (xs as number[]).reduce((a, b) => a + b, 0) / n : null;
  };
  const uNow = avg((i) => valueAt(u, i), month, 3);
  const uPast = avg((i) => valueAt(u, i), month - 3, 3);
  const jobs = avg((i) => transformedAt(p, i, 'chg1m'), month, 3);
  if (core === null || past === null || uNow === null || uPast === null || jobs === null)
    return null;

  const inflationDelta = core - past;
  const laborDelta = uNow - uPast;
  const inflation: InflationDirection =
    inflationDelta > RULES.inflationBand
      ? 'rising'
      : inflationDelta < -RULES.inflationBand
        ? 'easing'
        : 'steady';
  const labor: LaborDirection =
    laborDelta >= RULES.laborSoftening || jobs < 0
      ? 'softening'
      : laborDelta <= RULES.laborFirm && jobs > 0
        ? 'firm'
        : 'mixed';
  const label =
    inflation === 'steady' || labor === 'mixed'
      ? 'Mixed signals'
      : `${inflation === 'easing' ? 'Disinflation' : 'Inflation pressure'} · ${labor === 'firm' ? 'firm labor' : 'softening labor'}`;
  return {
    month,
    corePce: core,
    inflationDelta,
    inflation,
    laborDelta,
    payrolls: jobs,
    labor,
    label,
  };
}
