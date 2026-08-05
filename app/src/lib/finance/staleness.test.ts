import { describe, expect, it } from 'vitest';

import { dataState, daysBetween } from './staleness';

describe('daysBetween', () => {
  it('counts calendar days', () => {
    expect(daysBetween('2026-06-26', '2026-06-30')).toBe(4);
  });
});

describe('dataState', () => {
  it('missing wins over everything', () => {
    expect(dataState(true, '2026-06-30', '2026-06-30', 'Daily')).toBe('missing');
  });
  it('daily data: Friday close viewed Monday is current, older is stale', () => {
    expect(dataState(false, '2026-06-27', '2026-06-30', 'Daily')).toBe('current'); // 3 days
    expect(dataState(false, '2026-06-26', '2026-06-30', 'Daily')).toBe('stale'); // 4 days
  });
  it('monthly data allows 45 days', () => {
    expect(dataState(false, '2026-05-31', '2026-06-30', 'Monthly')).toBe('current');
    expect(dataState(false, '2026-04-30', '2026-06-30', 'Monthly')).toBe('stale');
  });
  it('ad hoc never goes stale', () => {
    expect(dataState(false, '2020-01-01', '2026-06-30', 'Ad Hoc')).toBe('current');
  });
});
