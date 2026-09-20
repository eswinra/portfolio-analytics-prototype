import { CIO_GDP, type CioGdpVintage } from '../fixtures/cioGdp.data';

import { longDate } from '../fixtures/cioMonthly';

/** The report's Quarterly Real GDP Growth chart.
 *
 *  The figures are the report's own, rebuilt from FRED's real-time archive rather than typed
 *  (`tools/fetch_cio_gdp.py`). What matters here is the vintage: this chart is not redrawn every
 *  month, so seven of the sixteen reports print it older than the rest of their macro page — four
 *  consecutive reports in late 2025 all carry FRED as it stood on July 31, 2025. The page shows
 *  the vintage and says when the chart was behind, because a reader comparing two reports would
 *  otherwise take a revision for a change in the economy. */

export type { CioGdpVintage };

export function gdpFor(reportDate: string): CioGdpVintage | null {
  return CIO_GDP[reportDate] ?? null;
}

/** 'Q2 26' — the short form the axis uses. */
export function quarterLabel(q: string): string {
  return `Q${q.slice(5)} ${q.slice(2, 4)}`;
}

/** 'Q1 2023 to Q2 2026' — the long form, for the caption. */
export function quarterLong(q: string): string {
  return `Q${q.slice(5)} ${q.slice(0, 4)}`;
}

/** Whole months between two ISO dates, used only to say how far behind a chart is. */
export function monthsBetween(from: string, to: string): number {
  const [fy, fm] = [Number(from.slice(0, 4)), Number(from.slice(5, 7))];
  const [ty, tm] = [Number(to.slice(0, 4)), Number(to.slice(5, 7))];
  return (ty - fy) * 12 + (tm - fm);
}

export interface GdpCaption {
  /** 'Real GDP, quarterly, annualised — Q1 2023 to Q2 2026' */
  range: string;
  /** 'as FRED showed it on July 31, 2026' */
  asOf: string;
  /** set only when the report's chart was behind the rest of its macro page */
  stale: string | null;
  /** the most recent quarter on the chart */
  latest: { q: string; v: number };
}

export function gdpCaption(v: CioGdpVintage): GdpCaption {
  const first = v.quarters[0]!;
  const last = v.quarters.at(-1)!;
  const behind = monthsBetween(v.asOf, v.reportAsOf);
  return {
    range: `Real GDP, quarterly, annualised — ${quarterLong(first.q)} to ${quarterLong(last.q)}`,
    asOf: `as FRED showed it on ${longDate(v.asOf)}`,
    stale: v.stale
      ? `The report's chart carries FRED as of ${longDate(v.asOf)}, ${behind} month${
          behind === 1 ? '' : 's'
        } older than the rest of its macro page (${longDate(v.reportAsOf)}). It is reproduced as printed, revisions and all.`
      : null,
    latest: { q: last.q, v: last.v },
  };
}

/** What the deck is given. The deck is a self-contained file with no date formatting of its own —
 *  every label it prints is computed here, as the vintage labels are — and it has no use for
 *  `printed`, which exists so a unit test can check the FRED values without a network call. */
export interface DeckGdp {
  asOf: string;
  asOfLabel: string;
  reportAsOf: string;
  reportAsOfLabel: string;
  stale: boolean;
  /** months the report's chart is behind the rest of its macro page; 0 when it is not */
  behind: number;
  quarters: { q: string; v: number }[];
}

export function deckGdp(reportDate: string): DeckGdp | null {
  const g = gdpFor(reportDate);
  if (!g) return null;
  return {
    asOf: g.asOf,
    asOfLabel: longDate(g.asOf),
    reportAsOf: g.reportAsOf,
    reportAsOfLabel: longDate(g.reportAsOf),
    stale: g.stale,
    behind: monthsBetween(g.asOf, g.reportAsOf),
    quarters: g.quarters,
  };
}

/** The bar geometry: a shared scale that always includes zero, so a negative quarter reads as one
 *  rather than as a short bar. Pure, so the deck and the dashboard cannot draw different pictures
 *  from the same figures. */
export function gdpScale(quarters: readonly { q: string; v: number }[]): {
  min: number;
  max: number;
  zero: number;
} {
  const vs = quarters.map((x) => x.v);
  const max = Math.max(0, ...vs);
  const min = Math.min(0, ...vs);
  const span = max - min || 1;
  return { min, max, zero: (max / span) * 100 };
}
