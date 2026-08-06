/**
 * IPS policy pack — reported_public reference data quoted from the two public LACERA
 * Investment Policy Statements (both restated June 12, 2024):
 *   - Pension: invest_policy_stmt.pdf, Appendix Tables 1–2 (printed pp. 20–21)
 *   - OPEB Master Trust: IPS-OPEB.pdf, Appendix Tables 1–2 (printed pp. 21–22)
 *
 * Ranges are stored as EXPLICIT min/target/max because the source uses asymmetric bands
 * (Pension Cash: target 1%, +2/−1 → 0–3%). Never reconstruct bounds from a ± half-width.
 * Long-term targets and the dated ½-step transition targets are both preserved; which one
 * governs compliance at a given date must be confirmed against the current Board-approved
 * policy before any statement is framed as compliance.
 */

export interface PolicyBand {
  classId: string;
  label: string;
  /** undefined = functional category; otherwise the parent category classId */
  parent?: string;
  /** decimals: 0.48 = 48% */
  min: number;
  target: number;
  max: number;
  /** interim transition target effective 2024-07-01 (decimal) */
  halfStepTarget: number;
  benchmark: string;
  benchmarkLagMonths: 0 | 1 | 3;
  benchmarkSpreadBps: number;
}

export interface PolicyPack {
  entityId: 'PENSION' | 'OPEB';
  entityLabel: string;
  policyName: string;
  version: string;
  approvedDate: string;
  halfStepEffective: string;
  sourceDoc: string;
  sourcePages: string;
  classification: 'reported_public';
  bands: PolicyBand[];
  notes: string[];
}

const b = (
  classId: string,
  label: string,
  min: number,
  target: number,
  max: number,
  halfStepTarget: number,
  benchmark: string,
  benchmarkLagMonths: 0 | 1 | 3 = 0,
  benchmarkSpreadBps = 0,
  parent?: string,
): PolicyBand =>
  parent === undefined
    ? {
        classId,
        label,
        min,
        target,
        max,
        halfStepTarget,
        benchmark,
        benchmarkLagMonths,
        benchmarkSpreadBps,
      }
    : {
        classId,
        label,
        parent,
        min,
        target,
        max,
        halfStepTarget,
        benchmark,
        benchmarkLagMonths,
        benchmarkSpreadBps,
      };

