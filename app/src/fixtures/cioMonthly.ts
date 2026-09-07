import { DECK_DATA } from './cioMonthly.data';
import type { EntityId } from './published';

/**
 * CIO Monthly vintage — the monthly report layer, kept apart from the fiscal-year figures in
 * `published.ts`. One fixture feeds two surfaces: the CIO Monthly dashboard tab and the slide
 * deck at /deck/ (its embedded data block is generated from `cioMonthly.data.ts`, and a unit
 * test fails if the two ever differ). Period returns under one year are cumulative, three years
 * and longer annualized, all net of fees, as printed.
 */

export type CompositeKey = 'growth' | 'credit' | 'ra' | 'rrm';
export type OpsStatus = 'prog' | 'dev' | 'info' | 'quiet';

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
  /** May rebalancing flow, $ millions (p. 18) */
  flow: number;
  /** composite return by period (null = not published) */
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
  /** growth of a dollar as charted in the report */
  god: number;
  pages: string;
  total: { r: number[]; b: number[]; h: number[] };
  comps: CioComposite[];
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

export interface CioDeckData {
  PERIODS: string[];
  ENT: { pension: CioEntity; opeb: CioEntity };
  BINS: string[];
  MKT: { g: string; rows: { n: string; i: string; v: number[] }[] }[];
  MACRO: { l: string; v: string; s: string }[];
  OPS: { e: string; item: string; st: OpsStatus; p: number }[];
  STATUS: Record<OpsStatus, [label: string, cls: string]>;
}

export const CIO_VINTAGE = {
  title: 'Chief Investment Officer Monthly Report',
  reportDate: 'July 8, 2026',
  dataThrough: 'May 31, 2026',
  periodNote:
    'Periods under one year are cumulative, three years and longer annualized; all returns net of fees, as printed.',
} as const;

export const { PERIODS, ENT, BINS, MKT, MACRO, OPS, STATUS } = DECK_DATA;

/** Index into PERIODS for the periods the dashboard tab singles out. */
export const PERIOD_INDEX = { oneMonth: 0, fytd: 2, oneYear: 4 } as const;

export const cioFor = (e: EntityId): CioEntity => (e === 'OPEB' ? ENT.opeb : ENT.pension);
