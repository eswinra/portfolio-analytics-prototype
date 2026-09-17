import {
  carriedAt,
  monthIndex,
  transformedAt,
  Z_FROM,
  zParams,
  type Transform,
  type ZParams,
} from './series';
import type { MacroSeriesRaw, MacroSnapshot } from './types';

/**
 * Seven macro factors, each the equal-weighted mean of its component z-scores (sign-adjusted so a
 * higher factor always means "more of" the factor's name). Structure after the Sleeve Exposure
 * Monitor built in September 2026, with two changes for a public site: the credit factor uses the
 * Chicago Fed credit and risk subindexes and the St. Louis Fed stress index in place of Moody's
 * Baa spread (whose terms forbid redistribution), and oil and gas enter as year-over-year changes
 * rather than nominal price levels, which trend with inflation.
 *
 * Z-scores use each series' mean and standard deviation over its whole window (1995, or its first
 * month, to the last complete month). The history therefore applies today's yardstick to past
 * months; it is not what an analyst could have computed at the time.
 */

export type FactorKey =
  'growth' | 'inflation' | 'realrates' | 'credit' | 'commodities' | 'curve' | 'dollar';

export const FACTOR_KEYS: FactorKey[] = [
  'growth',
  'inflation',
  'realrates',
  'credit',
  'commodities',
  'curve',
  'dollar',
];

export interface FactorDef {
  key: FactorKey;
  name: string;
  question: string;
  components: [seriesId: string, transform: Transform, sign: 1 | -1][];
}

export const FACTORS: FactorDef[] = [
  {
    key: 'growth',
    name: 'Growth',
    question: 'Is real activity running above or below its long-run norm?',
    components: [
      ['INDPRO', 'yoy', 1],
      ['RSAFS', 'yoy', 1],
      ['PAYEMS', 'ann3m', 1],
      ['IC4WSA', 'level', -1],
      ['TCU', 'level', 1],
      ['NFCI', 'level', -1],
      ['HOUST', 'yoy', 1],
    ],
  },
  {
    key: 'inflation',
    name: 'Inflation',
    question: 'Realised price pressure, plus what markets expect next.',
    components: [
      ['PCEPILFE', 'yoy', 1],
      ['CPILFESL', 'yoy', 1],
      ['PPIACO', 'yoy', 1],
      ['T5YIFR', 'level', 1],
      ['CES0500000003', 'yoy', 1],
      ['PPIIDC', 'yoy', 1],
    ],
  },
  {
    key: 'realrates',
    name: 'Real rates',
    question: 'The discount rate applied to every long-duration asset.',
    components: [
      ['DFII10', 'level', 1],
      ['DGS10', 'level', 1],
      ['DGS30', 'level', 1],
    ],
  },
  {
    key: 'credit',
    name: 'Credit conditions',
    question: 'How tight are credit and funding markets? Higher means tighter or more stressed.',
    components: [
      ['NFCICREDIT', 'level', 1],
      ['NFCIRISK', 'level', 1],
      ['STLFSI4', 'level', 1],
    ],
  },
  {
    key: 'commodities',
    name: 'Commodities',
    question: 'Raw input costs — the channel from supply shocks into inflation.',
    components: [
      ['DCOILWTICO', 'yoy', 1],
      ['DHHNGSP', 'yoy', 1],
      ['PPIIDC', 'yoy', 1],
      ['WPU10', 'yoy', 1],
    ],
  },
  {
    key: 'curve',
    name: 'Curve slope',
    question:
      'Term premium and the market’s read on the policy path; inversion is the classic warning.',
    components: [
      ['T10Y3M', 'level', 1],
      ['T10Y2Y', 'level', 1],
    ],
  },
  {
    key: 'dollar',
    name: 'U.S. dollar',
    question:
      'A stronger dollar lowers the value of unhedged foreign assets and weighs on commodities.',
    components: [['DTWEXBGS', 'level', 1]],
  },
];

export const HISTORY_MONTHS = 60;

export interface FactorPart {
  id: string;
  short: string;
  provider: string;
  transform: Transform;
  sign: 1 | -1;
  /** latest transformed value, in the transform's unit */
  value: number | null;
  /** month of that value */
  month: number | null;
  /** signed z of the latest value (positive = more of the factor) */
  z: number | null;
  params: ZParams | null;
  /** signed z per month over the history window */
  hist: (number | null)[];
  /** transformed value per month over the history window */
  values: (number | null)[];
}

export interface FactorReading {
  key: FactorKey;
  name: string;
  question: string;
  z: number | null;
  d3: number | null;
  d12: number | null;
  hist: (number | null)[];
  parts: FactorPart[];
  /** components that contributed to the latest reading */
  coverage: number;
}

export interface FactorModel {
  /** last complete month (the month before the retrieval month) */
  end: number;
  /** first month of the history window */
  start: number;
  factors: Record<FactorKey, FactorReading>;
}

function partFor(
  s: MacroSeriesRaw,
  transform: Transform,
  sign: 1 | -1,
  start: number,
  end: number,
): FactorPart {
  const params = zParams(s, transform, Math.max(Z_FROM, monthIndex(s.monthly.start)), end);
  const hist: (number | null)[] = [];
  const values: (number | null)[] = [];
  for (let i = start; i <= end; i++) {
    const c = carriedAt(s, i, transform);
    values.push(transformedAt(s, i, transform));
    hist.push(c && params ? (sign * (c.value - params.mu)) / params.sd : null);
  }
  const latest = carriedAt(s, end, transform);
  return {
    id: s.id,
    short: s.short,
    provider: s.provider,
    transform,
    sign,
    value: latest?.value ?? null,
    month: latest?.month ?? null,
    z: latest && params ? (sign * (latest.value - params.mu)) / params.sd : null,
    params,
    hist,
    values,
  };
}

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

export function computeFactors(snap: MacroSnapshot): FactorModel {
  const end = monthIndex(snap.retrieved) - 1;
  const start = end - HISTORY_MONTHS + 1;
  const factors = {} as Record<FactorKey, FactorReading>;
  for (const def of FACTORS) {
    const parts = def.components
      .map(([id, t, sign]) => {
        const s = snap.series[id];
        return s ? partFor(s, t, sign, start, end) : null;
      })
      .filter((p): p is FactorPart => p !== null);
    // a factor needs at least half of its components in a month to be reported for that month
    const need = Math.ceil(def.components.length / 2);
    const hist: (number | null)[] = [];
    for (let k = 0; k <= end - start; k++) {
      const zs = parts
        .map((p) => p.hist[k])
        .filter((z): z is number => z !== null && z !== undefined);
      hist.push(zs.length >= need ? mean(zs) : null);
    }
    const z = hist[hist.length - 1] ?? null;
    const at = (monthsBack: number) => hist[hist.length - 1 - monthsBack] ?? null;
    const z3 = at(3);
    const z12 = at(12);
    factors[def.key] = {
      key: def.key,
      name: def.name,
      question: def.question,
      z,
      d3: z !== null && z3 !== null ? z - z3 : null,
      d12: z !== null && z12 !== null ? z - z12 : null,
      hist,
      parts,
      coverage: parts.filter((p) => p.z !== null).length,
    };
  }
  return { end, start, factors };
}