export const PENSION_POLICY: PolicyPack = {
  entityId: 'PENSION',
  entityLabel: 'LACERA Pension Plan',
  policyName: 'Investment Policy Statement',
  version: 'Restated June 12, 2024',
  approvedDate: '2024-06-12',
  halfStepEffective: '2024-07-01',
  sourceDoc: 'invest_policy_stmt.pdf',
  sourcePages: 'Appendix Tables 1–2, printed pp. 20–21',
  classification: 'reported_public',
  bands: [
    b('GROWTH', 'Growth', 0.4, 0.48, 0.56, 0.505, 'Custom Blend'),
    b('GLOBAL_EQ', 'Global Equity', 0.22, 0.29, 0.36, 0.305, 'MSCI ACWI IMI Net', 0, 0, 'GROWTH'),
    b(
      'PRIVATE_EQ',
      'Private Equity',
      0.11,
      0.17,
      0.23,
      0.17,
      'MSCI ACWI IMI + 200 bps',
      3,
      200,
      'GROWTH',
    ),
    b(
      'NONCORE_RE',
      'Non-Core Private Real Estate',
      0,
      0.02,
      0.04,
      0.03,
      'NFI ODCE + 225 bps',
      3,
      225,
      'GROWTH',
    ),
    b(
      'CREDIT',
      'Credit',
      0.09,
      0.13,
      0.17,
      0.12,
      '70% CS Leveraged Loans / 30% Bloomberg US Corp HY + 100 bps',
      1,
      100,
    ),
    b('RAIH', 'Real Assets & Inflation Hedges', 0.11, 0.15, 0.19, 0.16, 'Custom Blend'),
    b('CORE_RE', 'Core Real Estate', 0.02, 0.05, 0.08, 0.055, 'NFI ODCE', 3, 0, 'RAIH'),
    b(
      'NAT_RES',
      'Natural Resources',
      0.01,
      0.03,
      0.05,
      0.03,
      '65% S&P Global Natural Resources TR (3-mo lag) / 35% NCREIF Farmland',
      3,
      0,
      'RAIH',
    ),
    b(
      'INFRA',
      'Infrastructure',
      0.01,
      0.04,
      0.07,
      0.045,
      'DJ Brookfield Global Composite Infrastructure TR',
      3,
      0,
      'RAIH',
    ),
    b('TIPS', 'TIPS', 0, 0.03, 0.06, 0.03, 'Bloomberg US TIPS (0–5 yrs)', 0, 0, 'RAIH'),
    b('RRM', 'Risk Reduction & Mitigation', 0.16, 0.24, 0.32, 0.215, 'Custom Blend'),
    b(
      'IG_BONDS',
      'Investment Grade Bonds',
      0.05,
      0.13,
      0.21,
      0.1,
      'Bloomberg US Aggregate TR',
      0,
      0,
      'RRM',
    ),
    b(
      'HEDGE_FUNDS',
      'Diversified Hedge Funds',
      0.04,
      0.08,
      0.12,
      0.07,
      'FTSE 3-Month US T-Bill + 200 bps',
      1,
      200,
      'RRM',
    ),
    b(
      'LT_GOV',
      'Long-term Government Bonds',
      0,
      0.02,
      0.04,
      0.035,
      'Bloomberg US Long Treasury Bond',
      0,
      0,
      'RRM',
    ),
    // Asymmetric band: target 1, +2/−1 → 0–3 (the counterexample to ± half-width storage)
    b('CASH', 'Cash', 0, 0.01, 0.03, 0.01, 'FTSE 3-Month US T-Bill', 0, 0, 'RRM'),
    b('OVERLAY', 'Overlays & Hedges', 0, 0, 0, 0, 'n/a (0% policy weight)'),
  ],
  notes: [
    'Total Fund benchmark: Custom Blended Policy Benchmark (Table 2).',
    'Pension Cash range is asymmetric: +2/−1 around a 1% target (0–3%).',
    '½-step transition targets are dated 7/1/2024; confirm which policy version governs compliance today before describing positions as compliant/non-compliant.',
  ],
};

export const OPEB_POLICY: PolicyPack = {
  entityId: 'OPEB',
  entityLabel: 'LACERA OPEB Master Trust',
  policyName: 'Investment Policy Statement — OPEB Master Trust',
  version: 'Restated June 12, 2024',
  approvedDate: '2024-06-12',
  halfStepEffective: '2024-07-01',
  sourceDoc: 'IPS-OPEB.pdf',
  sourcePages: 'Appendix Tables 1–2, printed pp. 21–22',
  classification: 'reported_public',
  bands: [
    b('GROWTH', 'Growth', 0.35, 0.45, 0.55, 0.45, 'Custom Blend'),
    b('GLOBAL_EQ', 'Global Equity', 0.3, 0.4, 0.5, 0.4, 'MSCI ACWI IMI Net', 0, 0, 'GROWTH'),
    b(
      'PRIVATE_EQ',
      'Private Equity',
      0,
      0.05,
      0.1,
      0.05,
      'MSCI ACWI IMI + 200 bps',
      3,
      200,
      'GROWTH',
    ),
    b(
      'CREDIT',
      'Credit',
      0.11,
      0.16,
      0.21,
      0.17,
      '70% CS Leveraged Loans / 30% Bloomberg US Corp HY + 100 bps',
      1,
      100,
    ),
    b('RAIH', 'Real Assets & Inflation Hedges', 0.09, 0.13, 0.17, 0.165, 'Custom Blend'),
    b('RE', 'Real Estate', 0.02, 0.05, 0.08, 0.065, 'NFI ODCE', 3, 0, 'RAIH'),
    b(
      'NAT_RES',
      'Natural Resources',
      0,
      0.02,
      0.04,
      0.02,
      'S&P Global Natural Resources TR',
      0,
      0,
      'RAIH',
    ),
    b(
      'INFRA',
      'Infrastructure',
      0,
      0.02,
      0.04,
      0.02,
      'DJ Brookfield Global Composite Infrastructure TR',
      3,
      0,
      'RAIH',
    ),
    b('TIPS', 'TIPS', 0, 0.04, 0.08, 0.05, 'Bloomberg US TIPS (0–5 yrs)', 0, 0, 'RAIH'),
    b('RRM', 'Risk Reduction & Mitigation', 0.17, 0.26, 0.35, 0.215, 'Custom Blend'),
    b(
      'IG_BONDS',
      'Investment Grade Bonds',
      0.12,
      0.19,
      0.26,
      0.145,
      'Bloomberg US Aggregate TR',
      0,
      0,
      'RRM',
    ),
    b(
      'LT_GOV',
      'Long-term Government Bonds',
      0,
      0.05,
      0.1,
      0.05,
      'Bloomberg US Long Treasury Bond',
      0,
      0,
      'RRM',
    ),
    b('CASH', 'Cash', 0, 0.02, 0.04, 0.02, 'FTSE 3-Month US T-Bill', 0, 0, 'RRM'),
    b('OVERLAY', 'Overlays & Hedges', 0, 0, 0, 0, 'n/a (0% policy weight)'),
  ],
  notes: [
    'Total Trust benchmark: Custom Blended Policy Benchmark (Table 2).',
    'OPEB Natural Resources benchmark is unlagged S&P GNR with no NCREIF Farmland component — a real methodology difference from the Pension policy.',
    'DATA NOTE: the extracted OPEB sub-class ½-step targets sum to 15.5% for Real Assets & Inflation Hedges vs the category-level 16.5% — a 1.0% inconsistency in the source extraction, pending confirmation against the PDF. Category-level figures are treated as authoritative until confirmed.',
    '½-step transition targets are dated 7/1/2024; confirm the governing policy version before compliance framing.',
  ],
};

