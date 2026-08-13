/**
 * Published FY2025 figures — every value on the redesigned views is QUOTED from a published
 * LACERA document (reported_public in the project's classification): the 2025 Popular Annual
 * Financial Report (PAFR), the 2025 Annual Comprehensive Financial Report (ACFR), and the
 * Pension/OPEB Investment Policy Statements (restated June 12, 2024). Nothing here is a live
 * or operational estimate; the custodian remains the book of record. Ported verbatim from the
 * design handoff (design_handoff_lacera_portfolio_analytics).
 */

export type EntityId = 'PENSION' | 'OPEB';

export interface ChangeRow {
  label: string;
  fy2025: number;
  fy2024: number;
  fy2023: number;
  bold: boolean;
}

export interface MixSlice {
  label: string;
  pct: number;
  /** CSS var reference for the swatch/segment fill */
  color: string;
  note: string;
}

/** Functional-category band: target ± range, ½-step target, actual (null = not published). */
export type Major = [
  name: string,
  target: number,
  range: number,
  halfStep: number,
  actual: number | null,
];

/** IPS Tables 1+2 row: name, target, range, ½-step, benchmark, level (0 top, 1 sub, 2 total). */
export type PolicyRow = [string, string, string, string, string, 0 | 1 | 2];

export interface PublishedEntity {
  label: string;
  /** FY2016–FY2025 fiduciary net position */
  growth: number[];
  growthUnit: string;
  growthNote: string;
  ret: { f: number[]; b: number[] };
  retNote: string;
  trackNote: string;
  chg: ChangeRow[];
  cum: number[];
  cumUnit: string;
  cumEnd: string;
  cumNote: string;
  mix: MixSlice[];
  allocKicker: string;
  allocFoot: string;
  majors: Major[];
  allocViewNote: string;
  pol: PolicyRow[];
  kpis: [kicker: string, value: string, sub: string][];
  flows: [label: string, value: string, bold: boolean][];
  fi: [par: string, name: string, fairValue: string][];
  fees: [cls: string, fy2025: number, fy2024: number, total?: 1][];
  feeNote: string;
}

const chg = (rows: [string, number, number, number, number][]): ChangeRow[] =>
  rows.map(([label, a, b, c, fw]) => ({
    label,
    fy2025: a,
    fy2024: b,
    fy2023: c,
    bold: fw === 600,
  }));

