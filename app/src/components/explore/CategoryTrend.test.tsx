// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { CIO_VINTAGES, cioFor, monthYear } from '../../fixtures/cioMonthly';
import { cioHistory } from '../../lib/cioHistory';
import { bandsFor } from '../../lib/crossFilter';

import { CategoryTrend } from './CategoryTrend';

const history = cioHistory(CIO_VINTAGES, (v) => cioFor('PENSION', v));
const band = bandsFor('PENSION').growth!;
const noop = () => undefined;
const current = history.months.length - 1;

afterEach(cleanup);

const charts = () =>
  [...document.querySelectorAll('svg.x-chart')].map((s) => s.getAttribute('aria-label'));
const headers = () => [...document.querySelectorAll('.x-figures th')].map((th) => th.textContent);

describe('one category across the reports', () => {
  it('Explore shows both histories', () => {
    render(
      <CategoryTrend
        history={history}
        cat="growth"
        current={current}
        band={band}
        onSelectMonth={noop}
      />,
    );
    expect(charts()).toHaveLength(2);
    expect(headers()).toEqual([
      'Month',
      'Return',
      'Benchmark',
      'Excess',
      'Weight',
      'Target',
      'Market value',
    ]);
  });

  it('Performance shows the returns only, and says how many months beat the benchmark', () => {
    render(
      <CategoryTrend
        history={history}
        cat="growth"
        current={current}
        band={band}
        onSelectMonth={noop}
        show="return"
      />,
    );
    expect(charts()).toEqual([expect.stringContaining('one-month return and benchmark')]);
    expect(headers()).toEqual(['Month', 'Return', 'Benchmark', 'Excess']);
    const lede = document.querySelector('.x-lede')!.textContent!;
    expect(lede).toMatch(/^Growth beat its benchmark in \d+ of \d+ months\.$/);
  });

  it('Positioning shows the weight only, with the nearest it came to a bound', () => {
    render(
      <CategoryTrend
        history={history}
        cat="growth"
        current={current}
        band={band}
        onSelectMonth={noop}
        show="weight"
      />,
    );
    expect(charts()).toEqual([expect.stringContaining('weight against policy target')]);
    expect(headers()).toEqual(['Month', 'Weight', 'Target', 'Market value']);
    const lede = document.querySelector('.x-lede')!.textContent!;
    expect(lede).not.toMatch(/beat its benchmark/);

    // the sentence's figures, worked out here independently
    const s = history.series.growth;
    const weights = s.map((p) => p.weight).filter((w): w is number => w !== null);
    let best = { i: -1, dist: Infinity, bound: '' };
    s.forEach((p, i) => {
      if (p.weight === null) return;
      const lower = p.weight - band.min;
      const upper = band.max - p.weight;
      const dist = Math.min(lower, upper);
      if (dist < best.dist) best = { i, dist, bound: lower <= upper ? 'lower' : 'upper' };
    });
    expect(lede).toContain(
      `Across ${weights.length} reports its weight ran from ${Math.min(...weights).toFixed(1)}% to ${Math.max(...weights).toFixed(1)}%`,
    );
    expect(lede).toContain(
      `the nearest it came to a bound was ${best.dist.toFixed(1)} pp from the ${best.bound} bound, in ${monthYear(history.months[best.i]!)}.`,
    );
  });

  it('a month without a report is said so, across the columns on show', () => {
    render(
      <CategoryTrend
        history={history}
        cat="growth"
        current={current}
        band={band}
        onSelectMonth={noop}
        show="return"
      />,
    );
    const gap = screen.queryAllByText('No report carries this month');
    // the series has one month missing (November 2025)
    expect(gap.length).toBeGreaterThan(0);
    expect(gap).toHaveLength(history.reports.filter((r) => r === null).length);
    for (const cell of gap) expect(cell.getAttribute('colspan')).toBe('3');
  });
});
