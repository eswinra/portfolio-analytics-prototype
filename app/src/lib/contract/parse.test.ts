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
    expect(res.records).toHaveLength(338);
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
    expect(ds.emvIncomplete).toBe(false);
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
