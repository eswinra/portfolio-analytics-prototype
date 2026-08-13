import { describe, expect, it } from 'vitest';

import type { ContractRecord } from '../contract/schema';
import { buildPmSleeves } from './privateMarkets';

function pm(
  sleeve: string,
  type: 'pm_commitment' | 'pm_capital_account',
  metric: string,
  value: number | null,
  extra: Partial<ContractRecord> = {},
): ContractRecord {
  return {
    record_id: `${sleeve}-${metric}`,
    record_type: type,
    entity_id: 'DEMOFUND',
    metric_id: metric,
    category_id: sleeve,
    value,
    unit: '$mm',
    currency: 'USD',
    scale: 'mm',
    as_of_date: '2026-06-30',
    period_start: '',
    period_end: '',
    period_type: '',
    frequency: 'Quarterly',
    classification: 'synthetic',
    source_type: 'workbook',
    source_name: 'PM_Monitoring',
    page_table: '',
    provider: 'test',
    retrieved_date: '2026-06-30',
    book_of_record: '',
    return_method: '',
    gross_net: '',
    valuation_status: 'final',
    benchmark_id: '',
    method_id: '',
    quality_status: 'ok',
    note: '',
    schema_version: '1.3.0',
    entered_by: 'PA-ANALYST-1',
    reviewed_by: 'PA-LEAD-1',
    review_status: 'published',
    ...extra,
  } as ContractRecord;
}

describe('buildPmSleeves', () => {
  it('computes unfunded, DPI and TVPI from primitives — never imported', () => {
    const s = buildPmSleeves([
      pm('PM-A', 'pm_commitment', 'commitment_total', 150),
      pm('PM-A', 'pm_commitment', 'called_itd', 120),
      pm('PM-A', 'pm_capital_account', 'distributed_itd', 95),
      pm('PM-A', 'pm_capital_account', 'nav', 88, {
        valuation_status: 'lagged',
        note: 'valuation as of 2026-03-31 (one-quarter lag)',
      }),
    ])[0]!;
    expect(s.unfundedMm).toBeCloseTo(30, 10);
    expect(s.dpi).toBeCloseTo(95 / 120, 10);
    expect(s.tvpi).toBeCloseTo((95 + 88) / 120, 10);
    expect(s.valuationStatus).toBe('lagged');
    expect(s.lagNote).toContain('2026-03-31');
  });

  it('zero called capital yields null ratios, never zero or Infinity', () => {
    const s = buildPmSleeves([
      pm('PM-C', 'pm_commitment', 'commitment_total', 75),
      pm('PM-C', 'pm_commitment', 'called_itd', 0),
      pm('PM-C', 'pm_capital_account', 'distributed_itd', 0),
      pm('PM-C', 'pm_capital_account', 'nav', 0),
    ])[0]!;
    expect(s.dpi).toBeNull();
    expect(s.tvpi).toBeNull();
    expect(s.unfundedMm).toBeCloseTo(75, 10);
  });

  it('missing primitives propagate as null, not partial math', () => {
    const s = buildPmSleeves([
      pm('PM-B', 'pm_commitment', 'commitment_total', 100),
      pm('PM-B', 'pm_capital_account', 'nav', null, { quality_status: 'missing' }),
    ])[0]!;
    expect(s.unfundedMm).toBeNull(); // called missing
    expect(s.tvpi).toBeNull();
  });
});