export const PENSION: PublishedEntity = {
  label: 'Pension Plan',
  growth: [47.8, 52.7, 56.3, 58.3, 58.5, 73.0, 70.3, 73.9, 79.2, 86.2],
  growthUnit: '$ billions',
  growthNote:
    'A $38.4 billion net increase over the decade, bringing the Pension Plan to $86.2 billion at June 30, 2025.',
  ret: { f: [9.7, 8.4, 9.8, 7.9], b: [9.7, 8.6, 8.5, 7.4] },
  retNote:
    'Met the policy benchmark over one year, trailed over three, and outperformed over five and ten.',
  trackNote:
    'The three-year period trails the policy benchmark by 0.2 pp — the only trailing horizon. Five- and ten-year results lead by 1.3 and 0.5 pp.',
  chg: chg([
    ['Contributions', 3590, 3370, 3095, 400],
    ['Net investment income', 8299, 6617, 4861, 400],
    ['Total additions', 11889, 9987, 7956, 600],
    ['Benefits and refunds', -4776, -4518, -4281, 400],
    ['Administrative expenses and misc.', -127, -119, -113, 400],
    ['Total deductions', -4903, -4637, -4394, 600],
    ['Net increase in net position', 6986, 5350, 3562, 600],
    ['Net position, beginning of year', 79202, 73852, 70290, 400],
    ['Net position, end of year', 86188, 79202, 73852, 600],
  ]),
  cum: [0.01, 6.2, 10.9, 14.1, 15.5, 31.1, 29.6, 34.4, 41.0, 49.3],
  cumUnit: '$ billions',
  cumEnd: '$49.3B',
  cumNote:
    'Cumulative net investment income since FY2016. Investment income and contributions exceeding expenses have added $38.4 billion to net position over ten years.',
  mix: [
    { label: 'Growth', pct: 48, color: 'var(--accent-700)', note: 'target 48% · range 40–56%' },
    {
      label: 'Risk Reduction & Mitigation',
      pct: 24,
      color: 'var(--accent-500)',
      note: 'target 24% · range 16–32%',
    },
    {
      label: 'Real Assets & Inflation Hedges',
      pct: 14,
      color: 'var(--accent-400)',
      note: 'target 15% · range 11–19%',
    },
    { label: 'Credit', pct: 12, color: 'var(--accent-300)', note: 'target 13% · range 9–17%' },
    { label: 'Overlays & Hedges', pct: 1, color: 'var(--neutral-400)', note: 'no policy weight' },
    { label: 'Other Assets', pct: 1, color: 'var(--neutral-300)', note: 'no policy weight' },
  ],
  allocKicker: 'Actual mix — June 30, 2025',
  allocFoot:
    'All four policy categories sit within their IPS ranges. Detail on the Allocation view.',
  majors: [
    ['Growth', 48, 8, 50.5, 48],
    ['Credit', 13, 4, 12, 12],
    ['Real Assets & Inflation Hedges', 15, 4, 16, 14],
    ['Risk Reduction & Mitigation', 24, 8, 21.5, 24],
  ],
  allocViewNote:
    'Actual weights per the 2025 PAFR. Range status is a factual report — the IPS defines no mechanical trade trigger.',
  pol: [
    ['Growth', '48', '±8', '50.5', 'Custom blend', 0],
    ['Global Equity', '29', '±7', '30.5', 'MSCI ACWI IMI Net', 1],
    ['Private Equity', '17', '±6', '17', 'MSCI ACWI IMI + 200 bps (3-mo lagged)', 1],
    ['Non-Core Private Real Estate', '2', '±2', '3', 'NFI ODCE + 225 bps (3-mo lagged)', 1],
    [
      'Credit',
      '13',
      '±4',
      '12',
      '70% CS Leveraged Loans · 30% Bloomberg US Corp High Yield + 100 bps (1-mo lagged)',
      0,
    ],
    ['Real Assets and Inflation Hedges', '15', '±4', '16', 'Custom blend', 0],
    ['Core Real Estate', '5', '±3', '5.5', 'NFI ODCE (3-mo lagged)', 1],
    [
      'Natural Resources',
      '3',
      '±2',
      '3',
      '65% S&P Global Natural Resources TR (3-mo lagged) · 35% NCREIF Farmland',
      1,
    ],
    [
      'Infrastructure',
      '4',
      '±3',
      '4.5',
      'DJ Brookfield Global Composite Infrastructure TR (3-mo lagged)',
      1,
    ],
    ['TIPS', '3', '±3', '3', 'Bloomberg US TIPS (0–5 yrs)', 1],
    ['Risk Reduction and Mitigation', '24', '±8', '21.5', 'Custom blend', 0],
    ['Investment Grade Bonds', '13', '±8', '10', 'Bloomberg US Aggregate TR', 1],
    ['Diversified Hedge Funds', '8', '±4', '7', 'FTSE 3-mo US T-Bill + 200 bps (1-mo lagged)', 1],
    ['Long-term Government Bonds', '2', '±2', '3.5', 'Bloomberg US Long Treasury Bond', 1],
    ['Cash', '1', '+2/−1', '1', 'FTSE 3-mo US T-Bill', 1],
    ['Overlays and Hedges', '0', '—', '0', 'Cash overlay · currency hedge', 0],
    ['Total Fund', '100', '', '100', 'Custom Blended Policy Benchmark', 2],
  ],
  kpis: [
    ['Fiduciary net position', '$86.2B', '+$7.0B in FY2025 · net investment income $8.3B'],
    ['Net return — 1 year', '9.7%', 'Policy benchmark 9.7% · 5-year 9.8%'],
    ['Funded ratio', '80.9%', 'Valuation 6/30/2024 · UAAL $18.1B'],
    ['Total membership', '198,462', '121,758 active · 76,704 retired'],
  ],
  flows: [
    ['Contributions', '$3,590M', false],
    ['Net investment income', '$8,299M', false],
    ['Benefits, refunds and expenses', '($4,903M)', false],
    ['Net increase in net position', '+$6,986M', true],
  ],
  fi: [
    ['1,754,645,897', 'United States Treasury 0.000% 2025-09-25', '$1,737,083'],
    ['181,129,696', 'JP Morgan Sec LLC Tri-Party Repo', '181,130'],
    ['132,481,545', 'United States Treasury 1.625% 2029-10-15', '134,563'],
    ['128,401,857', 'United States Treasury 2.125% 2029-04-15', '132,441'],
    ['130,495,100', 'United States Treasury 1.625% 2030-04-15', '131,876'],
  ],
  fees: [
    ['Cash and Short-Term', 353, 352],
    ['Commodities', 613, 2082],
    ['Global Equity', 33762, 29557],
    ['Fixed Income', 152134, 89870],
    ['Hedge Funds', 168429, 116197],
    ['Private Equity', 202464, 178052],
    ['Real Assets', 51736, 39251],
    ['Real Estate', 43967, 47712],
    ['Total investment management fees', 653458, 503073, 1],
  ],
  feeNote:
    'Total fees equal ≈0.76% of year-end net position (FY2024: 0.64%); private equity and hedge funds account for 57% of the total.',
};

