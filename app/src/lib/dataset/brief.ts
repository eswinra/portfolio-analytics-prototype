import type { Dataset } from './model';

/** Plain-text end-of-day brief generated from the dataset (analyst reviews, then pastes). */

const pct = (v: number | null, dp = 2) => (v === null ? 'n/a' : `${(v * 100).toFixed(dp)}%`);

export function makeDailyBrief(d: Dataset): string {
  const rt = d.readThrough;
  const lines: string[] = [];
  lines.push(`DAILY PROXY PULSE — ${d.meta.entityId} (SYNTHETIC DEMO)`);
  lines.push(`Market data through ${d.marketDate ?? 'n/a'} · dataset as of ${d.meta.asOf}`);
  lines.push('');
  lines.push(
    `Policy-weighted proxy read-through: ${pct(rt.fundLevelImpact)} at the fund level ` +
      `(covered basket ${pct(rt.coveredBasketReturn)}), covering ${pct(rt.coverage, 1)} of policy weight.`,
  );
  if (rt.unpriced.length > 0) {
    lines.push(
      `Unpriced today: ${rt.unpriced.map((u) => `${u.classLabel} (${pct(u.weight, 1)})`).join(', ')} — excluded, not imputed.`,
    );
  }
  lines.push(
    'Private-market classes are excluded from the read-through; their benchmarks are lagged 1–3 months per the IPS.',
  );
  lines.push('');
  lines.push('Proxy moves (final business day):');
  for (const p of d.proxyStrip) {
    lines.push(
      `  ${p.proxyId}: ${p.state === 'current' ? pct(p.lastReturn) : p.state.toUpperCase()} (${p.category})`,
    );
  }
  if (d.exceptions.length > 0) {
    lines.push('');
    lines.push('Exceptions requiring review:');
    for (const e of d.exceptions) {
      lines.push(`  [${e.severity.toUpperCase()}] ${e.description}`);
    }
  }
  lines.push('');
  lines.push(
    'Staff analytics on synthetic/proxy data — an operational estimate, not official performance. ' +
      'Official performance remains subject to custodian reconciliation. Not an official LACERA report.',
  );
  return lines.join('\n');
}
