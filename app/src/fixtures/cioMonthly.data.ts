import type { MacroLine, MacroNotes } from '../lib/cioMacro';
import type { CioNetPosition, OpsStatus } from './cioMonthly';

/**
 * Editorial content of the CIO Monthly Report — the parts a reader writes rather than a table
 * prints (notable items, macro commentary and themes, initiatives, personnel, manager and
 * consultant updates). Hand-maintained for the LATEST report only; the numeric vintages live in
 * `cioVintages.data.ts` and the FRED-backed macro figures in `cioMacro.data.ts` (both
 * generated). `EDITORIAL_FOR` names the report this content belongs to, and a unit test fails
 * when a newer vintage is extracted without refreshing it.
 */

export const EDITORIAL_FOR = '2026-08-12';

export const PERIODS = ['1 M', '3 M', 'FYTD', 'YTD', '1 Y', '3 Y', '5 Y', '10 Y'];

export const BINS = [
  '≤ -6',
  '-6 to -5',
  '-5 to -4',
  '-4 to -3',
  '-3 to -2',
  '-2 to -1',
  '-1 to 0',
  '0 to 1',
  '1 to 2',
  '2 to 3',
  '3 to 4',
  '4 to 5',
  '5 to 6',
  '≥ 6',
];

/** What the August 12, 2026 report printed for the indicators FRED also carries (pp. 4, 6). The
 *  slides show FRED's figures as known on the report's as-of date (cioMacro.data.ts); a unit test
 *  checks them against these, so a typing slip or a report that used another measure is caught.
 *  Months are the observation months the report names ('2026-06' = June 2026). */
export const MACRO_PRINTED = {
  pceMonth: '2026-06',
  pce: 3.7,
  corePce: 3.3,
  fedLow: 3.5,
  fedHigh: 3.75,
  laborMonth: '2026-06',
  unemployment: 4.2,
  participation: 61.5,
  // the yield chart's end labels, p. 6 (3M, 2Yr, 5Yr, 10Yr, 30Yr)
  curveDate: '2026-06-30',
  curve: [3.9, 4.1, 4.2, 4.4, 4.9],
};

/** The report's commentary beside the FRED figures, with its page. */
export const MACRO_NOTES: MacroNotes = {
  pce: 'Easing driven largely by a temporary drop in energy prices after the mid-June ceasefire, since reversed (p. 4)',
  fed: 'Fifth consecutive pause; three dissents in favor of an increase (p. 4)',
};

/** Lines typed from the report because FRED cannot reproduce them: the U.S. Dollar Index the
 *  report prints is not a FRED series (FRED's broad dollar index is a different measure, so it
 *  would not match), and the themes are the CIO's commentary. */
export const MACRO_TYPED: MacroLine[] = [
  {
    l: 'U.S. Dollar Index, YTD to 7/31',
    v: '+1.6%',
    s: 'GBP +0.1 · EUR −1.9 · JPY −0.4 · CAD −2.1 · MXN +3.8 · CNY +3.5 (p. 6)',
  },
  {
    l: 'Themes to watch',
    v: 'Tariffs · AI · rates',
    s: 'Tariffs of 10–12.5% now cover over 99% of U.S. imports; Strait of Hormuz disruption; Q2 earnings beat with AI capex in focus (p. 4)',
  },
];

/** August 12, 2026 report, p. 19 (initiatives, personnel), p. 20 (manager updates), p. 24 (quiet period). */
/** Change in Fiduciary Net Position, p. 21 — TRANSCRIBED from the page, which is an image in
 *  the PDF. `reported_public`: these are the report's own printed figures, read from its chart.
 *  The transcription is checked in cioMonthly.test.ts against the two figures printed beside
 *  them: the months add to the fiscal-year total, and their signs give the month counts. The
 *  page's stacked components (contributions, net investment income, benefits and refunds,
 *  administrative expenses) carry no printed numbers, so only the net line is carried. */
