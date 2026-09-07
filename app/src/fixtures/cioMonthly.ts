import { BINS, EDITORIAL_FOR, MACRO, OPS, PERIODS, STATUS } from './cioMonthly.data';
import { CIO_VINTAGES } from './cioVintages.data';
import type { EntityId } from './published';

/**
 * CIO Monthly vintages — the monthly report layer, kept apart from the fiscal-year figures in
 * `published.ts`. `cioVintages.data.ts` is generated from the public PDFs by
 * tools/extract_cio_report.py (one entry per report, oldest first); `cioMonthly.data.ts` holds
 * the editorial content (macro strip, items for attention) for the latest report only. One
 * fixture feeds two surfaces: the CIO Monthly dashboard tab (any vintage) and the slide deck at
 * /deck/ (latest vintage; its embedded data block is generated from here and a unit test fails
 * if the two ever differ). Period returns under one year are cumulative, three years and longer
 * annualized, all net of fees, as printed.
 */

export type CompositeKey = 'growth' | 'credit' | 'ra' | 'rrm';
export type OpsStatus = 'prog' | 'dev' | 'info' | 'quiet' | 'done';

export interface CioComposite {
  k: CompositeKey;
  n: string;
  short: string;
  /** market value, $ millions */
  mv: number;
  /** weight at month end, % */
  pct: number;
  /** 2024 SAA target, % */
  tgt: number;
  /** rebalancing flow in the report month, $ millions */
  flow: number;
  /** composite return by period (null = not printed) */
  r: (number | null)[];
  /** composite policy benchmark by period */
  b: (number | null)[];
}

export interface CioEntity {
  name: string;
  short: string;
  /** $ billions */
  aum: number;
  /** $ millions */
  mv: number;
  /** cash and equivalents, $ millions */
  cash: number;
  /** growth of a dollar as charted in the report (trailing 5 years) */
  god: number | null;
  pages: string;
  total: { r: (number | null)[]; b: (number | null)[]; h: (number | null)[] };
  comps: CioComposite[];
  /** lines the report totals but does not assign to a composite (overlays, other, cash) */
  other: { n: string; mv: number; pct: number; flow: number } | null;
  netflow: number;
  overlays: { n: string; may: number; si: number }[] | null;
  hist: {
    c: number[];
    mean: number;
    saa: number;
    sd: number;
    min: number;
    max: number;
    latest: number;
    latestBin: number;
  };
  geo: {
    dm: number;
    em: number;
    dmN: number;
    emN: number;
    total: number;
    page: number;
    top: [country: string, pct: number, group: 'dm' | 'em'][];
  };
}

export interface CioMarketGroup {
  g: string;
  rows: { n: string; i: string; v: (number | null)[] }[];
}

export interface CioVintage {
  /** ISO meeting date, or YYYY-MM when the cover names only the month */
  reportDate: string;
  reportLabel: string;
  /** ISO month end the fund figures are as of */
  dataThrough: string;
  /** ISO date the market table is as of (one month after the fund figures), or null */
  marketAsOf: string | null;
  file: string;
  url: string | null;
  pages: {
    market: number | null;
    flows: number;
    pension: [summary: number, table: number, histogram: number, geography: number];
    opeb: [summary: number, table: number, histogram: number, geography: number];
  };
  ENT: { pension: CioEntity; opeb: CioEntity };
  /** market table; null for reports whose table is not machine-readable */
  MKT: CioMarketGroup[] | null;
}

export interface CioDeckData {
  PERIODS: string[];
  ENT: { pension: CioEntity; opeb: CioEntity };
  BINS: string[];
  MKT: CioMarketGroup[];
  MACRO: { l: string; v: string; s: string }[];
  OPS: { e: string; item: string; st: OpsStatus; p: number }[];
  STATUS: Record<OpsStatus, [label: string, cls: string]>;
  VINTAGE: DeckVintage;
}

/** Labels the deck's prose needs, derived from the latest vintage so no month is hardcoded. */
export interface DeckVintage {
  reportLabel: string;
  throughLabel: string;
  month: string;
  monthYear: string;
  marketLabel: string;
  histRange: string;
  url: string | null;
}

export { BINS, MACRO, OPS, PERIODS, STATUS };
export { CIO_VINTAGES };

if (CIO_VINTAGES.length === 0) throw new Error('cioVintages.data.ts holds no vintages');
export const CIO_LATEST: CioVintage = CIO_VINTAGES[CIO_VINTAGES.length - 1]!;

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

/** 'June 30, 2026' from '2026-06-30'; 'July 2026' from '2026-07'. */
export function longDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  const month = MONTHS[(m ?? 1) - 1]!;
  return d ? `${month} ${d}, ${y}` : `${month} ${y}`;
}
export function monthName(iso: string): string {
  return MONTHS[Number(iso.slice(5, 7)) - 1]!;
}
export function monthYear(iso: string): string {
  return `${monthName(iso)} ${iso.slice(0, 4)}`;
}
/** 'July 2016 – June 2026' for a 120-month window ending at the data-through month. */
export function histRange(dataThrough: string, months = 120): string {
  const y = Number(dataThrough.slice(0, 4));
  const m = Number(dataThrough.slice(5, 7));
  const startIndex = y * 12 + (m - 1) - (months - 1);
  const sy = Math.floor(startIndex / 12);
  const sm = startIndex - sy * 12;
  return `${MONTHS[sm]} ${sy} – ${monthName(dataThrough)} ${y}`;
}

export function deckVintage(v: CioVintage): DeckVintage {
  return {
    reportLabel: v.reportLabel,
    throughLabel: longDate(v.dataThrough),
    month: monthName(v.dataThrough),
    monthYear: monthYear(v.dataThrough),
    marketLabel: v.marketAsOf ? longDate(v.marketAsOf) : longDate(v.dataThrough),
    histRange: histRange(v.dataThrough),
    url: v.url,
  };
}

/** The current (latest) vintage's labels, used by the shell. */
export const CIO_VINTAGE = {
  title: 'Chief Investment Officer Monthly Report',
  reportDate: CIO_LATEST.reportLabel,
  dataThrough: longDate(CIO_LATEST.dataThrough),
  editorialFor: EDITORIAL_FOR,
  periodNote:
    'Periods under one year are cumulative, three years and longer annualized; all returns net of fees, as printed.',
} as const;

/** Index into PERIODS for the periods the dashboard tab singles out. */
export const PERIOD_INDEX = { oneMonth: 0, fytd: 2, oneYear: 4 } as const;

export const cioFor = (e: EntityId, v: CioVintage = CIO_LATEST): CioEntity =>
  e === 'OPEB' ? v.ENT.opeb : v.ENT.pension;

/** The vintage before `v` (by data-through), or null for the oldest. */
export function priorVintage(v: CioVintage): CioVintage | null {
  const i = CIO_VINTAGES.indexOf(v);
  return i > 0 ? CIO_VINTAGES[i - 1]! : null;
}
