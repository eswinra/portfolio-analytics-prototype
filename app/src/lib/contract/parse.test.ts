import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { buildDataset } from '../dataset/model';
import { parseContractCsv } from './parse';

/** Contract tests run against the canonical fixtures in data/sample/ (single source of truth). */

const SAMPLE = join(__dirname, '..', '..', '..', '..', 'data', 'sample');

function load(name: string): string {
  return readFileSync(join(SAMPLE, name), 'utf-8');
}

describe('valid fixture', () => {
  const res = parseContractCsv(load('demofund_export_v1.csv'));

  it('accepts with zero errors', () => {
    expect(res.ok).toBe(true);
    expect(res.errors).toHaveLength(0);
    expect(res.records).toHaveLength(358);
  });

  it('derives the dataset with values matching the audited workbook', () => {
    const ds = buildDataset(res.records, 'workbook');
    expect(ds.meta.entityId).toBe('DEMOFUND');
    expect(ds.meta.asOf).toBe('2026-06-30');
    // audited values from docs/workbook-qa.md
    const fytd = ds.periods.find((p) => p.label.includes('Fiscal'));
    expect(fytd?.portfolio).toBeCloseTo(0.124117, 5);
    expect(fytd?.benchmark).toBeCloseTo(0.12573, 5);
    const qtd = ds.periods.find((p) => p.label.startsWith('Quarter'));
    expect(qtd?.portfolio).toBeCloseTo(0.041658, 5);
    expect(ds.reconciliation?.status).toBe('PASS');
    expect(ds.reconciliation?.residual).toBeCloseTo(0.000521, 5);
    // chain-linking the monthly TOTAL series reproduces the exported QTD (internal consistency)
    const total = ds.monthlyPortfolio.get('TOTAL')!;
    const last3 = total.slice(-3).map((p) => p.value!);
    const chained = last3.reduce((g, r) => g * (1 + r), 1) - 1;
    expect(chained).toBeCloseTo(qtd!.portfolio!, 9);
  });

  it('surfaces the deliberate missing/stale market states', () => {
    const ds = buildDataset(res.records, 'workbook');
    const oil = ds.proxyStrip.find((p) => p.proxyId === 'DEMO-OIL');
    const usd = ds.proxyStrip.find((p) => p.proxyId === 'DEMO-USD');
    expect(oil?.state).toBe('missing'); // fresh series, latest point absent
    expect(usd?.state).toBe('stale'); // newest value 4 calendar days old
    const eq = ds.proxyStrip.find((p) => p.proxyId === 'DEMO-EQ-GLOBAL');
    expect(eq?.state).toBe('current');
    expect(eq?.lastReturn).not.toBeNull();
  });

  it('keeps reported_public confined and cited', () => {
    const ds = buildDataset(res.records, 'workbook');
    expect(ds.publicReferences).toHaveLength(8);
    for (const p of ds.publicReferences) expect(p.pageTable.length).toBeGreaterThan(0);
  });

  it('joins monthly series by date, not array position', () => {
    const ds = buildDataset(res.records, 'workbook');
    expect(ds.joinedMonths).toHaveLength(12);
    for (const m of ds.joinedMonths) {
      expect(m.monthEnd).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
    const last = ds.joinedMonths[ds.joinedMonths.length - 1]!;
    expect(last.portfolioIndex).toBeCloseTo(1.124117, 5);
    expect(last.benchmarkIndex).toBeCloseTo(1.12573, 5);
  });

  it('computes the policy-weighted read-through with honest coverage', () => {
    const ds = buildDataset(res.records, 'workbook');
    // DEMO-OIL (Natural Resources, 3%) is unpriced by design → excluded, coverage 40.5%
    expect(ds.readThrough.coverage).toBeCloseTo(0.405, 6);
    expect(ds.readThrough.unpriced.map((u) => u.classLabel)).toContain('Natural Resources');
    expect(ds.readThrough.fundLevelImpact).not.toBeNull();
  });

  it('recomputes over/under from primitives and applies IPS bands', () => {
    const ds = buildDataset(res.records, 'workbook');
    const growth = ds.allocation.find((a) => a.categoryId === 'GROWTH')!;
    expect(growth.overUnderPct).toBeCloseTo(growth.actualWeight! - growth.targetWeight!, 12);
    expect(growth.bandMin).toBeCloseTo(0.4, 12); // Pension IPS 40–56%
    expect(growth.bandMax).toBeCloseTo(0.56, 12);
    expect(growth.rangeStatus).toBe('within');
    expect(ds.policySource).toBe('dataset'); // schema-1.1 bands travel with the data
    expect(ds.emvIncomplete).toBe(false);
  });

  it('merges degraded market series with their controls into root-cause issues', () => {
    const ds = buildDataset(res.records, 'workbook');
    // one missing proxy + one stale proxy + their two WARN controls → exactly 2 issues
    expect(ds.exceptions).toHaveLength(2);
    expect(ds.exceptions.map((e) => e.id).sort()).toEqual(['ISSUE-MISSING', 'ISSUE-STALE']);
    expect(ds.exceptions.find((e) => e.id === 'ISSUE-MISSING')?.description).toContain('CHK-06');
  });

  it('tiers and ages exceptions from dates inside the file (oldest first within a tier)', () => {
    const ds = buildDataset(res.records, 'workbook');
    for (const e of ds.exceptions) expect(e.tier).toBe('warning');
    // market data through 2026-06-30: USD last close 06-26 (4 days), OIL last close 06-29 (1)
    const stale = ds.exceptions.find((e) => e.id === 'ISSUE-STALE')!;
    const missing = ds.exceptions.find((e) => e.id === 'ISSUE-MISSING')!;
    expect(stale.ageDays).toBe(4);
    expect(missing.ageDays).toBe(1);
    expect(ds.exceptions[0]?.id).toBe('ISSUE-STALE'); // older issue sorts first
  });

  it('OPEB fixture validates and scopes to the OPEB policy pack', () => {
    const res2 = parseContractCsv(load('demo_opeb_export_v1.csv'));
    expect(res2.ok).toBe(true);
    expect(res2.records).toHaveLength(358);
    const ds = buildDataset(res2.records, 'workbook', 'OPEB');
    expect(ds.meta.entityId).toBe('DEMO-OPEB');
    expect(ds.meta.policyEntity).toBe('OPEB');
    expect(ds.policySource).toBe('dataset');
    expect(ds.policyRecordCount).toBe(16);
    // OPEB IPS bands: Growth 35–55%, RRM 17–35%
    const growth = ds.allocation.find((a) => a.categoryId === 'GROWTH')!;
    expect(growth.bandMin).toBeCloseTo(0.35, 12);
    expect(growth.bandMax).toBeCloseTo(0.55, 12);
    // OPEB read-through weights: 40% + 14.5% priced (NR 2% unpriced) → 54.5% coverage
    expect(ds.readThrough.coverage).toBeCloseTo(0.545, 6);
    expect(ds.reconciliation?.status).toBe('PASS');
    // internal consistency: chained monthly TOTAL reproduces exported QTD
    const qtd = ds.periods.find((p) => p.label.startsWith('Quarter'))!;
    const total = ds.monthlyPortfolio.get('TOTAL')!;
    const chained = total.slice(-3).reduce((g, p) => g * (1 + p.value!), 1) - 1;
    expect(chained).toBeCloseTo(qtd.portfolio!, 9);
  });

  it('suppresses totals and flags an exception when a sleeve EMV is missing', () => {
    const base = load('demofund_export_v1.csv');
    // blank the GROWTH emv record value and flag it missing
    const mutated = base.replace(
      /^(REC-0154,allocation,DEMOFUND,emv,GROWTH,)([^,]+)(,\$mm,USD,mm,[^,]+,,,M,Monthly,calculated,[^,]+,[^,]+,[^,]+,[^,]+,[^,]+,IBOR,n\/a,n\/a,final,,,)ok/m,
      '$1$3missing',
    );
    expect(mutated).not.toBe(base);
    const res2 = parseContractCsv(mutated);
    expect(res2.ok).toBe(true); // structurally valid; missing is a state, not an error
    const ds = buildDataset(res2.records, 'user_import');
    expect(ds.emvIncomplete).toBe(true);
    expect(ds.totalEmvMm).toBeNull();
    expect(ds.allocation.every((a) => a.overUnderMm === null)).toBe(true);
    expect(ds.exceptions.some((e) => e.id === 'EMV-PARTIAL')).toBe(true);
  });
});

describe('invalid fixtures are rejected with the right rule', () => {
  const cases: [string, string][] = [
    ['bad_schema_version.csv', 'V03'],
    ['missing_column.csv', 'V02'],
    ['duplicate_records.csv', 'V04'],
    ['bad_number.csv', 'V07'],
    ['whole_number_percent.csv', 'V10'],
    ['blank_value_flagged_ok.csv', 'V08'],
    ['period_start_after_end.csv', 'V09'],
    ['bad_classification.csv', 'V06'],
    ['user_import_no_entered_by.csv', 'V19'],
    ['published_no_reviewer.csv', 'V20'],
    ['bad_review_status.csv', 'V21'],
    ['partial_provenance_columns.csv', 'V02'],
  ];

  it.each(cases)('%s → %s', (file, rule) => {
    const res = parseContractCsv(load(join('invalid', file)));
    expect(res.ok).toBe(false);
    expect(res.records).toHaveLength(0); // all-or-nothing
    expect(res.errors.map((e) => e.ruleId)).toContain(rule);
  });

  it('duplicate natural keys are caught even with distinct record ids', () => {
    const base = load('demofund_export_v1.csv');
    const lines = base.trim().split('\n');
    const dup = (lines[1] as string).replace('REC-0001', 'REC-9999');
    const res = parseContractCsv([...lines, dup].join('\n'));
    expect(res.ok).toBe(false);
    expect(res.errors.map((e) => e.ruleId)).toContain('V05');
  });

  it('empty file is rejected', () => {
    const res = parseContractCsv('');
    expect(res.ok).toBe(false);
    expect(res.errors[0]?.ruleId).toBe('V01');
  });

  it('reported_public outside public_reference is rejected (V15)', () => {
    const base = load('demofund_export_v1.csv');
    const mutated = base.replace(
      /^(REC-0001,monthly_return,[^\n]*?)synthetic/m,
      '$1reported_public',
    );
    expect(mutated).not.toBe(base);
    const res = parseContractCsv(mutated);
    expect(res.ok).toBe(false);
    expect(res.errors.map((e) => e.ruleId)).toContain('V15');
  });

  it('tampered contribution fails coherence (V14)', () => {
    const base = load('demofund_export_v1.csv');
    // REC-0178 is the GROWTH contribution row; distort it well past tolerance
    const mutated = base.replace(
      /^(REC-0178,contribution_qtd,DEMOFUND,contribution,GROWTH,)([^,]+)/m,
      '$10.10',
    );
    expect(mutated).not.toBe(base);
    const res = parseContractCsv(mutated);
    expect(res.ok).toBe(false);
    expect(res.errors.map((e) => e.ruleId)).toContain('V14');
  });

  it('unfamiliar (single) entity produces a V17 warning, not a rejection', () => {
    const base = load('demofund_export_v1.csv');
    const mutated = base.replaceAll('DEMOFUND', 'OTHERFUND');
    const res = parseContractCsv(mutated, 'DEMOFUND');
    expect(res.ok).toBe(true);
    expect(res.warnings.map((w) => w.ruleId)).toContain('V17');
  });

  it('multi-entity files are rejected outright (V17) — no silent blending', () => {
    const base = load('demofund_export_v1.csv');
    // relabel a single portfolio record to a second entity
    const mutated = base.replace(
      'REC-0001,monthly_return,DEMOFUND',
      'REC-0001,monthly_return,SECONDFUND',
    );
    expect(mutated).not.toBe(base);
    const res = parseContractCsv(mutated);
    expect(res.ok).toBe(false);
    expect(res.errors.map((e) => e.ruleId)).toContain('V17');
  });

  it('V10 percent bound does not reject legitimate large allocation weights', () => {
    const base = load('demofund_export_v1.csv');
    // push GROWTH weight_actual to 65% — implausible as a return, legal as a weight
    const mutated = base.replace(
      /^(REC-0155,allocation,DEMOFUND,weight_actual,GROWTH,)([^,]+)/m,
      '$10.65',
    );
    expect(mutated).not.toBe(base);
    const res = parseContractCsv(mutated);
    // weights no longer sum to 1 → V13 fires; V10 must NOT
    expect(res.errors.map((e) => e.ruleId)).toContain('V13');
    expect(res.errors.map((e) => e.ruleId)).not.toContain('V10');
  });

  it('a value present but flagged missing is discarded (warned), never rendered', () => {
    const base = load('demofund_export_v1.csv');
    const mutated = base.replace(
      /^(REC-0187,market_close,DEMOFUND,close,[^,]+,)([^,]+)(,px[^\n]*?),ok,/m,
      '$1$2$3,missing,',
    );
    expect(mutated).not.toBe(base);
    const res = parseContractCsv(mutated);
    expect(res.ok).toBe(true);
    expect(res.warnings.map((w) => w.ruleId)).toContain('V08');
    const rec = res.records.find((r) => r.record_id === 'REC-0187');
    expect(rec?.value).toBeNull();
  });
});

describe('schema 1.2 provenance', () => {
  const v12 = load('demofund_export_v1.csv');

  /** Strip the three provenance columns and re-declare 1.1 — a faithful legacy file. */
  function downgradeTo11(csv: string): string {
    return csv
      .replace(',entered_by,reviewed_by,review_status', '')
      .replaceAll(',PA-ANALYST-1,PA-LEAD-1,published', '')
      .replaceAll(',1.2.0', ',1.1.0');
  }

  it('fixture actors surface as team activity; nothing is draft', () => {
    const res = parseContractCsv(v12);
    expect(res.ok).toBe(true);
    const ds = buildDataset(res.records, 'workbook');
    expect(ds.draftRecordCount).toBe(0);
    expect(ds.teamActivity.map((t) => t.actor)).toEqual(['PA-ANALYST-1', 'PA-LEAD-1']);
    expect(ds.teamActivity[0]?.enteredRows).toBe(358);
    expect(ds.teamActivity[1]?.reviewedRows).toBe(358);
  });

  it('29-column 1.1 files stay valid; provenance normalizes to empty', () => {
    const legacy = downgradeTo11(v12);
    const res = parseContractCsv(legacy);
    expect(res.ok).toBe(true);
    expect(res.records).toHaveLength(358);
    expect(res.records[0]?.entered_by).toBe('');
    expect(res.records[0]?.review_status).toBe('');
    const ds = buildDataset(res.records, 'workbook');
    expect(ds.teamActivity).toHaveLength(0);
    expect(ds.draftRecordCount).toBe(0);
  });

  it('32 columns declaring schema 1.1 is rejected (V02 version/column mismatch)', () => {
    const mismatched = v12.replaceAll(',1.2.0,', ',1.1.0,');
    expect(mismatched).not.toBe(v12);
    const res = parseContractCsv(mismatched);
    expect(res.ok).toBe(false);
    expect(res.errors.map((e) => e.ruleId)).toContain('V02');
  });

  it('29 columns declaring schema 1.2 is rejected (V02 version/column mismatch)', () => {
    const mismatched = downgradeTo11(v12).replaceAll(',1.1.0', ',1.2.0');
    const res = parseContractCsv(mismatched);
    expect(res.ok).toBe(false);
    expect(res.errors.map((e) => e.ruleId)).toContain('V02');
  });

  it('draft rows are counted and raise an informational exception (banner + queue)', () => {
    // draft with no reviewer is legal (V20 binds reviewed/published only)
    const drafted = v12.replaceAll(',PA-ANALYST-1,PA-LEAD-1,published', ',PA-ANALYST-1,,draft');
    const res = parseContractCsv(drafted);
    expect(res.ok).toBe(true);
    const ds = buildDataset(res.records, 'user_import');
    expect(ds.draftRecordCount).toBe(358);
    const info = ds.exceptions.find((e) => e.id === 'DRAFT-RECORDS')!;
    expect(info.tier).toBe('informational');
    expect(ds.exceptions[ds.exceptions.length - 1]?.id).toBe('DRAFT-RECORDS'); // sorts last
  });
});
