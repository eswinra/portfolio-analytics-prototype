import { z } from 'zod';

/** Data contract schema 1.2.0 — mirrors docs/data-contract.md. */

export const SCHEMA_MAJOR = 1;

export const RECORD_TYPES = [
  'monthly_return',
  'monthly_benchmark_return',
  'period_return',
  'allocation',
  'contribution_qtd',
  'market_close',
  'public_reference',
  'check_result',
  // schema 1.1: quoted IPS policy structure travels with the dataset
  'policy_target',
  'benchmark_definition',
] as const;

export const CLASSIFICATIONS = [
  'reported_public',
  'synthetic',
  'proxy_estimate',
  'calculated',
] as const;

export const PERIOD_TYPES = ['D', 'M', 'Q', 'FY', '1M', 'QTD', 'FYTD', '1Y', 'ITD'] as const;
export const FREQUENCIES = ['Daily', 'Monthly', 'Quarterly', 'Annual', 'Ad Hoc'] as const;
export const QUALITY_STATUSES = ['ok', 'missing'] as const;
export const BOOKS = ['IBOR', 'ABOR', 'n/a'] as const;
export const RETURN_METHODS = ['TWR', 'MWR', 'n/a'] as const;
export const GROSS_NET = ['gross', 'net', 'n/a'] as const;
export const SOURCE_TYPES = [
  'workbook',
  'public_report',
  'synthetic_generator',
  'user_import',
] as const;
/** schema 1.2: review workflow states ('' in a file is read as n/a) */
export const REVIEW_STATUSES = ['draft', 'reviewed', 'published', 'n/a'] as const;

export const REQUIRED_COLUMNS = [
  'record_id',
  'record_type',
  'entity_id',
  'metric_id',
  'category_id',
  'value',
  'unit',
  'currency',
  'scale',
  'as_of_date',
  'period_start',
  'period_end',
  'period_type',
  'frequency',
  'classification',
  'source_type',
  'source_name',
  'page_table',
  'provider',
  'retrieved_date',
  'book_of_record',
  'return_method',
  'gross_net',
  'valuation_status',
  'benchmark_id',
  'method_id',
  'quality_status',
  'note',
  'schema_version',
] as const;

/** schema 1.2 provenance columns — a file carries all three or none (V02). */
export const PROVENANCE_COLUMNS = ['entered_by', 'reviewed_by', 'review_status'] as const;
export const COLUMNS_V12 = [...REQUIRED_COLUMNS, ...PROVENANCE_COLUMNS] as const;

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'expected ISO date YYYY-MM-DD')
  .refine((s) => !Number.isNaN(Date.parse(s)), 'invalid calendar date');

const optionalIsoDate = z.union([isoDate, z.literal('')]);

export const rawRecordSchema = z.object({
  record_id: z.string().min(1),
  record_type: z.enum(RECORD_TYPES),
  entity_id: z.string().min(1),
  metric_id: z.string().min(1),
  category_id: z.string(),
  value: z.string(),
  unit: z.string().min(1),
  currency: z.string().min(1),
  scale: z.string().min(1),
  as_of_date: isoDate,
  period_start: optionalIsoDate,
  period_end: optionalIsoDate,
  period_type: z.union([z.enum(PERIOD_TYPES), z.literal('')]),
  frequency: z.enum(FREQUENCIES),
  classification: z.enum(CLASSIFICATIONS),
  source_type: z.enum(SOURCE_TYPES),
  source_name: z.string().min(1),
  page_table: z.string(),
  provider: z.string().min(1),
  retrieved_date: isoDate,
  book_of_record: z.union([z.enum(BOOKS), z.literal('')]),
  return_method: z.union([z.enum(RETURN_METHODS), z.literal('')]),
  gross_net: z.union([z.enum(GROSS_NET), z.literal('')]),
  valuation_status: z.string(),
  benchmark_id: z.string(),
  method_id: z.string(),
  quality_status: z.enum(QUALITY_STATUSES),
  note: z.string(),
  schema_version: z.string().regex(/^\d+\.\d+\.\d+$/, 'expected semver'),
  // schema 1.2 provenance — absent in 1.0/1.1 files (header-gated in the parser, V02)
  entered_by: z.string().optional(),
  reviewed_by: z.string().optional(),
  review_status: z.union([z.enum(REVIEW_STATUSES), z.literal('')]).optional(),
});

export type RawRecord = z.infer<typeof rawRecordSchema>;
export type ReviewStatus = (typeof REVIEW_STATUSES)[number];

/** Parsed record: value resolved to number | status string | null(missing); provenance
 *  normalized to '' for pre-1.2 files so views never branch on undefined. */
export interface ContractRecord extends Omit<
  RawRecord,
  'value' | 'entered_by' | 'reviewed_by' | 'review_status'
> {
  value: number | string | null;
  entered_by: string;
  reviewed_by: string;
  review_status: ReviewStatus | '';
}

export type RecordType = (typeof RECORD_TYPES)[number];
export type Classification = (typeof CLASSIFICATIONS)[number];
export type QualityStatus = (typeof QUALITY_STATUSES)[number];

export const CATEGORY_LABELS: Record<string, string> = {
  GROWTH: 'Growth',
  CREDIT: 'Credit',
  RAIH: 'Real Assets & Inflation Hedges',
  RRM: 'Risk Reduction & Mitigation',
  OVERLAY: 'Overlays & Hedges',
  OTHER: 'Other Asset',
  TOTAL: 'Total fund (synthetic)',
};

export const CATEGORY_ORDER = ['GROWTH', 'CREDIT', 'RAIH', 'RRM', 'OVERLAY', 'OTHER'] as const;
