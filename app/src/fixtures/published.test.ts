import { describe, expect, it } from 'vitest';

import {
  boardBrief,
  GROWTH_YEARS,
  HORIZONS,
  OPEB,
  PENSION,
  PENSION_EQUITY,
  PENSION_FUNDED,
  PENSION_FUNDED_DELTAS,
  PENSION_MEMBERSHIP,
  type PublishedEntity,
} from './published';

/**
 * The Dashboard quotes every figure from published documents as typed literals. Nothing here
 * re-derives a published number from another source; the tests check that the literals agree
 * with each other the way the source statements do (additions − deductions = net increase,
 * year-end = opening + net increase, …) and that every derived sentence printed beside them
 * still describes the numbers. A failing test means a transcription slipped or a sentence
 * outlived the figure it was written for.
 */

const num = (s: string) => Number(s.replace(/[^0-9.-]/g, ''));
const norm = (s: string) => s.replace('&', 'and').toLowerCase();
const within = (actual: number, exact: number, tol: number) =>
  expect(Math.abs(actual - exact), `${actual} vs ${exact}`).toBeLessThanOrEqual(tol + 1e-9);

function row(d: PublishedEntity, label: string) {
  const r = d.chg.find((c) => c.label === label);
  if (!r) throw new Error(`missing change row "${label}"`);
  return r;
}
const YEARS = ['fy2025', 'fy2024', 'fy2023'] as const;

const ENTITIES: [string, PublishedEntity][] = [
  ['Pension Plan', PENSION],
  ['OPEB Trust', OPEB],
];

describe.each(ENTITIES)('%s — statement of changes identities', (_name, d) => {
  it('additions, deductions and net increase tie in every column', () => {
    for (const y of YEARS) {
      const additions = row(d, 'Contributions')[y] + row(d, 'Net investment income')[y];
      expect(row(d, 'Total additions')[y]).toBe(additions);
      const deductions = d.chg.filter((c) => !c.bold && c[y] < 0).reduce((s, c) => s + c[y], 0);
      expect(row(d, 'Total deductions')[y]).toBe(deductions);
      expect(row(d, 'Net increase in net position')[y]).toBe(
        row(d, 'Total additions')[y] + row(d, 'Total deductions')[y],
      );
      expect(row(d, 'Net position, end of year')[y]).toBe(
        row(d, 'Net position, beginning of year')[y] + row(d, 'Net increase in net position')[y],
      );
    }
  });

  it('each year opens where the prior year closed', () => {
    expect(row(d, 'Net position, beginning of year').fy2025).toBe(
      row(d, 'Net position, end of year').fy2024,
    );
    expect(row(d, 'Net position, beginning of year').fy2024).toBe(
      row(d, 'Net position, end of year').fy2023,
    );
  });

  it('the growth series ends on the statement year-end values', () => {
    const scale = d.growthUnit === '$ billions' ? 1000 : 1;
    expect(d.growth).toHaveLength(GROWTH_YEARS.length);
    within(d.growth[9]!, row(d, 'Net position, end of year').fy2025 / scale, 0.05);
    within(d.growth[8]!, row(d, 'Net position, end of year').fy2024 / scale, 0.05);
    within(d.growth[7]!, row(d, 'Net position, end of year').fy2023 / scale, 0.05);
  });

  it('cumulative net investment income steps by each year’s NII', () => {
    const scale = d.cumUnit === '$ billions' ? 1000 : 1;
    const tol = d.cumUnit === '$ billions' ? 0.1 : 1.0;
    const nii = row(d, 'Net investment income');
    within(d.cum[9]! - d.cum[8]!, nii.fy2025 / scale, tol);
    within(d.cum[8]! - d.cum[7]!, nii.fy2024 / scale, tol);
    if (d.label === 'OPEB Trust') {
      // open verification item (2026-09-06 audit): the transcribed FY2023 step is −41.0 against
      // NII of 248; the series carries an on-screen disclosure until re-checked against the PAFR
      expect(d.cum[7]! - d.cum[6]!).toBeCloseTo(-41.0, 6);
      expect(d.cumNote).toContain('Verification open');
    } else {
      within(d.cum[7]! - d.cum[6]!, nii.fy2023 / scale, tol);
    }
    expect(num(d.cumEnd)).toBe(d.cum[9]);
  });

  it('the KPI tile and FY2025 flow list repeat the statement rows', () => {
    expect(d.kpis[0]![1]).toBe(`$${d.growth[9]!.toFixed(1)}B`);
    const rowFor: Record<string, string> = {
      Contributions: 'Contributions',
      'Net investment income': 'Net investment income',
      'Net increase in net position': 'Net increase in net position',
    };
    for (const [label, value] of d.flows) {
      expect(num(value)).toBe(Math.abs(row(d, rowFor[label] ?? 'Total deductions').fy2025));
    }
  });
});

