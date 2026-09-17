import {
  dayLabel,
  isStale,
  lastMonthWithValue,
  monthIndex,
  monthLabel,
  nativeLatestAndPrior,
  nativePoints,
  transformedAt,
  type Transform,
} from './series';
import type { MacroGroup, MacroSnapshot } from './types';

/**
 * The indicator board: the headline reading for each part of the economy, with its unit, its own
 * observation date, the change since the prior reading, and a five-year line. Daily and weekly
 * series show their latest native observation and the change since roughly 30 days earlier;
 * monthly series show the latest published month and the change since the month before. Every
 * item keeps its own date — the board does not pretend its readings share one as-of.
 */

export interface IndicatorDef {
  id: string;
  label: string;
  transform: Transform;
  unit: string;
  /** decimals for display */
  dp: number;
  /** how to read the direction, shown under the value */
  note?: string;
}

export interface PanelDef {
  key: MacroGroup | 'growth-dollar';
  title: string;
  question: string;
  headline: IndicatorDef;
  rows: IndicatorDef[];
}

export const PANELS: PanelDef[] = [
  {
    key: 'inflation',
    title: 'Inflation',
    question: 'Is underlying inflation cooling?',
    headline: { id: 'PCEPILFE', label: 'Core PCE', transform: 'yoy', unit: '% YoY', dp: 2 },
    rows: [
      { id: 'CPIAUCSL', label: 'Headline CPI', transform: 'yoy', unit: '% YoY', dp: 2 },
      { id: 'CPILFESL', label: 'Core CPI', transform: 'yoy', unit: '% YoY', dp: 2 },
      {
        id: 'T5YIFR',
        label: '5y5y forward inflation expectation',
        transform: 'level',
        unit: '%',
        dp: 2,
      },
    ],
  },
  {
    key: 'labor',
    title: 'Labor market',
    question: 'Is the labor market softening?',
    headline: { id: 'UNRATE', label: 'Unemployment rate', transform: 'level', unit: '%', dp: 1 },
    rows: [
      {
        id: 'PAYEMS',
        label: 'Nonfarm payroll change',
        transform: 'chg1m',
        unit: 'k jobs / month',
        dp: 0,
      },
      {
        id: 'IC4WSA',
        label: 'Initial claims, 4-week average',
        transform: 'thousands',
        unit: 'k claims',
        dp: 0,
      },
      { id: 'JTSJOL', label: 'Job openings', transform: 'millions', unit: 'M openings', dp: 2 },
    ],
  },
  {
    key: 'rates',
    title: 'Rates and curve',
    question: 'What is the discount rate doing, and is the curve inverted?',
    headline: {
      id: 'T10Y2Y',
      label: '10-year minus 2-year',
      transform: 'bps',
      unit: 'bps',
      dp: 0,
      note: 'negative means inverted',
    },
    rows: [
      { id: 'DGS10', label: '10-year Treasury', transform: 'level', unit: '%', dp: 2 },
      { id: 'DFII10', label: '10-year real yield (TIPS)', transform: 'level', unit: '%', dp: 2 },
      { id: 'T10Y3M', label: '10-year minus 3-month', transform: 'bps', unit: 'bps', dp: 0 },
    ],
  },
  {
    key: 'credit',
    title: 'Credit conditions',
    question: 'Are credit and funding markets under stress?',
    headline: {
      id: 'STLFSI4',
      label: 'St. Louis Fed Financial Stress Index',
      transform: 'level',
      unit: 'index',
      dp: 2,
      note: '0 = average; above 0 = above-average stress',
    },
    rows: [
      { id: 'NFCICREDIT', label: 'NFCI credit subindex', transform: 'level', unit: 'index', dp: 2 },
      { id: 'NFCIRISK', label: 'NFCI risk subindex', transform: 'level', unit: 'index', dp: 2 },
      {
        id: 'CPFF',
        label: 'Commercial paper minus fed funds',
        transform: 'bps',
        unit: 'bps',
        dp: 0,
      },
    ],
  },
  {
    key: 'commodities',
    title: 'Commodities',
    question: 'Are input costs adding to inflation pressure?',
    headline: {
      id: 'DCOILWTICO',
      label: 'WTI crude oil',
      transform: 'level',
      unit: 'USD / barrel',
      dp: 2,
    },
    rows: [
      {
        id: 'DHHNGSP',
        label: 'Henry Hub natural gas',
        transform: 'level',
        unit: 'USD / MMBtu',
        dp: 2,
      },
      {
        id: 'WPU10',
        label: 'PPI, metals and metal products',
        transform: 'yoy',
        unit: '% YoY',
        dp: 1,
      },
      {
        id: 'PPIIDC',
        label: 'PPI, industrial commodities',
        transform: 'yoy',
        unit: '% YoY',
        dp: 1,
      },
    ],
  },
  {
    key: 'growth-dollar',
    title: 'Growth and the dollar',
    question: 'Is activity holding up, and what is the dollar doing to foreign assets?',
    headline: {
      id: 'INDPRO',
      label: 'Industrial production',
      transform: 'yoy',
      unit: '% YoY',
      dp: 1,
    },
    rows: [
      {
        id: 'RSAFS',
        label: 'Retail and food services sales',
        transform: 'yoy',
        unit: '% YoY',
        dp: 1,
      },
      { id: 'TCU', label: 'Capacity utilization', transform: 'level', unit: '%', dp: 1 },
      {
        id: 'DTWEXBGS',
        label: 'Nominal broad dollar index',
        transform: 'level',
        unit: 'index',
        dp: 1,
      },
    ],
  },
];

