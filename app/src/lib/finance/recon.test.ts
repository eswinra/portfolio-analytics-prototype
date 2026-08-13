import { describe, expect, it } from 'vitest';

import type { ContractRecord } from '../contract/schema';
import { buildReconPairs } from './recon';

/** Minimal record factory — only the fields the recon builder reads. */
function rec(over: Partial<ContractRecord>): ContractRecord {
  return {
    record_id: over.record_id ?? 'R1',
    record_type: 'recon_value',
    entity_id: 'DEMOFUND',
    metric_id: 'nav_total',
    category_id: 'TOTAL',
    value: 100,
    unit: '$mm',
    currency: 'USD',
    scale: 'mm',
    as_of_date: '2026-06-30',
    period_start: '',
    period_end: '',
    period_type: '',
    frequency: 'Ad Hoc',
    classification: 'synthetic',
    source_type: 'workbook',
    source_name: 'internal_book',
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
    ...over,
  } as ContractRecord;
}

const tol = rec({
  record_id: 'T1',
  record_type: 'tolerance_definition',
  metric_id: 'nav_total',
  category_id: '',
  value: 0.5,
});

describe('buildReconPairs', () => {
  it('joins two sides, computes variance, and applies tolerance-as-data', () => {
    const pairs = buildReconPairs(
      [
        tol,
        rec({ record_id: 'A', source_name: 'internal_book', value: 100 }),
        rec({ record_id: 'B', source_name: 'custodian_feed', value: 100.3 }),
      ],
      '2026-06-30',
    );
    expect(pairs).toHaveLength(1);
    const p = pairs[0]!;
    expect(p.variance).toBeCloseTo(0.3, 10);
    expect(p.toleranceAbs).toBe(0.5);
    expect(p.status).toBe('within');
    expect(p.ageDays).toBe(0);
  });

  it('flags a break when variance exceeds tolerance', () => {
    const pairs = buildReconPairs(
      [
        tol,
        rec({ record_id: 'A', value: 100 }),
        rec({ record_id: 'B', source_name: 'custodian_feed', value: 100.8 }),
      ],
      '2026-07-02',
    );
    expect(pairs[0]?.status).toBe('outside');
    expect(pairs[0]?.ageDays).toBe(2);
  });

  it('one-sided pairs are incomplete with no computed variance', () => {
    const pairs = buildReconPairs([tol, rec({ record_id: 'A' })], '2026-06-30');
    expect(pairs[0]?.status).toBe('incomplete');
    expect(pairs[0]?.variance).toBeNull();
  });

  it('a pair without a tolerance definition says so instead of guessing', () => {
    const pairs = buildReconPairs(
      [
        rec({ record_id: 'A', metric_id: 'fee_total', value: 10 }),
        rec({ record_id: 'B', metric_id: 'fee_total', source_name: 'custodian_feed', value: 11 }),
      ],
      '2026-06-30',
    );
    expect(pairs[0]?.status).toBe('no_tolerance');
    expect(pairs[0]?.variance).toBeCloseTo(1, 10);
  });

  it('sorts breaks first', () => {
    const pairs = buildReconPairs(
      [
        tol,
        rec({ record_id: 'A', value: 100 }),
        rec({ record_id: 'B', source_name: 'custodian_feed', value: 100.1 }),
        rec({ record_id: 'C', metric_id: 'emv_category', category_id: 'CREDIT', value: 50 }),
        rec({
          record_id: 'D',
          metric_id: 'emv_category',
          category_id: 'CREDIT',
          source_name: 'custodian_feed',
          value: 51,
        }),
        rec({
          record_id: 'T2',
          record_type: 'tolerance_definition',
          metric_id: 'emv_category',
          value: 0.3,
        }),
      ],
      '2026-06-30',
    );
    expect(pairs[0]?.metricId).toBe('emv_category');
    expect(pairs[0]?.status).toBe('outside');
    expect(pairs[1]?.status).toBe('within');
  });
});
