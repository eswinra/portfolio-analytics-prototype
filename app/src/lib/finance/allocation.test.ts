import { describe, expect, it } from 'vitest';

import { allocationStatus, weightsSumOk, type AllocationRow } from './allocation';

const rows: AllocationRow[] = [
  {
    categoryId: 'GROWTH',
    emvMm: 5605,
    actualWeight: 0.4986,
    targetWeight: 0.48,
    overUnderPct: 0.0186,
  },
  {
    categoryId: 'CREDIT',
    emvMm: 1521.1,
    actualWeight: 0.1353,
    targetWeight: 0.13,
    overUnderPct: 0.0053,
  },
  {
    categoryId: 'RAIH',
    emvMm: 1659.7,
    actualWeight: 0.1476,
    targetWeight: 0.15,
    overUnderPct: -0.0024,
  },
  {
    categoryId: 'RRM',
    emvMm: 2403.7,
    actualWeight: 0.2138,
    targetWeight: 0.24,
    overUnderPct: -0.0262,
  },
  {
    categoryId: 'OVERLAY',
    emvMm: 41.7,
    actualWeight: 0.0037,
    targetWeight: null,
    overUnderPct: null,
  },
  { categoryId: 'OTHER', emvMm: 10, actualWeight: 0.0009, targetWeight: null, overUnderPct: null },
];

describe('allocationStatus', () => {
  it('flags within/out of range against per-category half-widths', () => {
    const s = allocationStatus(rows, 11241.2);
    expect(s.find((r) => r.categoryId === 'GROWTH')?.rangeStatus).toBe('within'); // 1.86% <= 5%
    expect(s.find((r) => r.categoryId === 'RRM')?.rangeStatus).toBe('within'); // 2.62% <= 4%
    expect(s.find((r) => r.categoryId === 'OVERLAY')?.rangeStatus).toBe('n/a');
  });
  it('flags out-of-range breaches', () => {
    const breach = [{ ...rows[1]!, overUnderPct: 0.045 }];
    expect(allocationStatus(breach, 1000)[0]?.rangeStatus).toBe('out'); // 4.5% > 3% credit range
  });
  it('computes over/under dollars from total EMV', () => {
    const s = allocationStatus(rows, 10000);
    expect(s.find((r) => r.categoryId === 'GROWTH')?.overUnderMm).toBeCloseTo(186, 6);
  });
  it('propagates null when total EMV missing', () => {
    const s = allocationStatus(rows, null);
    expect(s[0]?.overUnderMm).toBeNull();
  });
});

describe('weightsSumOk', () => {
  it('accepts weights summing to 100% within tolerance', () => {
    expect(weightsSumOk(rows, 1e-3)).toBe(true);
  });
  it('rejects weights that do not sum to 100%', () => {
    expect(weightsSumOk(rows.slice(0, 3))).toBe(false);
  });
});
