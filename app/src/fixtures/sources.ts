/**
 * Source registry (audit finding 6): every Dashboard figure resolves to a durable source
 * record — document, page/table, as-of — instead of free-text citation strings. URLs are
 * included only where a stable public link is known; fabricating document URLs is worse
 * than omitting them, so missing links render as document + page text.
 */

export interface SourceRecord {
  id: string;
  /** short label rendered in the citation line */
  label: string;
  doc: string;
  pageTable: string;
  asOf: string;
  url?: string;
}

const ACFR_URL =
  'https://www.lacera.gov/sites/default/files/assets/documents/annual_reports/ACFR-2025.pdf';
// the FY2025 file's front matter puts printed page n at PDF page n + 2, and #page= addresses
// the PDF index — anchoring on the printed number opens the wrong table
const acfrPage = (printed: number) => `${ACFR_URL}#page=${printed + 2}`;

export const SOURCES = {
  PAFR_GROWTH: {
    id: 'PAFR_GROWTH',
    label: '2025 PAFR, pp. 4–7',
    doc: '2025 Popular Annual Financial Report',
    pageTable: 'pp. 4–7 (fiduciary net position, ten years)',
    asOf: 'June 30, 2025',
  },
  PAFR_PENSION: {
    id: 'PAFR_PENSION',
    label: '2025 PAFR, p. 5',
    doc: '2025 Popular Annual Financial Report',
    pageTable: 'p. 5 (Pension Plan)',
    asOf: 'June 30, 2025',
  },
  PAFR_OPEB_ENROLL: {
    id: 'PAFR_OPEB_ENROLL',
    label: '2025 PAFR, p. 6',
    doc: '2025 Popular Annual Financial Report',
    pageTable: 'p. 6 (OPEB enrollment)',
    asOf: 'June 30, 2025',
  },
  PAFR_OPEB: {
    id: 'PAFR_OPEB',
    label: '2025 PAFR, p. 7',
    doc: '2025 Popular Annual Financial Report',
    pageTable: 'p. 7 (OPEB Trust)',
    asOf: 'June 30, 2025',
  },
  PAFR_CHANGES: {
    id: 'PAFR_CHANGES',
    label: '2025 PAFR, p. 4 / p. 7',
    doc: '2025 Popular Annual Financial Report',
    pageTable: 'p. 4 (Pension) / p. 7 (OPEB) — changes in fiduciary net position',
    asOf: 'June 30, 2025',
  },
  IPS_T1: {
    id: 'IPS_T1',
    label: 'IPS Table 1 (restated June 12, 2024)',
    doc: 'Investment Policy Statement / OPEB Investment Policy Statement',
    pageTable: 'Tables 1–2 (approved asset allocation and benchmarks)',
    asOf: 'restated June 12, 2024',
  },
  ACFR_EQ: {
    id: 'ACFR_EQ',
    label: '2025 ACFR, p. 114',
    doc: '2025 Annual Comprehensive Financial Report',
    pageTable: 'p. 114 (largest equity holdings)',
    asOf: 'June 30, 2025',
    url: acfrPage(114),
  },
  ACFR_FI: {
    id: 'ACFR_FI',
    label: '2025 ACFR, p. 115',
    doc: '2025 Annual Comprehensive Financial Report',
    pageTable: 'p. 115 (largest fixed income holdings)',
    asOf: 'June 30, 2025',
    url: acfrPage(115),
  },
  ACFR_FEES: {
    id: 'ACFR_FEES',
    label: '2025 ACFR, p. 116',
    doc: '2025 Annual Comprehensive Financial Report',
    pageTable: 'p. 116 (investment management fees)',
    asOf: 'June 30, 2025',
    url: acfrPage(116),
  },
  ACFR_RETURNS: {
    id: 'ACFR_RETURNS',
    label: '2025 ACFR, pp. 112–113',
    doc: '2025 Annual Comprehensive Financial Report',
    pageTable:
      'pp. 112–113 (total investment rates of return — Pension Plan / OPEB Master Trust: TWR, MWR, assumed rate, funded ratio)',
    asOf: 'June 30, 2025',
    url: acfrPage(112),
  },
  ACFR_TOC: {
    id: 'ACFR_TOC',
    label: '2025 ACFR table of contents',
    doc: '2025 Annual Comprehensive Financial Report',
    pageTable: 'table of contents (tie-out structure)',
    asOf: 'FY2025',
    url: ACFR_URL,
  },
} as const satisfies Record<string, SourceRecord>;

export type SourceId = keyof typeof SOURCES;