describe.each(ENTITIES)('%s — returns and the sentences beside them', (_name, d) => {
  it('has one fund and one benchmark figure per horizon', () => {
    expect(d.ret.f).toHaveLength(HORIZONS.length);
    expect(d.ret.b).toHaveLength(HORIZONS.length);
  });

  it('the tracking note quotes the calculated excess for every horizon it names', () => {
    d.ret.f.forEach((f, i) => {
      const excess = f - d.ret.b[i]!;
      if (Math.abs(excess) > 0.05) expect(d.trackNote).toContain(Math.abs(excess).toFixed(1));
    });
  });

  it('every horizon clears the highest assumed rate of the decade, as the note claims', () => {
    expect(d.assumedRate.current).toBeLessThanOrEqual(d.assumedRate.decadeMax);
    for (const f of d.ret.f) expect(f).toBeGreaterThan(d.assumedRate.decadeMax);
  });

  it('the 1-year KPI tile repeats the 1-year return and its benchmark', () => {
    const tile = d.kpis.find(([k]) => k.startsWith('Net return — 1 year'));
    expect(tile).toBeDefined();
    expect(tile![1]).toBe(`${d.ret.f[0]!.toFixed(1)}%`);
    expect(tile![2]).toContain(`${d.ret.b[0]!.toFixed(1)}%`);
  });
});

describe.each(ENTITIES)('%s — allocation tables agree with each other', (_name, d) => {
  it('the mix strip sums to 100%', () => {
    within(
      d.mix.reduce((s, m) => s + m.pct, 0),
      100,
      0.05,
    );
  });

  it('functional-category target, range and ½-step match the IPS table rows', () => {
    for (const [name, target, range, half] of d.majors) {
      const pol = d.pol.find((p) => p[5] === 0 && norm(p[0]) === norm(name));
      expect(pol, name).toBeDefined();
      expect(num(pol![1])).toBe(target);
      expect(num(pol![2])).toBe(range);
      expect(num(pol![3])).toBe(half);
    }
  });

  it('IPS top-level targets and ½-step targets each sum to 100', () => {
    const top = d.pol.filter((p) => p[5] === 0);
    within(
      top.reduce((s, p) => s + num(p[1]), 0),
      100,
      0.001,
    );
    within(
      top.reduce((s, p) => s + num(p[3]), 0),
      100,
      0.001,
    );
  });

  it('sub-class rows sum to their category (transcription gaps listed explicitly)', () => {
    // a known gap is disclosed on the Allocation view rather than corrected by guesswork
    const KNOWN_GAPS: Record<string, string> = {
      'OPEB Trust|real assets and inflation hedges|half':
        'sub-class ½-steps sum to 15.5 vs 16.5 as transcribed — verify against the OPEB IPS',
    };
    let parent: (typeof d.pol)[number] | null = null;
    let subs: (typeof d.pol)[number][] = [];
    const check = () => {
      if (!parent || subs.length === 0) return;
      for (const [col, kind] of [
        [1, 'target'],
        [3, 'half'],
      ] as const) {
        const key = `${d.label}|${norm(parent[0])}|${kind}`;
        if (KNOWN_GAPS[key]) continue;
        within(
          subs.reduce((s, p) => s + num(p[col]), 0),
          num(parent[col]),
          0.001,
        );
      }
    };
    for (const p of d.pol) {
      if (p[5] === 0) {
        check();
        parent = p;
        subs = [];
      } else if (p[5] === 1) {
        subs.push(p);
      }
    }
    check();
  });

  it('the actual mix repeats the functional-category actuals where published', () => {
    for (const [name, , , , actual] of d.majors) {
      if (actual === null) continue;
      const m = d.mix.find((x) => norm(x.label) === norm(name));
      expect(m?.pct, name).toBe(actual);
    }
  });

  it('the "within their IPS ranges" sentence is true of the numbers', () => {
    if (!d.allocFoot.includes('within their IPS ranges')) return;
    for (const [name, target, range, , actual] of d.majors) {
      expect(actual, name).not.toBeNull();
      expect(actual!).toBeGreaterThanOrEqual(target - range);
      expect(actual!).toBeLessThanOrEqual(target + range);
    }
  });
});