export const OPEB: PublishedEntity = {
  label: 'OPEB Trust',
  growth: [0.6, 0.7, 0.9, 1.2, 1.5, 2.3, 2.4, 3.1, 4.0, 5.0],
  growthUnit: '$ billions',
  growthNote:
    'From a $448 million initial employer contribution in 2012 to a $5.0 billion trust at June 30, 2025, driven by prefunding contributions and investment gains.',
  ret: { f: [11.1, 10.5, 9.0, 7.8], b: [10.3, 9.6, 8.5, 6.7] },
  retNote: 'The OPEB Master Trust exceeded its policy benchmark for all reported periods.',
  trackNote:
    'The Trust leads its policy benchmark at every horizon — by 0.8, 0.9, 0.5 and 1.1 pp over one, three, five and ten years.',
  chg: chg([
    ['Contributions', 1460, 1316, 1196, 400],
    ['Net investment income', 472, 368, 248, 400],
    ['Total additions', 1932, 1684, 1444, 600],
    ['Service benefits', -873, -797, -745, 400],
    ['Administrative expenses', -1, -1, -1, 400],
    ['Total deductions', -874, -798, -746, 600],
    ['Net increase in net position', 1058, 886, 698, 600],
    ['Net position, beginning of year', 3978, 3092, 2394, 400],
    ['Net position, end of year', 5036, 3978, 3092, 600],
  ]),
  cum: [-8.1, 86.4, 165.2, 227.3, 233.4, 397.1, 685.6, 644.6, 1013.0, 1485.6],
  cumUnit: '$ millions',
  cumEnd: '$1,485.6M',
  cumNote:
    'Cumulative net investment income since FY2016. Contributions presented in the changes table include both prefunding and pay-as-you-go adjustments.',
  mix: [
    { label: 'Growth', pct: 45, color: 'var(--accent-700)', note: '½-step target · range ±10' },
    {
      label: 'Risk Reduction & Mitigation',
      pct: 21.5,
      color: 'var(--accent-500)',
      note: '½-step target · range ±9',
    },
    { label: 'Credit', pct: 17, color: 'var(--accent-300)', note: '½-step target · range ±5' },
    {
      label: 'Real Assets & Inflation Hedges',
      pct: 16.5,
      color: 'var(--accent-400)',
      note: '½-step target · range ±4',
    },
  ],
  allocKicker: 'Policy ½-step targets — 7/1/2024',
  allocFoot:
    'Shown: IPS ½-step policy targets. The PAFR publishes the actual FY2025 mix as a chart (p. 7); it is not reproduced here pending verified figures.',
  majors: [
    ['Growth', 45, 10, 45, null],
    ['Credit', 16, 5, 17, null],
    ['Real Assets & Inflation Hedges', 13, 4, 16.5, null],
    ['Risk Reduction & Mitigation', 26, 9, 21.5, null],
  ],
  allocViewNote:
    'Targets and ranges per the OPEB IPS (restated June 12, 2024). Actual weights are published as a chart in the 2025 PAFR (p. 7) and omitted here pending verified figures.',
  pol: [
    ['Growth', '45', '±10', '45', 'Custom blend', 0],
    ['Global Equity', '40', '±10', '40', 'MSCI ACWI IMI Net', 1],
    ['Private Equity', '5', '±5', '5', 'MSCI ACWI IMI + 200 bps (3-mo lagged)', 1],
    [
      'Credit',
      '16',
      '±5',
      '17',
      '70% CS Leveraged Loans · 30% Bloomberg US Corp High Yield + 100 bps (1-mo lagged)',
      0,
    ],
    ['Real Assets and Inflation Hedges', '13', '±4', '16.5', 'Custom blend', 0],
    ['Real Estate', '5', '±3', '6.5', 'NFI ODCE (3-mo lagged)', 1],
    ['Natural Resources', '2', '±2', '2', 'S&P Global Natural Resources TR', 1],
    [
      'Infrastructure',
      '2',
      '±2',
      '2',
      'DJ Brookfield Global Composite Infrastructure TR (3-mo lagged)',
      1,
    ],
    ['TIPS', '4', '±4', '5', 'Bloomberg US TIPS (0–5 yrs)', 1],
    ['Risk Reduction and Mitigation', '26', '±9', '21.5', 'Custom blend', 0],
    ['Investment Grade Bonds', '19', '±7', '14.5', 'Bloomberg US Aggregate TR', 1],
    ['Long-term Government Bonds', '5', '±5', '5', 'Bloomberg US Long Treasury Bond', 1],
    ['Cash', '2', '±2', '2', 'FTSE 3-mo US T-Bill', 1],
    ['Overlays and Hedges', '0', '—', '0', 'Cash overlay · currency hedge', 0],
    ['Total Fund', '100', '', '100', 'Custom Blended Policy Benchmark', 2],
  ],
  kpis: [
    ['Fiduciary net position', '$5.0B', '+$1.1B in FY2025 · contributions $1.5B'],
    ['Net return — 1 year', '11.1%', 'Policy benchmark 10.3% · +0.8 pp ahead'],
    ['Net return — 10 years', '7.8%', 'Benchmark 6.7% — ahead at every horizon'],
    ['Medical enrollment', '86,637', '93,872 dental/vision · 66,398 death/burial'],
  ],
  flows: [
    ['Contributions', '$1,460M', false],
    ['Net investment income', '$472M', false],
    ['Benefits and expenses', '($874M)', false],
    ['Net increase in net position', '+$1,058M', true],
  ],
  fi: [
    ['102,747,181', 'United States Treasury 0.000% 2025-09-25', '$101,719'],
    ['16,122,515', 'United States Treasury 1.625% 2030-04-15', '16,293'],
    ['14,859,532', 'United States Treasury 1.625% 2029-10-15', '15,093'],
    ['14,402,065', 'United States Treasury 2.125% 2029-04-15', '14,855'],
    ['13,972,800', 'United States Treasury 2.375% 2028-10-15', '14,566'],
  ],
  fees: [
    ['Cash and Short-Term', 40, 31],
    ['Commodities', 20, 210],
    ['Global Equity', 334, 510],
    ['Fixed Income', 1722, 1444],
    ['Private Equity', 1353, 168],
    ['Real Assets', 645, 373],
    ['Real Estate', 3, 6],
    ['Total investment management fees', 4117, 2742, 1],
  ],
  feeNote:
    'Total fees equal ≈0.08% of year-end net position (FY2024: 0.07%); private equity and fixed income account for 75% of the total.',
};

