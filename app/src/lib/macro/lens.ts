import type { PolicyRow } from '../../fixtures/published';
import { FACTOR_KEYS, FACTORS, type FactorKey, type FactorModel } from './factors';

/**
 * Portfolio lens: which of the fund's policy sleeves are most exposed to what the macro factors
 * are doing now. Each asset class carries a STATED sensitivity to each factor — assumptions, not
 * regressions — and its reading is Σ sensitivity × factor z. Categories and the total fund are
 * weighted by the IPS Table 1 long-term policy targets for the selected fund.
 *
 * Classification: proxy_estimate. It is an exposure map under stated assumptions, not a forecast,
 * not attribution, and not a recommendation. Every sensitivity is shown on the page so it can be
 * challenged; change one and every reading moves.
 */

/** Sensitivities in FACTOR_KEYS order: growth, inflation, real rates, credit conditions (higher
 *  = tighter), commodities, curve slope, U.S. dollar. +1 means the class tends to benefit when
 *  the factor rises. Ten rows as set in the Sleeve Exposure Monitor (September 2026); the two
 *  marked rows were added when the lens moved onto the full IPS Table 1 structure. */
export const SENSITIVITIES: Record<string, { sens: number[]; added?: true }> = {
  'Global Equity': { sens: [1.0, -0.5, -0.7, -0.8, -0.2, 0.2, -0.3] },
  'Private Equity': { sens: [0.9, -0.5, -0.9, -0.9, -0.2, 0.2, -0.2] },
  'Non-Core Real Estate': { sens: [0.6, 0.3, -1.0, -0.6, 0.1, 0.0, -0.1], added: true },
  Credit: { sens: [0.6, -0.3, -0.5, -1.0, 0.0, 0.1, -0.2] },
  'Real Estate': { sens: [0.5, 0.3, -0.9, -0.5, 0.1, 0.0, -0.1] },
  'Natural Resources': { sens: [0.4, 0.9, -0.2, -0.3, 1.0, 0.0, -0.5] },
  Infrastructure: { sens: [0.3, 0.5, -0.7, -0.4, 0.2, 0.0, -0.1] },
  TIPS: { sens: [-0.1, 0.8, -0.9, -0.1, 0.3, 0.0, 0.0] },
  'IG Bonds': { sens: [-0.2, -0.7, -0.9, -0.6, -0.2, 0.0, 0.0] },
  'Hedge Funds': { sens: [0.2, 0.0, -0.1, -0.3, 0.0, 0.0, 0.0], added: true },
  'LT Gov Bonds': { sens: [-0.4, -0.9, -1.0, 0.0, -0.3, 0.0, 0.0] },
  Cash: { sens: [0.0, -0.2, 0.3, 0.0, 0.0, 0.0, 0.0] },
};

/** IPS Table 1 row name → sensitivity row. */
const CLASS_OF: Record<string, string> = {
  'Global Equity': 'Global Equity',
  'Private Equity': 'Private Equity',
  'Non-Core Private Real Estate': 'Non-Core Real Estate',
  Credit: 'Credit',
  'Core Real Estate': 'Real Estate',
  'Real Estate': 'Real Estate',
  'Natural Resources': 'Natural Resources',
  Infrastructure: 'Infrastructure',
  TIPS: 'TIPS',
  'Investment Grade Bonds': 'IG Bonds',
  'Diversified Hedge Funds': 'Hedge Funds',
  'Long-term Government Bonds': 'LT Gov Bonds',
  Cash: 'Cash',
};

const CATEGORY_TOKEN: Record<string, string> = {
  Growth: 'var(--cat-growth)',
  Credit: 'var(--cat-credit)',
  'Real Assets and Inflation Hedges': 'var(--cat-raih)',
  'Risk Reduction and Mitigation': 'var(--cat-rrm)',
};

export interface Contribution {
  factor: FactorKey;
  name: string;
  sens: number;
  z: number | null;
  contrib: number | null;
}

