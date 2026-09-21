import { CIO_MACRO, macroAsOf, type CioVintage } from '../fixtures/cioMonthly';
import type { Classification } from '../components/pageMeta';

import { gdpFor } from './cioGdp';

/** When each figure on the CIO Monthly tab was true.
 *
 *  One report is not one date. The August 12, 2026 report carries fund figures through June 30,
 *  a market table through July 31, FRED series read as of July 31, a Treasury curve read at the
 *  fund's own month end, a GDP chart that may be months older than the rest of its page, and real
 *  estate at the latest available quarter. Six as-of dates on one tab.
 *
 *  Two of them are AHEAD of the fund figures rather than behind, which is the subtler trap: a
 *  reader who takes the market table as coeval with the month's performance is reading a different
 *  month. This is the "never silently combine annual, quarterly, monthly and daily values as
 *  though they share one as-of date" rule, made visible instead of left in footnotes. */

export type FreshnessDirection = 'anchor' | 'ahead' | 'behind' | 'undated';

export interface FreshnessRow {
  key: string;
  /** the figures this row covers */
  what: string;
  /** ISO date the figure is as of, or null when it has no single date */
  asOf: string | null;
  /** how the figure is dated when `asOf` is null */
  asOfNote?: string;
  cadence: 'daily' | 'monthly' | 'quarterly' | 'annual' | 'as published';
  source: string;
  /** whole months from the anchor; negative is older, positive is newer, null when undated */
  months: number | null;
  direction: FreshnessDirection;
  /** why this differs from the anchor — set only when it does */
  why?: string;
  cls: Classification;
  /** where on the tab it appears */
  where: string;
}

export interface Freshness {
  /** the month the fund figures cover: what a reader assumes everything else shares */
  anchor: string;
  /** the date the report itself was presented */
  reportDate: string;
  rows: FreshnessRow[];
}

/** Whole months between two ISO dates, by calendar month rather than by day count: these are
 *  month-end figures, and 30 June to 31 July is one month, not thirty-one days. */
export function monthsApart(from: string, to: string): number {
  const [fy, fm] = [Number(from.slice(0, 4)), Number(from.slice(5, 7))];
  const [ty, tm] = [Number(to.slice(0, 4)), Number(to.slice(5, 7))];
  return (ty - fy) * 12 + (tm - fm);
}

function direction(months: number | null): FreshnessDirection {
  if (months === null) return 'undated';
  if (months === 0) return 'anchor';
  return months > 0 ? 'ahead' : 'behind';
}

/** 'one month ahead' / 'four months behind' / 'same month' — the plain reading of the offset. */
export function offsetLabel(months: number | null): string {
  if (months === null) return 'no single date';
  if (months === 0) return 'same month as the fund figures';
  const n = Math.abs(months);
  const word = n === 1 ? 'month' : 'months';
  return `${n} ${word} ${months > 0 ? 'ahead of' : 'behind'} the fund figures`;
}

function row(
  key: string,
  what: string,
  asOf: string | null,
  anchor: string,
  rest: Omit<FreshnessRow, 'key' | 'what' | 'asOf' | 'months' | 'direction'>,
): FreshnessRow {
  const months = asOf ? monthsApart(anchor, asOf) : null;
  return { key, what, asOf, months, direction: direction(months), ...rest };
}

/** Every dated figure on the CIO Monthly tab for one report, anchored on the month the fund
 *  figures cover. Pure: the panel renders these rows and adds nothing of its own. */