/** Transforms that only rescale a published number keep its public classification. */
export const isReportedTransform = (t: Transform): boolean =>
  t === 'level' || t === 'bps' || t === 'thousands' || t === 'millions';

export interface Reading {
  def: IndicatorDef;
  title: string;
  provider: string;
  frequency: string;
  value: number;
  /** display date of the observation */
  date: string;
  /** ISO date (daily/weekly) or first of month (monthly) */
  isoDate: string;
  change: number | null;
  /** what the change is measured against */
  changeBasis: string;
  stale: boolean;
  classification: 'reported_public' | 'calculated';
  /** transformed monthly values, last 60 months to the last complete month */
  spark: (number | null)[];
}

const scaleNative = (t: Transform, v: number) =>
  t === 'bps' ? v * 100 : t === 'thousands' || t === 'millions' ? v / 1000 : v;

export function reading(snap: MacroSnapshot, def: IndicatorDef): Reading | null {
  const s = snap.series[def.id];
  if (!s) return null;
  const end = monthIndex(snap.retrieved) - 1;
  const spark = Array.from({ length: 60 }, (_, k) => transformedAt(s, end - 59 + k, def.transform));
  const base = {
    def,
    title: s.title,
    provider: s.provider,
    frequency: s.frequency,
    classification: isReportedTransform(def.transform)
      ? ('reported_public' as const)
      : ('calculated' as const),
    spark,
  };
  const native = (s.frequency === 'D' || s.frequency === 'W') && isReportedTransform(def.transform);
  if (native) {
    const lp = nativeLatestAndPrior(s, 30);
    if (!lp) return null;
    return {
      ...base,
      value: scaleNative(def.transform, lp.latest.value),
      date: dayLabel(lp.latest.date),
      isoDate: lp.latest.date,
      change: lp.prior
        ? scaleNative(def.transform, lp.latest.value) - scaleNative(def.transform, lp.prior.value)
        : null,
      changeBasis: lp.prior
        ? `vs ${dayLabel(lp.prior.date)}`
        : 'no earlier observation in the snapshot',
      stale: isStale(s.frequency, lp.latest.date, snap.retrieved),
    };
  }
  // monthly (or a monthly transform of a daily series): the latest published month
  const m = lastMonthWithValue(s, def.transform, monthIndex(snap.retrieved));
  if (m === null) return null;
  const v = transformedAt(s, m, def.transform)!;
  const prev = transformedAt(s, m - 1, def.transform);
  const iso = `${Math.floor(m / 12)}-${String((m % 12) + 1).padStart(2, '0')}-01`;
  return {
    ...base,
    value: v,
    date: monthLabel(m),
    isoDate: iso,
    change: prev === null ? null : v - prev,
    changeBasis: prev === null ? 'prior month not published' : `vs ${monthLabel(m - 1)}`,
    stale: isStale(s.frequency, iso, snap.retrieved),
  };
}

export interface CurvePoint {
  maturity: string;
  value: number;
}

export interface Curve {
  date: string;
  points: CurvePoint[];
}