export interface LensRow {
  kind: 'fund' | 'category' | 'asset';
  id: string;
  name: string;
  /** IPS Table 1 long-term target, % of fund */
  weight: number;
  color: string;
  /** Σ sensitivity × factor z; null when any factor is missing */
  exposure: number | null;
  contribs: Contribution[];
  /** exposure per month over the factor history window */
  hist: (number | null)[];
  /** asset classes only: the row name in the sensitivity table */
  sensRow?: string;
  parent?: string;
}

const round3 = (x: number) => Math.round(x * 1000) / 1000;

function weighted(rows: { w: number; v: number | null }[]): number | null {
  const ok = rows.filter((r): r is { w: number; v: number } => r.v !== null);
  if (ok.length !== rows.length || ok.length === 0) return null;
  const tw = ok.reduce((a, r) => a + r.w, 0);
  return tw > 0 ? ok.reduce((a, r) => a + r.w * r.v, 0) / tw : null;
}

/** Categories and asset classes from IPS Table 1 rows (level 0 category, level 1 sub-class),
 *  skipping zero-target rows and the total. A category without sub-rows is its own class. */
export function policyStructure(
  pol: PolicyRow[],
): { name: string; target: number; classes: { name: string; target: number }[] }[] {
  const out: { name: string; target: number; classes: { name: string; target: number }[] }[] = [];
  for (const [name, target, , , , level] of pol) {
    const t = Number(target);
    if (level === 0 && t > 0) out.push({ name, target: t, classes: [] });
    else if (level === 1 && t > 0 && out.length)
      out[out.length - 1]!.classes.push({ name, target: t });
  }
  for (const c of out)
    if (c.classes.length === 0) c.classes.push({ name: c.name, target: c.target });
  return out;
}

export function buildLens(model: FactorModel, pol: PolicyRow[]): LensRow[] {
  const zNow = FACTOR_KEYS.map((k) => model.factors[k].z);
  const months = model.end - model.start + 1;
  const names = Object.fromEntries(FACTORS.map((f) => [f.key, f.name])) as Record<
    FactorKey,
    string
  >;

  const assetRow = (name: string, target: number, parent: string, color: string): LensRow => {
    const sensRow = CLASS_OF[name];
    const sens = sensRow ? SENSITIVITIES[sensRow]?.sens : undefined;
    if (!sensRow || !sens) throw new Error(`no stated sensitivity for IPS class "${name}"`);
    const contribs: Contribution[] = FACTOR_KEYS.map((k, i) => ({
      factor: k,
      name: names[k],
      sens: sens[i]!,
      z: zNow[i] ?? null,
      contrib: zNow[i] === null || zNow[i] === undefined ? null : round3(sens[i]! * zNow[i]!),
    }));
    const exposure = contribs.some((c) => c.contrib === null)
      ? null
      : round3(contribs.reduce((a, c) => a + (c.contrib ?? 0), 0));
    const hist: (number | null)[] = [];
    for (let k = 0; k < months; k++) {
      let total = 0;
      let ok = true;
      FACTOR_KEYS.forEach((f, i) => {
        const z = model.factors[f].hist[k];
        if (z === null || z === undefined) ok = false;
        else total += sens[i]! * z;
      });
      hist.push(ok ? round3(total) : null);
    }
    return {
      kind: 'asset',
      id: `asset-${sensRow}-${parent}`,
      name,
      weight: target,
      color,
      exposure,
      contribs,
      hist,
      sensRow,
      parent,
    };
  };

  const categories = policyStructure(pol).map((c) => {
    const color = CATEGORY_TOKEN[c.name] ?? 'var(--cat-other)';
    const assets = c.classes.map((a) => assetRow(a.name, a.target, c.name, color));
    const exposure = weighted(assets.map((a) => ({ w: a.weight, v: a.exposure })));
    const contribs: Contribution[] = FACTOR_KEYS.map((k, i) => {
      const z = zNow[i] ?? null;
      const tw = assets.reduce((s, a) => s + a.weight, 0);
      const sens = assets.reduce((s, a) => s + a.weight * a.contribs[i]!.sens, 0) / tw;
      return {
        factor: k,
        name: names[k],
        sens: round3(sens),
        z,
        contrib: z === null ? null : round3(sens * z),
      };
    });
    const hist = Array.from({ length: months }, (_, k) => {
      const v = weighted(assets.map((a) => ({ w: a.weight, v: a.hist[k] ?? null })));
      return v === null ? null : round3(v);
    });
    const row: LensRow = {
      kind: 'category',
      id: `cat-${c.name}`,
      name: c.name,
      weight: c.target,
      color,
      exposure: exposure === null ? null : round3(exposure),
      contribs,
      hist,
    };
    return { row, assets };
  });

  const catRows = categories.map((c) => c.row);
  const fundExposure = weighted(catRows.map((c) => ({ w: c.weight, v: c.exposure })));
  const totalW = catRows.reduce((s, c) => s + c.weight, 0);
  const fund: LensRow = {
    kind: 'fund',
    id: 'fund',
    name: 'Total Fund',
    weight: totalW,
    color: 'var(--accent-900)',
    exposure: fundExposure === null ? null : round3(fundExposure),
    contribs: FACTOR_KEYS.map((k, i) => {
      const z = zNow[i] ?? null;
      const sens = catRows.reduce((s, c) => s + c.weight * c.contribs[i]!.sens, 0) / totalW;
      return {
        factor: k,
        name: names[k],
        sens: round3(sens),
        z,
        contrib: z === null ? null : round3(sens * z),
      };
    }),
    hist: Array.from({ length: months }, (_, k) => {
      const v = weighted(catRows.map((c) => ({ w: c.weight, v: c.hist[k] ?? null })));
      return v === null ? null : round3(v);
    }),
  };
  return [fund, ...categories.flatMap((c) => [c.row, ...c.assets])];
}