export const publishedFor = (e: EntityId): PublishedEntity => (e === 'OPEB' ? OPEB : PENSION);

/** Pension-only detail (2025 PAFR/ACFR). */
export const PENSION_FUNDED: [date: string, ratio: number, uaal: string][] = [
  ['June 30, 2024', 80.9, '$18,139,694'],
  ['June 30, 2023', 79.9, '$18,236,156'],
  ['June 30, 2022', 79.6, '$17,608,541'],
];
export const PENSION_FUNDED_DELTAS = ['+1.0 pp', '+0.3 pp', '—'];

export const PENSION_MEMBERSHIP: [string, string, string, string, boolean][] = [
  ['Active members', '121,758', '119,961', '117,331', false],
  ['Retired members', '76,704', '74,781', '73,022', false],
  ['Total membership', '198,462', '194,742', '190,353', true],
];

export const OPEB_ENROLLMENT: [string, string, string, string][] = [
  ['Medical insurance', '86,637', '85,071', '83,633'],
  ['Dental/vision insurance', '93,872', '91,920', '89,970'],
  ['Death/burial benefits', '66,398', '64,651', '63,152'],
];

export const OPEB_STORY: [string, string, boolean][] = [
  ['Initial employer contribution (2012)', '$448M', false],
  ['Net position, June 30, 2025', '$5.0B', true],
  ['FY2025 contributions', '$1,460M', false],
  ['FY2025 service benefits paid', '($873M)', false],
];