export const POLICY_PACKS: PolicyPack[] = [PENSION_POLICY, OPEB_POLICY];

/**
 * Demo proxy → policy-class mapping for the daily read-through. Weights are the Pension
 * ½-step targets of the mapped class. Unmapped proxies are market context only.
 */
export interface ProxyPolicyMapping {
  proxyId: string;
  classId: string;
  classLabel: string;
  halfStepWeight: number;
}

export const PROXY_POLICY_MAP_PENSION: ProxyPolicyMapping[] = [
  {
    proxyId: 'DEMO-EQ-GLOBAL',
    classId: 'GLOBAL_EQ',
    classLabel: 'Global Equity',
    halfStepWeight: 0.305,
  },
  {
    proxyId: 'DEMO-BOND-AGG',
    classId: 'IG_BONDS',
    classLabel: 'Investment Grade Bonds',
    halfStepWeight: 0.1,
  },
  {
    proxyId: 'DEMO-OIL',
    classId: 'NAT_RES',
    classLabel: 'Natural Resources',
    halfStepWeight: 0.03,
  },
];

export const PROXY_POLICY_MAP_OPEB: ProxyPolicyMapping[] = [
  {
    proxyId: 'DEMO-EQ-GLOBAL',
    classId: 'GLOBAL_EQ',
    classLabel: 'Global Equity',
    halfStepWeight: 0.4,
  },
  {
    proxyId: 'DEMO-BOND-AGG',
    classId: 'IG_BONDS',
    classLabel: 'Investment Grade Bonds',
    halfStepWeight: 0.145,
  },
  {
    proxyId: 'DEMO-OIL',
    classId: 'NAT_RES',
    classLabel: 'Natural Resources',
    halfStepWeight: 0.02,
  },
];

export type PolicyEntity = 'PENSION' | 'OPEB';

export function policyFor(entity: PolicyEntity): PolicyPack {
  return entity === 'OPEB' ? OPEB_POLICY : PENSION_POLICY;
}

export function proxyMapFor(entity: PolicyEntity): ProxyPolicyMapping[] {
  return entity === 'OPEB' ? PROXY_POLICY_MAP_OPEB : PROXY_POLICY_MAP_PENSION;
}

/** Categories the demo maps at category level for range monitoring (Pension pack). */
export const CATEGORY_TO_POLICY: Record<string, string> = {
  GROWTH: 'GROWTH',
  CREDIT: 'CREDIT',
  RAIH: 'RAIH',
  RRM: 'RRM',
  OVERLAY: 'OVERLAY',
};