export const NET_POSITION: CioNetPosition = {
  page: 21,
  unit: '$ millions',
  // The page sits in section 04 (Portfolio and Structural), not under Total Fund or OPEB, and the
  // report gives it no entity heading. Scale settles it: the year's months add to $7,841mm, while
  // the whole OPEB Master Trust moved $1,421mm over the same year (pp. 13, 16 of this report and
  // of the August 2025 report). `calculated` from the report's own figures, not printed.
  scope: 'LACERA Pension Plan',
  // The same fiscal year on the investment book: pension market value $85,185mm at June 30, 2025
  // (August 13, 2025 report, p. 8) to $93,916mm at June 30, 2026 (this report, p. 8). It differs
  // from the net position change because it is a different book, which the slide says plainly.
  investmentBookFy: { label: 'FY2026', mm: 8731 },
  // "Total Additions and Deductions in Fiduciary Net Position", month by month
  months: [
    { m: '2025-07', v: -326 },
    { m: '2025-08', v: 880 },
    { m: '2025-09', v: 1168 },
    { m: '2025-10', v: 846 },
    { m: '2025-11', v: 745 },
    { m: '2025-12', v: -123 },
    { m: '2026-01', v: 1350 },
    { m: '2026-02', v: 1307 },
    { m: '2026-03', v: -2457 },
    { m: '2026-04', v: 2651 },
    { m: '2026-05', v: 1664 },
    { m: '2026-06', v: 136 },
  ],
  // "Total Net Position Change Trend", $ billions, with the months that added and took away
  trend: [
    { fy: 'FY2026', bn: 7.8, up: 9, down: 3 },
    { fy: 'FY2025', bn: 7.0, up: 9, down: 3 },
    { fy: 'FY2024', bn: 5.2, up: 8, down: 4 },
  ],
  components: [
    'Employee and employer contributions',
    'Net investment income or loss',
    'Benefits and refunds',
    'Administrative expenses and miscellaneous',
  ],
};

export const OPS: { e: string; item: string; st: OpsStatus; p: number }[] = [
  {
    e: 'Total Fund',
    item: 'April 2024 approved Strategic Asset Allocation implementation',
    st: 'prog',
    p: 19,
  },
  {
    e: 'Total Fund',
    item: 'Adhering to the BOI-approved 2026 Strategic Framework',
    st: 'prog',
    p: 19,
  },
  {
    e: 'Total Fund',
    item: 'Planning for the Strategic Framework and Initiatives Refresh',
    st: 'prog',
    p: 19,
  },
  { e: 'Total Fund', item: 'Risk system onboarding', st: 'prog', p: 19 },
  {
    e: 'OPEB Master Trust',
    item: 'April 2024 approved Strategic Asset Allocation implementation',
    st: 'prog',
    p: 19,
  },
  { e: 'OPEB Master Trust', item: 'Risk system onboarding', st: 'prog', p: 19 },
  {
    e: 'Investments Division',
    item: 'Principal Investment Officer — 1 position',
    st: 'dev',
    p: 19,
  },
  { e: 'Investments Division', item: 'Finance Analyst III — 5 positions', st: 'dev', p: 19 },
  { e: 'Investments Division', item: 'Finance Analyst II — 1 position', st: 'prog', p: 19 },
  {
    e: 'Investments Division',
    item: 'Finance Analyst Fellowship — 2 positions',
    st: 'done',
    p: 19,
  },
  {
    e: 'Manager update',
    item: 'Acadian Asset Management (global equities separate account, $1,023 mm): Alexandre Voitenok appointed co-Chief Investment Officer effective January 1, 2027, after serving as Deputy CIO since 2024',
    st: 'info',
    p: 20,
  },
  {
    e: 'Consultant search',
    item: 'Real Estate Consultant RFP launched Q1 2026, diligence Q1–Q3 2026 — quiet period for respondents (Albourne, Mercer, NEPC, RCLCO, StepStone, Meketa)',
    st: 'quiet',
    p: 24,
  },
];

export const STATUS: Record<OpsStatus, [label: string, cls: string]> = {
  prog: ['In progress', 'prog'],
  dev: ['In development', 'dev'],
  info: ['For attention', 'info'],
  quiet: ['Quiet period', 'quiet'],
  done: ['Completed', 'done'],
};