/** Largest equity holdings — Pension Plan (2025 ACFR p. 114); $ thousands. */
export const PENSION_EQUITY: [shares: string, name: string, fairValue: string][] = [
  ['6,744,278', 'NVIDIA Corporation', '$1,065,528'],
  ['1,946,237', 'Microsoft Corporation', '968,078'],
  ['4,143,788', 'Apple Inc.', '850,181'],
  ['2,634,980', 'Amazon.com Inc.', '578,088'],
  ['3,004,264', 'Alphabet Inc.', '531,086'],
  ['611,858', 'Meta Platforms Inc.', '451,607'],
  ['1,246,529', 'Broadcom Inc.', '343,606'],
  ['2,480,127', 'Exxon Mobil Corporation', '267,358'],
  ['776,301', 'Tesla Inc.', '246,600'],
  ['5,856,273', 'Taiwan Semiconductor Manufacturing Co. Ltd.', '224,501'],
];

export const HORIZONS = ['1 Year', '3 Years', '5 Years', '10 Years'];
export const GROWTH_YEARS = [
  '2016',
  '2017',
  '2018',
  '2019',
  '2020',
  '2021',
  '2022',
  '2023',
  '2024',
  '2025',
];

/** Plain-text board brief (Overview "Copy board brief"). */
export function boardBrief(e: EntityId): string {
  const d = publishedFor(e);
  const P = e === 'PENSION';
  const h = ['1-year', '3-year', '5-year', '10-year'];
  return [
    `LACERA ${d.label} — board brief, FY ended June 30, 2025`,
    `Net position: ${P ? '$86.2B (+$7.0B)' : '$5.0B (+$1.1B)'}`,
    `Returns (net) vs policy benchmark: ${d.ret.f
      .map((f, i) => `${h[i]} ${f.toFixed(1)}% vs ${d.ret.b[i]!.toFixed(1)}%`)
      .join('; ')}`,
    P
      ? 'Funded ratio 80.9% (val. 6/30/2024, Milliman); UAAL $18.1B.'
      : 'Trust ahead of benchmark at every horizon.',
    P
      ? 'Allocation: all four policy categories within IPS ranges.'
      : 'Allocation targets per OPEB IPS (restated 6/12/2024).',
    'Sources: 2025 PAFR/ACFR, IPS. Prototype — not an official LACERA report.',
  ].join('\n');
}