const CURVE: [id: string, maturity: string][] = [
  ['DGS3MO', '3m'],
  ['DGS2', '2y'],
  ['DGS5', '5y'],
  ['DGS10', '10y'],
  ['DGS30', '30y'],
];

/** Treasury curves on dates common to all five maturities: the latest, and the last common date
 *  at least `daysAgo` before it. Mixing dates across maturities would draw a curve that never
 *  existed. */
export function treasuryCurves(snap: MacroSnapshot, daysAgo: number[] = [0, 30, 365]): Curve[] {
  const maps = CURVE.map(
    ([id]) => new Map(nativePoints(snap.series[id]!).map((p) => [p.date, p.value])),
  );
  const common = [...maps[0]!.keys()].filter((d) => maps.every((m) => m.has(d))).sort();
  const latest = common[common.length - 1];
  if (!latest) return [];
  const t0 = Date.parse(`${latest}T12:00:00Z`);
  const out: Curve[] = [];
  for (const back of daysAgo) {
    const cutoff = new Date(t0 - back * 86_400_000).toISOString().slice(0, 10);
    const date = [...common].reverse().find((d) => d <= cutoff);
    if (!date) continue;
    out.push({
      date,
      points: CURVE.map(([, maturity], i) => ({ maturity, value: maps[i]!.get(date)! })),
    });
  }
  return out;
}

export interface Channel {
  channel: string;
  text: string;
}

/**
 * Transmission channels: the latest native change in four market inputs and the mechanism by
 * which each reaches asset prices, in general terms. After the ChatGPT regime dashboard, with the
 * St. Louis Fed Financial Stress Index in place of the ICE BofA high-yield spread (ICE data may
 * not be republished). The thresholds that decide "little change" are analyst assumptions.
 * Mechanisms, not forecasts: nothing here says what LACERA's portfolio did or will do.
 */
export function transmission(snap: MacroSnapshot): Channel[] {
  const change = (id: string) => {
    const s = snap.series[id];
    if (!s) return null;
    const lp = nativeLatestAndPrior(s, 30);
    if (!lp?.prior || isStale(s.frequency, lp.latest.date, snap.retrieved)) return null;
    return {
      delta: lp.latest.value - lp.prior.value,
      prior: lp.prior.value,
      from: dayLabel(lp.prior.date),
    };
  };
  const signed = (x: number, dp = 0) =>
    `${x > 0 ? '+' : x < 0 ? '−' : ''}${Math.abs(x).toFixed(dp)}`;
  const real = change('DFII10');
  const stress = change('STLFSI4');
  const oil = change('DCOILWTICO');
  const nominal = change('DGS10');
  return [
    {
      channel: 'Discount rate',
      text: real
        ? `10-year real yield ${signed(real.delta * 100)} bps since ${real.from}. ${real.delta > 0.05 ? 'A higher real discount rate lowers the present value of long-duration assets.' : real.delta < -0.05 ? 'A lower real discount rate raises the present value of long-duration assets.' : 'Little change in this valuation input.'}`
        : 'Real-yield change unavailable in this snapshot.',
    },
    {
      channel: 'Financial stress',
      text: stress
        ? `St. Louis Fed stress index ${signed(stress.delta, 2)} since ${stress.from}. ${stress.delta > 0.1 ? 'Rising stress usually comes with wider credit spreads and tighter funding.' : stress.delta < -0.1 ? 'Easing stress usually comes with narrower credit spreads and easier funding.' : 'Broadly stable over this interval.'}`
        : 'Financial-stress change unavailable in this snapshot.',
    },
    {
      channel: 'Energy costs',
      text:
        oil && oil.prior > 0
          ? `WTI crude ${signed((oil.delta / oil.prior) * 100, 1)}% since ${oil.from}. ${oil.delta > 0 ? 'Higher energy prices support producers and add cost pressure elsewhere.' : 'Lower energy prices ease input costs and weigh on producers.'}`
          : 'Energy-price change unavailable in this snapshot.',
    },
    {
      channel: 'Duration',
      text: nominal
        ? `10-year Treasury yield ${signed(nominal.delta * 100)} bps since ${nominal.from}. ${nominal.delta > 0.05 ? 'Higher yields lower the price of existing bonds.' : nominal.delta < -0.05 ? 'Lower yields raise the price of existing bonds.' : 'The nominal duration backdrop is little changed.'}`
        : 'Nominal-yield change unavailable in this snapshot.',
    },
  ];
}
