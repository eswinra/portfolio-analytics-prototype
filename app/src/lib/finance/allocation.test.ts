import { describe, expect, it } from 'vitest';

import {
  allocationStatus,
  weightsSumOk,
  type AllocationRow,
  type PolicyBandLimits,
} from './allocation';

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
];

// IPS-style explicit bands (Pension Table 1)
const LIMITS: Record<string, PolicyBandLimits> = {
  GROWTH: { min: 0.4, max: 0.56 },
  CREDIT: { min: 0.09, max: 0.17 },
  RAIH: { min: 0.11, max: 0.19 },
  RRM: { min: 0.16, max: 0.32 },
  CASH: { min: 0, max: 0.03 }, // asymmetric: target 1%, +2/−1
};

describe('allocationStatus with explicit min/max bands', () => {
  it('flags within/out against the band, not a symmetric half-width', () => {
    const s = allocationStatus(rows, 11231.2, LIMITS);
    expect(s.find((r) => r.categoryId === 'GROWTH')?.rangeStatus).toBe('within');
    expect(s.find((r) => r.categoryId === 'OVERLAY')?.rangeStatus).toBe('n/a');
  });

  it('handles the asymmetric Cash band correctly (0–3% around a 1% target)', () => {
    const cashHigh = allocationStatus(
      [
        {
          categoryId: 'CASH',
          emvMm: 1,
          actualWeight: 0.035,
          targetWeight: 0.01,
          overUnderPct: 0.025,
        },
      ],
      100,
      LIMITS,
    )[0]!;
    expect(cashHigh.rangeStatus).toBe('out'); // 3.5% > 3% max even though only +2.5% over target
    const cashLow = allocationStatus(
      [
        {
          categoryId: 'CASH',
          emvMm: 0,
          actualWeight: 0.0,
          targetWeight: 0.01,
          overUnderPct: -0.01,
        },
      ],
      100,
      LIMITS,
    )[0]!;
    expect(cashLow.rangeStatus).toBe('within'); // 0% is the exact lower bound
  });

  it('computes distance to the nearer boundary (negative when outside)', () => {
    const s = allocationStatus(rows, 11231.2, LIMITS);
    const growth = s.find((r) => r.categoryId === 'GROWTH')!;
    expect(growth.boundaryDistance).toBeCloseTo(0.56 - 0.4986, 10);
    const breach = allocationStatus(
      [
        {
          categoryId: 'CREDIT',
          emvMm: 1,
          actualWeight: 0.19,
          targetWeight: 0.13,
          overUnderPct: 0.06,
        },
      ],
      100,
      LIMITS,
    )[0]!;
    expect(breach.rangeStatus).toBe('out');
    expect(breach.boundaryDistance).toBeCloseTo(0.17 - 0.19, 10); // negative outside
  });

  it('flags near-bound sleeves within 1.0 pp of a boundary — never breaches', () => {
    const near = allocationStatus(
      [
        {
          categoryId: 'GROWTH',
          emvMm: 1,
          actualWeight: 0.405, // 0.5 pp above the 40% min
          targetWeight: 0.48,
          overUnderPct: -0.075,
        },
      ],
      100,
      LIMITS,
    )[0]!;
    expect(near.rangeStatus).toBe('within');
    expect(near.nearBound).toBe(true);

    const comfortable = allocationStatus(rows, 100, LIMITS);
    expect(comfortable.find((r) => r.categoryId === 'GROWTH')?.nearBound).toBe(false);

    const breach = allocationStatus(
      [
        {
          categoryId: 'GROWTH',
          emvMm: 1,
          actualWeight: 0.39,
          targetWeight: 0.48,
          overUnderPct: -0.09,
        },
      ],
      100,
      LIMITS,
    )[0]!;
    expect(breach.rangeStatus).toBe('out');
    expect(breach.nearBound).toBe(false); // out-of-range is a breach, not a warning
  });

  it('computes over/under dollars from the full total only', () => {
    const s = allocationStatus(rows, 10000, LIMITS);
    expect(s.find((r) => r.categoryId === 'GROWTH')?.overUnderMm).toBeCloseTo(186, 6);
  });

  it('suppresses dollar gaps when total EMV is null (partial-total rule)', () => {
    const s = allocationStatus(rows, null, LIMITS);
    expect(s.every((r) => r.overUnderMm === null)).toBe(true);
  });
});

describe('weightsSumOk', () => {
  it('accepts weights summing to 100% within tolerance', () => {
    const full = [
      ...rows,
      {
        categoryId: 'OTHER',
        emvMm: 10,
        actualWeight: 0.001,
        targetWeight: null,
        overUnderPct: null,
      },
    ];
    expect(weightsSumOk(full, 1e-2)).toBe(true);
  });
  it('rejects weights that do not sum to 100%', () => {
    expect(weightsSumOk(rows.slice(0, 3))).toBe(false);
  });
});
