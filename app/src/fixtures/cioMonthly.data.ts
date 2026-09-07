import type { OpsStatus } from './cioMonthly';

/**
 * Editorial content of the CIO Monthly Report — the parts a reader writes rather than a table
 * prints (notable items, key macro indicators, initiatives, personnel, manager and consultant
 * updates). Hand-maintained for the LATEST report only; the numeric vintages live in
 * `cioVintages.data.ts` (generated). `EDITORIAL_FOR` names the report this content belongs to,
 * and a unit test fails when a newer vintage is extracted without refreshing it.
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

/** August 12, 2026 report, pp. 4 and 6 (Bloomberg, St. Louis Federal Reserve). */
export const MACRO: { l: string; v: string; s: string }[] = [
  {
    l: 'PCE inflation, June 2026',
    v: '3.7% y/y',
    s: 'Core 3.3%; easing driven largely by a temporary drop in energy prices after the mid-June ceasefire, since reversed (p. 4)',
  },
  {
    l: 'Federal funds rate, July meeting',
    v: '3.50–3.75%',
    s: 'Fifth consecutive pause; three dissents in favor of an increase (p. 4)',
  },
  {
    l: 'U.S. Dollar Index, YTD to 7/31',
    v: '+1.6%',
    s: 'GBP +0.1 · EUR −1.9 · JPY −0.4 · CAD −2.1 · MXN +3.8 · CNY +3.5 (p. 6)',
  },
  {
    l: 'Unemployment and participation',
    v: '4.2% · 61.5%',
    s: 'Unemployment rate and labor force participation, latest print (p. 6)',
  },
  {
    l: 'Themes to watch',
    v: 'Tariffs · AI · rates',
    s: 'Tariffs of 10–12.5% now cover over 99% of U.S. imports; Strait of Hormuz disruption; Q2 earnings beat with AI capex in focus (p. 4)',
  },
];

/** August 12, 2026 report, p. 19 (initiatives, personnel), p. 20 (manager updates), p. 24 (quiet period). */
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
