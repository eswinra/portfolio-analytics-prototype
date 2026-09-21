import type { DeckGdp } from '../lib/cioGdp';
import type { DeckHistoryPoint } from '../lib/deckFeed';
import { macroAsOf, macroLines, type MacroLine } from '../lib/cioMacro';
import { CIO_MACRO } from './cioMacro.data';
import {
  BINS,
  EDITORIAL_FOR,
  MACRO_NOTES,
  MACRO_PRINTED,
  MACRO_TYPED,
  OPS,
  PERIODS,
  STATUS,
} from './cioMonthly.data';
import { CIO_VINTAGES } from './cioVintages.data';
import type { EntityId } from './published';

/**
 * CIO Monthly vintages — the monthly report layer, kept apart from the fiscal-year figures in
 * `published.ts`. `cioVintages.data.ts` is generated from the public PDFs by
 * tools/extract_cio_report.py (one entry per report, oldest first); `cioMonthly.data.ts` holds
 * the editorial content (macro commentary, items for attention) for the latest report only, and
 * `cioMacro.data.ts` the macro strip's FRED figures for every report (tools/fetch_cio_macro.py). One
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
  /** rebalancing flow in the report month, $ millions; null when the input did not supply it */
  flow: number | null;
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
  /** cash and equivalents, $ millions; null when the input did not supply it */
  cash: number | null;
  /** growth of a dollar as charted in the report (trailing 5 years) */
  god: number | null;
  pages: string;
  total: { r: (number | null)[]; b: (number | null)[]; h: (number | null)[] };
  comps: CioComposite[];
  /** lines the report totals but does not assign to a composite (overlays, other, cash) */
  other: { n: string; mv: number; pct: number; flow: number | null } | null;
  /** net rebalancing, $ millions; null unless every flow was supplied (never a sum of gaps) */
  netflow: number | null;
  overlays: { n: string; may: number; si: number }[] | null;
  /** the 120-month return distribution; null when the input did not supply it */
  hist: {
    c: number[];
    mean: number;
    saa: number;
    sd: number;
    min: number;
    max: number;
    latest: number;
    latestBin: number;
  } | null;
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
  /** 'file': built from a CIO template file in this browser (lib/cioPackage.ts), not published */
  origin?: 'file';
}

/** The previous published report's market values, for the value bridge on slide 2: a month's
 *  closing value against the month before it. Absent for a template file or an imported feed,
 *  whose figures are not part of the published series. */
export interface DeckPrior {
  reportLabel: string;
  monthYear: string;
  ENT: Record<
    'pension' | 'opeb',
    { mv: number; comps: Record<string, number>; other: number | null }
  >;
}

/** The report's Change in Fiduciary Net Position page: what the fund took in and paid out each
 *  month of the fiscal year, and the fiscal years before it. Transcribed from the page (it is an
 *  image in the PDF) and checked against the totals printed beside it. */
/** One fund's Forecast Volatility page (pp. 10 / 15). Transcribed: both pages are images in the
 *  PDF. The category keys are the deck's own composite keys, so the colours on this slide are the
 *  colours used everywhere else for the same functional category. */
export interface CioForecastVol {
  page: number;
  /** 1-year forecast volatility of the fund, percent */
  vol: number;
  /** and of its policy benchmark */
  benchVol: number;
  /** 1-year forecast tracking error against the benchmark, percent */
  activeRisk: number;
  allocationRisk: number;
  selectionRisk: number;
  /** "Current Asset Allocation", whole percent as printed */
  capital: CioRiskShare[];
  /** "Risk by Functional Category", whole percent as printed */
  risk: CioRiskShare[];
  /** "Functional Category Contributions to Active Risk", whole percent as printed */
  contrib: CioRiskShare[];
  /** thirteen months ending at the report's data-through month */
  volTrend: { m: string; v: number }[];
  arTrend: { m: string; v: number }[];
}

export interface CioRiskShare {
  /** growth | credit | ra | rrm | other — the deck's composite keys */
  k: string;
  v: number;
}

export interface CioNetPosition {
  page: number;
  unit: string;
  /** whose net position this is. The report prints the page once, outside the Total Fund and
   *  OPEB sections, so it does not follow the deck's entity toggle. */
  scope: string;
  /** the same fiscal year on the investment book, for the note that keeps the two apart */
  investmentBookFy: { label: string; mm: number };
  /** one entry per month of the fiscal year, oldest first; `v` is the net change */
  months: { m: string; v: number }[];
  /** the fiscal years the page charts, newest first, in $ billions */
  trend: { fy: string; bn: number; up: number; down: number }[];
  /** what the page stacks behind the net line, without printing a figure for any of them */
  components: string[];
}