/** The factor that moves a row most right now (largest absolute contribution). */
export function dominantFactor(row: LensRow): Contribution | null {
  const ok = row.contribs.filter((c) => c.contrib !== null);
  return ok.length
    ? ok.reduce((a, b) => (Math.abs(b.contrib!) > Math.abs(a.contrib!) ? b : a))
    : null;
}

/** An illustrative scenario: the same model with some factor readings replaced by values the
 *  reader sets. Only the latest readings change — the history stays observed — and nothing about
 *  the result is observed data; exposures computed from it remain proxy estimates. */
export function withScenario(
  model: FactorModel,
  overrides: Partial<Record<FactorKey, number>>,
): FactorModel {
  const factors = { ...model.factors };
  for (const key of FACTOR_KEYS) {
    const z = overrides[key];
    if (z !== undefined && Number.isFinite(z)) factors[key] = { ...factors[key], z };
  }
  return { ...model, factors };
}

/** Scenario overrides in the address bar: `realrates:1.5,credit:-0.5`. Unknown factors,
 *  non-numbers and values outside ±3 σ are ignored. */
export function parseScenario(raw: string): Partial<Record<FactorKey, number>> {
  const out: Partial<Record<FactorKey, number>> = {};
  for (const part of raw.split(',')) {
    const [k, v] = part.split(':');
    const z = Number(v);
    if (FACTOR_KEYS.includes(k as FactorKey) && v !== undefined && v !== '' && Number.isFinite(z)) {
      if (Math.abs(z) <= 3) out[k as FactorKey] = z;
    }
  }
  return out;
}

export function formatScenario(overrides: Partial<Record<FactorKey, number>>): string {
  return FACTOR_KEYS.filter((k) => overrides[k] !== undefined)
    .map((k) => `${k}:${Number(overrides[k]!.toFixed(2))}`)
    .join(',');
}