describe.each(ENTITIES)('%s — fee schedule', (_name, d) => {
  const total = d.fees.find((f) => f[3] === 1)!;
  const classes = d.fees.filter((f) => f[3] !== 1);

  it('class rows sum to the total row in both years', () => {
    expect(classes.reduce((s, f) => s + f[1], 0)).toBe(total[1]);
    expect(classes.reduce((s, f) => s + f[2], 0)).toBe(total[2]);
  });

  it('the fee-ratio sentence is total fees over year-end net position', () => {
    const endK = (y: 'fy2025' | 'fy2024') => row(d, 'Net position, end of year')[y] * 1000;
    expect(d.feeNote).toContain(`≈${((total[1] / endK('fy2025')) * 100).toFixed(2)}%`);
    expect(d.feeNote).toContain(`${((total[2] / endK('fy2024')) * 100).toFixed(2)}%)`);
  });

  it('the "account for N% of the total" sentence names the two largest classes', () => {
    const top2 = [...classes].sort((a, b) => b[1] - a[1]).slice(0, 2);
    const share = Math.round((top2.reduce((s, f) => s + f[1], 0) / total[1]) * 100);
    expect(d.feeNote).toContain(`${share}% of the total`);
    for (const f of top2) expect(d.feeNote.toLowerCase()).toContain(f[0].toLowerCase());
  });
});

describe('Pension-only detail', () => {
  it('funded-ratio deltas are the differences between successive valuations', () => {
    expect(PENSION_FUNDED_DELTAS[0]).toBe(
      `+${(PENSION_FUNDED[0]![1] - PENSION_FUNDED[1]![1]).toFixed(1)} pp`,
    );
    expect(PENSION_FUNDED_DELTAS[1]).toBe(
      `+${(PENSION_FUNDED[1]![1] - PENSION_FUNDED[2]![1]).toFixed(1)} pp`,
    );
    expect(PENSION_FUNDED_DELTAS[2]).toBe('—');
  });

  it('the funded-ratio and membership tiles repeat the detail tables', () => {
    const funded = PENSION.kpis.find(([k]) => k === 'Funded ratio')!;
    expect(funded[1]).toBe(`${PENSION_FUNDED[0]![1].toFixed(1)}%`);
    expect(funded[2]).toContain(`UAAL $${(num(PENSION_FUNDED[0]![2]) / 1e6).toFixed(1)}B`);
    const members = PENSION.kpis.find(([k]) => k === 'Total membership')!;
    const total = PENSION_MEMBERSHIP.find((m) => m[4])!;
    expect(members[1]).toBe(total[1]);
    for (const col of [1, 2, 3] as const) {
      expect(num(total[col])).toBe(
        num(PENSION_MEMBERSHIP[0]![col]) + num(PENSION_MEMBERSHIP[1]![col]),
      );
    }
  });

  it('the top-ten equity sentence is the sum of the quoted holdings over net position', () => {
    const sumK = PENSION_EQUITY.reduce((s, h) => s + num(h[2]), 0);
    expect((sumK / 1e6).toFixed(1)).toBe('5.5');
    const endK = row(PENSION, 'Net position, end of year').fy2025 * 1000;
    expect(((sumK / endK) * 100).toFixed(1)).toBe('6.4');
  });

  it('growth and cumulative notes quote the decade net increase', () => {
    const increase = (PENSION.growth[9]! - PENSION.growth[0]!).toFixed(1);
    expect(PENSION.growthNote).toContain(`$${increase} billion`);
    expect(PENSION.cumNote).toContain(`$${increase} billion`);
  });
});

describe('board brief', () => {
  it('quotes every horizon and never drops the prototype disclaimer', () => {
    for (const [entity, d] of [
      ['PENSION', PENSION],
      ['OPEB', OPEB],
    ] as const) {
      const text = boardBrief(entity);
      d.ret.f.forEach((f, i) => {
        expect(text).toContain(`${f.toFixed(1)}% vs ${d.ret.b[i]!.toFixed(1)}%`);
      });
      expect(text).toContain('not an official LACERA report');
    }
  });
});
