import {
  BOOKS,
  CLASSIFICATIONS,
  COLUMNS_V12,
  FREQUENCIES,
  GROSS_NET,
  PERIOD_TYPES,
  QUALITY_STATUSES,
  RECORD_TYPES,
  RETURN_METHODS,
  REVIEW_STATUSES,
  SOURCE_TYPES,
} from './schema';

/**
 * In-app data dictionary. Typed against COLUMNS_V12 so adding a column without documenting it
 * is a COMPILE error, and enum token lists are the schema constants themselves — the panel can
 * never drift from the validator.
 */

export interface ColumnDoc {
  desc: string;
  /** closed token list, when the column is an enum — sourced from schema constants only */
  enumTokens?: readonly string[];
  /** the validation rule(s) most likely to fire on this column */
  rule?: string;
  example?: string;
}

export const COLUMN_DOCS: Record<(typeof COLUMNS_V12)[number], ColumnDoc> = {
  record_id: {
    desc: 'Unique row id within the file.',
    rule: 'V04 unique',
    example: 'REC-0001',
  },
  record_type: {
    desc: 'Routes the row to its view and rule set.',
    enumTokens: RECORD_TYPES,
    rule: 'V06 enum',
  },
  entity_id: {
    desc: 'Portfolio entity the row describes. One portfolio entity per file; public_reference rows cite their real source entity instead.',
    rule: 'V17 one entity/file',
    example: 'DEMOFUND',
  },
  metric_id: {
    desc: 'What is measured (net_return_m, weight_actual, close, …).',
    example: 'net_return_m',
  },
  category_id: {
    desc: 'Asset category, proxy id, or check id the metric applies to; blank for fund-level rows.',
    example: 'GROWTH',
  },
  value: {
    desc: 'The observation. Returns and weights are DECIMALS (0.0417 = 4.17%). check_result rows carry PASS/WARN/FAIL. Blank requires quality_status=missing.',
    rule: 'V07 numeric · V08 blank↔missing · V10 |return| ≤ 0.60',
    example: '0.0417',
  },
  unit: {
    desc: 'Unit of value: % (decimal fraction), $mm, px (index level), x (ratio).',
    example: '%',
  },
  currency: { desc: 'ISO currency of the value.', example: 'USD' },
  scale: {
    desc: 'Numeric scale of the value: 1, k, mm, bn (market values are $mm).',
    example: 'mm',
  },
  as_of_date: {
    desc: 'Observation date (ISO). Drives staleness and trend windows.',
    rule: 'V01 ISO date',
  },
  period_start: {
    desc: 'Period start — required with period_end on return/contribution rows.',
    rule: 'V09 span',
  },
  period_end: { desc: 'Period end (≥ period_start).', rule: 'V09 span' },
  period_type: {
    desc: 'Period label; blank on rows without a period.',
    enumTokens: PERIOD_TYPES,
    rule: 'V06 enum',
  },
  frequency: {
    desc: 'Native reporting frequency — vintages are never silently mixed.',
    enumTokens: FREQUENCIES,
    rule: 'V06 enum',
  },
  classification: {
    desc: 'Origin of the value. reported_public is confined to quotation record types.',
    enumTokens: CLASSIFICATIONS,
    rule: 'V15 confinement',
  },
  source_type: {
    desc: 'Producing channel of the row.',
    enumTokens: SOURCE_TYPES,
    rule: 'V19 (user_import rows need entered_by in 1.2)',
  },
  source_name: {
    desc: 'Sheet, system, or document the value came from.',
    example: 'Inputs_Portfolio',
  },
  page_table: {
    desc: 'Page/table citation (public quotes) or generator note.',
    example: 'Appendix Table 1',
  },
  provider: { desc: 'Who produced the source.', example: 'synthetic generator' },
  retrieved_date: { desc: 'When the value was captured (ISO).', rule: 'V11 sanity (warn)' },
  book_of_record: {
    desc: 'Investment vs Accounting book; n/a where not applicable.',
    enumTokens: BOOKS,
    rule: 'V06 enum',
  },
  return_method: {
    desc: 'Return methodology of the row (calculation method lives in method_id).',
    enumTokens: RETURN_METHODS,
    rule: 'V06 enum',
  },
  gross_net: {
    desc: 'Fee basis of a return.',
    enumTokens: GROSS_NET,
    rule: 'V06 enum',
  },
  valuation_status: {
    desc: 'Valuation state of the value (final, preliminary, lagged).',
    example: 'final',
  },
  benchmark_id: { desc: 'Benchmark the row references, when any.', example: 'BM-TOTAL' },
  method_id: {
    desc: 'Named calculation method (chain_linked, bop_weighted_sum, …) — documentation pointer, not an enum.',
    example: 'chain_linked',
  },
  quality_status: {
    desc: 'Data-quality state. missing always wins: a flagged value is discarded, never rendered.',
    enumTokens: QUALITY_STATUSES,
    rule: 'V08 blank↔missing',
  },
  note: { desc: 'Free-text annotation (proxy read-through mapping, comments).' },
  schema_version: {
    desc: 'Contract semver. Major must be 1; minor must match the column set (29 cols = 1.0/1.1, 32 cols = 1.2).',
    rule: 'V03 major · V02 column set',
    example: '1.2.0',
  },
  entered_by: {
    desc: 'Who keyed the row (initials or role label). Public fixtures use synthetic labels only.',
    rule: 'V19 required on user_import (1.2)',
    example: 'PA-ANALYST-1',
  },
  reviewed_by: {
    desc: 'Who reviewed the row. Required once review_status is reviewed/published.',
    rule: 'V20 reviewer named',
    example: 'PA-LEAD-1',
  },
  review_status: {
    desc: 'Review workflow state; any draft row raises the draft banner. Blank reads as n/a.',
    enumTokens: REVIEW_STATUSES,
    rule: 'V21 enum',
  },
};

export const DICTIONARY_COLUMNS = COLUMNS_V12;
