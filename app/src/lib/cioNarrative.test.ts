import { describe, expect, it } from 'vitest';

import { CIO_LATEST, CIO_VINTAGES, type CioEntity } from '../fixtures/cioMonthly';
import { cioChanges, cioNarrative } from './cioNarrative';

/** The two-minute read is computed, never written for a month: these tests pin the arithmetic
 *  behind each sentence and prove the wording follows the data when the data changes sign. */

const clone = (e: CioEntity): CioEntity => JSON.parse(JSON.stringify(e)) as CioEntity;
const latest = CIO_LATEST.ENT.pension;
const prior = CIO_VINTAGES[CIO_VINTAGES.length - 2]!.ENT.pension;

describe('cioNarrative', () => {
  const points = cioNarrative(latest, CIO_LATEST);

  it('answers the four standing questions and names a panel for each', () => {
    expect(points.map((p) => p.id)).toEqual(['track', 'gap', 'position', 'risk']);
    for (const p of points) {
      expect(p.a.length).toBeGreaterThan(40);
      expect(p.jumpTo).toMatch(/^cio-/);
    }
  });

  it('quotes the reported month return, benchmark and excess', () => {
    const t = points[0]!.a;
    expect(t).toContain('0.1%'); // June 2026 net return
    expect(t).toContain('−1.4%'); // policy benchmark
    expect(t).toContain('+1.5 pp'); // excess, calculated
  });

  it('marks only the attribution answer as a proxy', () => {
    expect(points.filter((p) => p.proxy).map((p) => p.id)).toEqual(['gap']);
  });

  it('says "lead came mainly from" when the fund is ahead and "shortfall" when behind', () => {
    expect(points[1]!.a).toContain('lead came mainly from');
    const behind = clone(latest);
    behind.total.b = behind.total.b.map((b, i) => (i === 0 ? (behind.total.r[0] ?? 0) + 1 : b));
    expect(cioNarrative(behind, CIO_LATEST)[1]!.a).toContain('shortfall traces to');
  });

  it('reports the hurdle honestly in both directions', () => {
    expect(points[0]!.a).toContain('Above the actuarial hurdle over every period');
    const weak = clone(latest);
    weak.total.h = weak.total.h.map((h, i) => (i === 4 ? 99 : h));
    expect(cioNarrative(weak, CIO_LATEST)[0]!.a).toContain('Below the actuarial hurdle over 1 Y');
  });

  it('names the widest allocation gap and the flow total', () => {
    expect(points[2]!.a).toContain('Growth');
    expect(points[2]!.a).toContain('−$60M');
  });

  it('omits the market clause when the report carries no market table', () => {
    const noMkt = { ...CIO_LATEST, MKT: null };
    expect(cioNarrative(latest, noMkt)[3]!.a).not.toContain('led the fiscal year');
  });

  it('appends the macro line only when one is supplied', () => {
    const withMacro = cioNarrative(latest, CIO_LATEST, { macroLine: 'PCE inflation 3.7%.' });
    expect(withMacro[3]!.a).toContain('PCE inflation 3.7%.');
    expect(points[3]!.a).not.toContain('PCE inflation');
  });
});

describe('cioChanges', () => {
  const changes = cioChanges(latest, prior);

  it('lists changes largest first, each with a signed delta and a before → after detail', () => {
    expect(changes.length).toBeGreaterThan(0);
    for (let i = 1; i < changes.length; i++) {
      expect(Math.abs(changes[i]!.delta)).toBeLessThanOrEqual(Math.abs(changes[i - 1]!.delta));
    }
    for (const c of changes) expect(c.detail).toMatch(/→/);
  });

  it('flags an excess that changed sign', () => {
    const flips = changes.filter((c) => c.id.startsWith('flip-'));
    expect(flips.length).toBeGreaterThan(0);
    expect(flips[0]!.label).toMatch(/excess turned (positive|negative)/);
  });

  it('flags a policy-target change and says drift is not comparable', () => {
    const moved = clone(latest);
    moved.comps[0]!.tgt = moved.comps[0]!.tgt + 2;
    const c = cioChanges(moved, prior).find((x) => x.id === 'tgt-growth');
    expect(c).toBeDefined();
    expect(c!.detail).toContain('not comparable across policy versions');
  });

  it('ignores movements below the reporting threshold', () => {
    const same = clone(latest);
    const none = cioChanges(same, same);
    expect(none.filter((c) => c.id.startsWith('w-') || c.id.startsWith('ret-'))).toEqual([]);
  });
});
