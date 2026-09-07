import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { CIO_LATEST } from '../../fixtures/cioMonthly';
import { parseContractCsv } from '../contract/parse';
import { buildCioFeed } from './cioFeed';
import { buildDataset } from './model';

/** The feed sample is the latest public vintage re-expressed as schema 1.4 rows: parsing it and
 *  rebuilding the entity must reproduce the extracted figures (a round trip), V24 must reject a
 *  file whose weights do not sum to 1, and the dataset must expose the feed. */

const csv = readFileSync(
  new URL('../../../../data/sample/cio_monthly_feed_demofund.csv', import.meta.url),
  'utf8',
);

describe('cio_monthly feed (schema 1.4)', () => {
  const res = parseContractCsv(csv);

  it('parses with no errors', () => {
    expect(res.errors).toEqual([]);
    expect(res.ok).toBe(true);
    expect(res.records.length).toBeGreaterThan(100);
  });

  it('round-trips the latest public vintage', () => {
    const feed = buildCioFeed(res.records);
    expect(feed).not.toBeNull();
    const e = feed!.entity;
    const p = CIO_LATEST.ENT.pension;
    expect(feed!.asOf).toBe(CIO_LATEST.dataThrough);
    expect(e.mv).toBe(p.mv);
    expect(e.cash).toBe(p.cash);
    expect(e.total.r).toEqual(p.total.r);
    expect(e.total.b).toEqual(p.total.b);
    expect(e.total.h).toEqual(p.total.h);
    p.comps.forEach((c, i) => {
      expect(e.comps[i]!.k).toBe(c.k);
      expect(e.comps[i]!.mv).toBe(c.mv);
      expect(e.comps[i]!.pct).toBe(c.pct);
      expect(e.comps[i]!.tgt).toBe(c.tgt);
      expect(e.comps[i]!.flow).toBe(c.flow);
      expect(e.comps[i]!.r).toEqual(c.r);
      expect(e.comps[i]!.b).toEqual(c.b);
    });
    expect(e.other?.mv).toBe(p.other?.mv);
    expect(e.netflow).toBe(p.netflow);
    expect(e.hist.c).toEqual(p.hist.c);
    expect(e.hist.mean).toBe(p.hist.mean);
    expect(e.hist.sd).toBe(p.hist.sd);
    expect(e.hist.latestBin).toBe(p.hist.latestBin);
    expect(feed!.classifications).toEqual(['reported_public']);
    expect(feed!.has).toEqual({ hist: true, flows: true, cash: true });
  });

  it('is carried by the dataset built from the file', () => {
    const ds = buildDataset(res.records, 'user_import', 'PENSION');
    expect(ds.cioFeed?.entityId).toBe('DEMOFUND');
    expect(ds.meta.classificationCounts.reported_public).toBe(res.records.length);
  });

  it('V24 rejects a feed whose composite weights do not sum to 1', () => {
    // bump the Growth weight by 5 pp
    const broken = csv.replace(
      /(cio_monthly,DEMOFUND,weight,GROWTH,)([\d.]+)/,
      (_m, head: string, v: string) => `${head}${(Number(v) + 0.05).toFixed(5)}`,
    );
    expect(broken).not.toBe(csv);
    const bad = parseContractCsv(broken);
    expect(bad.ok).toBe(false);
    expect(bad.errors.map((e) => e.ruleId)).toContain('V24');
  });

  it('V24 rejects a composite return without its benchmark', () => {
    const lines = csv.split('\n');
    const idx = lines.findIndex(
      (l) => l.includes(',benchmark_return,GROWTH,') && l.includes(',1M,'),
    );
    expect(idx).toBeGreaterThan(0);
    lines.splice(idx, 1);
    const bad = parseContractCsv(lines.join('\n'));
    expect(bad.ok).toBe(false);
    expect(bad.errors.some((e) => e.ruleId === 'V24' && /GROWTH\/1M/.test(e.message))).toBe(true);
  });

  it('V24 rejects an unknown feed metric', () => {
    const bad = parseContractCsv(
      csv.replace('cio_monthly,DEMOFUND,cash,TOTAL', 'cio_monthly,DEMOFUND,cash_balance,TOTAL'),
    );
    expect(bad.ok).toBe(false);
    expect(bad.errors.some((e) => e.ruleId === 'V24' && e.column === 'metric_id')).toBe(true);
  });
});
