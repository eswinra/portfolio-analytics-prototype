import { describe, expect, it } from 'vitest';

import { policyReadThrough, type ProxyReturn } from './readThrough';

const rows: ProxyReturn[] = [
  {
    proxyId: 'P1',
    classId: 'GLOBAL_EQ',
    classLabel: 'Global Equity',
    weight: 0.305,
    dailyReturn: 0.01,
  },
  { proxyId: 'P2', classId: 'IG_BONDS', classLabel: 'IG Bonds', weight: 0.1, dailyReturn: -0.002 },
  {
    proxyId: 'P3',
    classId: 'NAT_RES',
    classLabel: 'Natural Resources',
    weight: 0.03,
    dailyReturn: null,
  },
];

describe('policyReadThrough', () => {
  it('computes fund-level impact as Σ w×r over priced classes only', () => {
    const r = policyReadThrough(rows);
    expect(r.fundLevelImpact).toBeCloseTo(0.305 * 0.01 + 0.1 * -0.002, 12);
  });

  it('reports coverage in policy-weight terms, excluding unpriced classes', () => {
    const r = policyReadThrough(rows);
    expect(r.coverage).toBeCloseTo(0.405, 12);
    expect(r.unpriced).toEqual([{ classLabel: 'Natural Resources', weight: 0.03 }]);
  });

  it('covered-basket return renormalizes by covered weight', () => {
    const r = policyReadThrough(rows);
    expect(r.coveredBasketReturn).toBeCloseTo((0.305 * 0.01 + 0.1 * -0.002) / 0.405, 12);
  });

  it('never imputes zero for unpriced classes (all-unpriced → null, coverage 0)', () => {
    const r = policyReadThrough(rows.map((x) => ({ ...x, dailyReturn: null })));
    expect(r.fundLevelImpact).toBeNull();
    expect(r.coveredBasketReturn).toBeNull();
    expect(r.coverage).toBe(0);
    expect(r.unpriced).toHaveLength(3);
  });

  it('rejects invalid policy weights', () => {
    expect(() => policyReadThrough([{ ...rows[0]!, weight: 1.2 }])).toThrow(RangeError);
  });
});
