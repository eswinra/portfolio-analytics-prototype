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
    expect(oil?.state).toBe('missing');
    expect(usd?.state).toBe('missing'); // trailing nulls ⇒ flagged at strip level
    const eq = ds.proxyStrip.find((p) => p.proxyId === 'DEMO-EQ-GLOBAL');
    expect(eq?.state).toBe('current');
    expect(eq?.lastReturn).not.toBeNull();
  });

  it('keeps reported_public confined and cited', () => {
    const ds = buildDataset(res.records, 'workbook');
    expect(ds.publicReferences).toHaveLength(8);
    for (const p of ds.publicReferences) expect(p.pageTable.length).toBeGreaterThan(0);
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

  it('unfamiliar entity produces a V17 warning, not a rejection', () => {
    const base = load('demofund_export_v1.csv');
    const mutated = base.replaceAll('DEMOFUND', 'OTHERFUND');
    const res = parseContractCsv(mutated, 'DEMOFUND');
    expect(res.ok).toBe(true);
    expect(res.warnings.map((w) => w.ruleId)).toContain('V17');
  });
});
