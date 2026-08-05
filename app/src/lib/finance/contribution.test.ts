import { describe, expect, it } from 'vitest';

import {
  CONTRIBUTION_TOLERANCE,
  reconcileContribution,
  weightedContribution,
} from './contribution';

describe('weightedContribution', () => {
  it('multiplies beginning weight by return', () => {
    expect(weightedContribution(0.48, 0.02)).toBeCloseTo(0.0096, 12);
  });
  it('rejects invalid beginning weights', () => {
    expect(() => weightedContribution(-0.1, 0.02)).toThrow(RangeError);
    expect(() => weightedContribution(1.2, 0.02)).toThrow(RangeError);
    expect(() => weightedContribution(Number.NaN, 0.02)).toThrow(RangeError);
  });
});

describe('reconcileContribution', () => {
  const rows = [
    { categoryId: 'GROWTH', contribution: 0.0367 },
    { categoryId: 'CREDIT', contribution: 0.0007 },
    { categoryId: 'RAIH', contribution: 0.0052 },
    { categoryId: 'RRM', contribution: -0.0015 },
  ];
  it('passes when residual is within tolerance', () => {
    const chain = 0.0416; // arithmetic total 0.0411 → residual 5 bps
    const r = reconcileContribution(rows, chain);
    expect(r.arithmeticTotal).toBeCloseTo(0.0411, 10);
    expect(r.residual).toBeCloseTo(0.0005, 10);
    expect(r.status).toBe('PASS');
  });
  it('fails when residual exceeds tolerance', () => {
    const r = reconcileContribution(rows, 0.0431); // residual 20 bps
    expect(r.status).toBe('FAIL');
  });
  it('treats the tolerance boundary as PASS (FP-safe: 1 ulp inside)', () => {
    const arith = rows.reduce((a, x) => a + x.contribution, 0);
    const r = reconcileContribution(rows, arith + CONTRIBUTION_TOLERANCE * (1 - 1e-12));
    expect(r.status).toBe('PASS');
  });
  it('fails just outside the tolerance in either direction', () => {
    const arith = rows.reduce((a, x) => a + x.contribution, 0);
    expect(reconcileContribution(rows, arith + CONTRIBUTION_TOLERANCE + 1e-6).status).toBe('FAIL');
    expect(reconcileContribution(rows, arith - CONTRIBUTION_TOLERANCE - 1e-6).status).toBe('FAIL');
  });
});