export function freshnessFor(v: CioVintage): Freshness {
  const anchor = v.dataThrough;
  const rows: FreshnessRow[] = [];

  rows.push(
    row('fund', 'Fund figures — market value, returns, weights, flows', anchor, anchor, {
      cadence: 'monthly',
      source: 'CIO Monthly Report',
      cls: 'reported_public',
      where: 'Summary · Performance · Positioning',
    }),
  );

  rows.push(
    row('hist', 'Return distribution — 120 months ending at the anchor', anchor, anchor, {
      cadence: 'monthly',
      source: 'CIO Monthly Report',
      cls: 'reported_public',
      where: 'Positioning',
    }),
  );

  rows.push(
    row('geo', 'Geographic exposure by domicile', anchor, anchor, {
      cadence: 'monthly',
      source: 'CIO Monthly Report',
      cls: 'reported_public',
      where: 'Positioning',
    }),
  );

  // the market table is one month AFTER the fund figures in every published report
  if (v.marketAsOf) {
    rows.push(
      row('market', 'Market index returns', v.marketAsOf, anchor, {
        cadence: 'monthly',
        source: 'CIO Monthly Report (Bloomberg, State Street)',
        cls: 'reported_public',
        why: 'The report prints the market table a month later than the fund figures, so index moves here are not the month the fund performance covers.',
        where: 'Markets & items',
      }),
    );

    // and within it, one row is a quarter behind the rest of the table
    rows.push(
      row('odce', 'Real estate index (NCREIF ODCE, net)', null, anchor, {
        asOfNote: 'latest available quarter',
        cadence: 'quarterly',
        source: 'NCREIF, via the CIO Monthly Report',
        cls: 'stale',
        why: 'Footnote 1: the index is the latest available quarter, so it lags the other rows in the same table.',
        where: 'Markets & items',
      }),
    );
  }

  const macro = CIO_MACRO[v.reportDate];
  if (macro) {
    rows.push(
      row('macro', 'Inflation, labour and the federal funds range', macro.asOf, anchor, {
        cadence: 'monthly',
        source: 'FRED real-time archive',
        cls: 'reported_public',
        why: 'Read as FRED showed them at the month end before the report, so later revisions do not change them.',
        where: 'Markets & items',
      }),
    );

    // the curve is read at the fund's month end, not the report's as-of date: two dates, one page.
    // Per vintage, from that report's own observation — NOT from MACRO_PRINTED, which is the
    // latest report's transcription and would put June 2026 on an April 2025 report.
    rows.push(
      row('curve', 'Treasury yield curve', macro.curve.y10.date, anchor, {
        cadence: 'daily',
        source: 'FRED (H.15), via the CIO Monthly Report',
        cls: 'reported_public',
        why: 'The report reads the curve at the fund’s month end, not at the date the rest of its macro page follows.',
        where: 'Markets & items',
      }),
    );
  }

  const gdp = gdpFor(v.reportDate);
  if (gdp) {
    rows.push(
      row('gdp', 'Quarterly real GDP growth', gdp.asOf, anchor, {
        cadence: 'quarterly',
        source: 'FRED real-time archive (BEA)',
        cls: gdp.stale ? 'stale' : 'reported_public',
        ...(gdp.stale
          ? {
              why: `The report does not redraw this chart every month: it carries FRED as of ${gdp.asOf}, ${monthsApart(gdp.asOf, gdp.reportAsOf)} months older than the rest of its own macro page.`,
            }
          : {}),
        where: 'Markets & items',
      }),
    );
  }

  // valuation lag inside the fund figures themselves, disclosed by the report's own footnotes
  rows.push(
    row('private', 'Private equity and real estate valuations', null, anchor, {
      asOfNote: 'best available, cash-flow adjusted',
      cadence: 'as published',
      source: 'CIO Monthly Report, footnotes 6 / 10',
      cls: 'stale',
      why: 'Carried at best available cash-flow-adjusted market values, so they lag the month end the rest of the fund figures share.',
      where: 'Summary · Positioning',
    }),
  );

  rows.push(
    row('report', 'The report itself', v.reportDate.length === 7 ? null : v.reportDate, anchor, {
      ...(v.reportDate.length === 7 ? { asOfNote: v.reportDate } : {}),
      cadence: 'monthly',
      source: 'Board of Investments',
      cls: 'reported_public',
      why: 'Presented after the month it covers; nothing on the tab can be more current than this.',
      where: 'Masthead',
    }),
  );

  return { anchor, reportDate: v.reportDate, rows };
}

/** How many of the tab's figures are NOT as of the fund month — the fact the panel leads with.
 *  The report's own publication date is excluded: it is context, not a figure. */
export function offAnchor(v: CioVintage): { off: number; total: number } {
  const figures = freshnessFor(v).rows.filter((r) => r.key !== 'report');
  return { off: figures.filter((r) => r.direction !== 'anchor').length, total: figures.length };
}

export function offAnchorNote(v: CioVintage): string {
  const { off, total } = offAnchor(v);
  if (off === 0) return `All ${total} figures on this tab share one as-of date.`;
  return `${off} of ${total} figures carry another date — some ahead of the fund month, some behind it.`;
}

/** The spread the tab's FIGURES cover, oldest to newest. The report's own publication date is
 *  excluded: nothing is reported as of it, so including it would overstate the range. */
export function freshnessSpan(f: Freshness): { from: string; to: string; months: number } | null {
  const dated = f.rows.filter((r) => r.asOf && r.key !== 'report').map((r) => r.asOf!);
  if (!dated.length) return null;
  const from = dated.reduce((a, b) => (a < b ? a : b));
  const to = dated.reduce((a, b) => (a > b ? a : b));
  return { from, to, months: monthsApart(from, to) };
}

export { macroAsOf };