export interface CioDeckData {
  /** the report's Quarterly Real GDP Growth chart, rebuilt from FRED's archive; null for an
   *  imported feed or a template file, which have no published report behind them */
  GDP: DeckGdp | null;
  /** one point per month the published reports cover, up to the report on screen */
  HISTORY: DeckHistoryPoint[];
  /** the Forecast Volatility pages, for the report that carries them */
  FVOL: Record<'pension' | 'opeb', CioForecastVol> | null;
  /** the Change in Fiduciary Net Position page, for the report that carries it */
  NETPOS: CioNetPosition | null;
  PRIOR: DeckPrior | null;
  PERIODS: string[];
  ENT: { pension: CioEntity; opeb: CioEntity };
  BINS: string[];
  MKT: CioMarketGroup[];
  MACRO: MacroLine[];
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
  /** the date the macro strip's FRED figures are read as of; absent when the strip has none */
  macroLabel?: string;
  /** figures that are not a published report — a template file or an imported workstation
   *  dataset: what it is, its name, and its classification; the deck says so on every slide */
  local?: { kind: string; name: string; cls: string };
  /** a workstation feed carries one fund: the deck locks to it */
  single?: boolean;
}

export { BINS, MACRO_PRINTED, OPS, PERIODS, STATUS };
export { CIO_MACRO, CIO_VINTAGES };

if (CIO_VINTAGES.length === 0) throw new Error('cioVintages.data.ts holds no vintages');
export const CIO_LATEST: CioVintage = CIO_VINTAGES[CIO_VINTAGES.length - 1]!;

/** The macro strip for a public report: the FRED-backed lines as known on the report's as-of
 *  date (any report), then — for the latest report, whose editorial pages are typed in — the
 *  report's commentary beside them and the lines FRED cannot reproduce. */
export function macroFor(v: CioVintage): MacroLine[] {
  // a template file carries its own strip (lib/cioPackage.ts); FRED is for published reports
  if (v.origin === 'file') return [];
  const fred = CIO_MACRO[v.reportDate];
  const latest = v === CIO_LATEST;
  return [
    ...(fred ? macroLines(fred, latest ? MACRO_NOTES : {}) : []),
    ...(latest ? MACRO_TYPED : []),
  ];
}

/** The latest report's strip — what the standalone deck carries. */
export const MACRO: MacroLine[] = macroFor(CIO_LATEST);
export { macroAsOf };

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
    ...(v.origin === 'file'
      ? { local: { kind: 'template file', name: v.file, cls: 'calculated' } }
      : CIO_MACRO[v.reportDate]
        ? { macroLabel: longDate(CIO_MACRO[v.reportDate]!.asOf) }
        : {}),
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

/** The vintage before `v` (by data-through), or null for the oldest. For a vintage that is
 *  not in the public series (a workstation feed) the prior is the newest public report whose
 *  data-through precedes it. */
export function priorVintage(v: CioVintage): CioVintage | null {
  const i = CIO_VINTAGES.indexOf(v);
  if (i >= 0) return i > 0 ? CIO_VINTAGES[i - 1]! : null;
  const earlier = CIO_VINTAGES.filter((x) => x.dataThrough < v.dataThrough);
  return earlier.length ? earlier[earlier.length - 1]! : null;
}

/** A workstation feed (schema 1.4 cio_monthly rows) expressed as a vintage, so the tab renders
 *  it with the same panels; it is never added to the public series. */
export function vintageFromFeed(feed: {
  entityId: string;
  asOf: string;
  entity: CioEntity;
  sourceName: string;
  pageTable: string;
}): CioVintage {
  return {
    reportDate: feed.asOf,
    reportLabel: `Workstation dataset (${feed.entityId})`,
    dataThrough: feed.asOf,
    marketAsOf: null,
    file: feed.sourceName,
    url: null,
    pages: { market: null, flows: 0, pension: [0, 0, 0, 0], opeb: [0, 0, 0, 0] },
    ENT: { pension: feed.entity, opeb: feed.entity },
    MKT: null,
  };
}
