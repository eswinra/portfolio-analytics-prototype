import {
  monthName,
  monthYear,
  PERIOD_INDEX,
  PERIODS,
  type CioEntity,
  type CioVintage,
} from '../fixtures/cioMonthly';

/**
 * The two-minute read: the standing questions a CIO or trustee asks of a monthly report,
 * answered from the figures on the page. Every sentence is COMPUTED from the reported values —
 * none is written for a particular month — so the layer cannot outlive the report it describes.
 * The attribution answer is a proxy estimate and says so; the rest are calculated from quoted
 * figures. The slide deck carries an equivalent implementation in its own file (it must stay
 * self-contained); both read the same fixture, and the wording is kept in step by hand.
 */

export interface NarrativePoint {
  id: string;
  /** the standing question */
  q: string;
  /** the answer, computed from this report's figures */
  a: string;
  /** panel to scroll to for the evidence */
  jumpTo: string;
  /** the answer inherits a proxy estimate rather than reported figures */
  proxy?: boolean;
}

const pct = (v: number | null | undefined) =>
  v === null || v === undefined ? '—' : `${v < 0 ? '−' : ''}${Math.abs(v).toFixed(1)}%`;
const signed = (v: number, dp = 1) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v).toFixed(dp)}`;
const moneyMm = (v: number) => `${v < 0 ? '−' : ''}$${Math.abs(v).toLocaleString('en-US')}M`;
const list = (items: string[]) =>
  items.length <= 1
    ? (items[0] ?? '')
    : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;

const excessAt = (e: CioEntity, i: number): number | null => {
  const f = e.total.r[i];
  const b = e.total.b[i];
  return f === null || f === undefined || b === null || b === undefined ? null : f - b;
};

/** Composite whose (excess × weight) contribution is the largest drag, or the largest lift when
 *  the fund is ahead — the pointer the attribution panel then quantifies. */
function leader(e: CioEntity, i: number, wantWorst: boolean) {
  const rows = e.comps
    .filter(
      (c) => c.r[i] !== null && c.r[i] !== undefined && c.b[i] !== null && c.b[i] !== undefined,
    )
    .map((c) => ({ c, v: (c.r[i]! - c.b[i]!) * (c.pct / 100) }));
  if (rows.length === 0) return null;
  return rows.reduce((a, b) => ((wantWorst ? b.v < a.v : b.v > a.v) ? b : a));
}

export function cioNarrative(
  e: CioEntity,
  v: CioVintage,
  opts: { macroLine?: string } = {},
): NarrativePoint[] {
  const { oneMonth, fytd, oneYear } = PERIOD_INDEX;
  const month = monthName(v.dataThrough);
  const points: NarrativePoint[] = [];

  // 1 — on track vs policy and hurdle
  const ahead: string[] = [];
  const behind: string[] = [];
  PERIODS.forEach((p, i) => {
    const x = excessAt(e, i);
    if (x === null) return;
    if (x > 0) ahead.push(p);
    else if (x < 0) behind.push(p);
  });
  const hurdlePeriods = [oneYear, 5, 6, 7].filter(
    (i) =>
      e.total.r[i] !== null &&
      e.total.r[i] !== undefined &&
      e.total.h[i] !== null &&
      e.total.h[i] !== undefined,
  );
  const belowHurdle = hurdlePeriods
    .filter((i) => e.total.r[i]! <= e.total.h[i]!)
    .map((i) => PERIODS[i]!);
  const x1 = excessAt(e, oneMonth);
  points.push({
    id: 'track',
    q: 'On track against policy and the hurdle?',
    a:
      `${e.short} returned ${pct(e.total.r[oneMonth])} net in ${month} against a ` +
      `${pct(e.total.b[oneMonth])} policy benchmark (${x1 === null ? '—' : `${signed(x1)} pp`}). ` +
      (ahead.length ? `Ahead over ${list(ahead)}` : 'Ahead over no period') +
      (behind.length ? `; behind over ${list(behind)}.` : '.') +
      (hurdlePeriods.length === 0
        ? ''
        : belowHurdle.length
          ? ` Below the actuarial hurdle over ${list(belowHurdle)}; above it over the other periods of one year or longer.`
          : ' Above the actuarial hurdle over every period of one year or longer.'),
    jumpTo: 'cio-perf',
  });

  // 2 — where the gap came from (proxy)
  const xF = excessAt(e, fytd);
  const xY = excessAt(e, oneYear);
  const l1 = leader(e, oneMonth, (x1 ?? 0) < 0);
  const lF = leader(e, fytd, (xF ?? 0) < 0);
  const lY = leader(e, oneYear, (xY ?? 0) < 0);
  if (l1 && lF) {
    const also = lY && lY.c.k !== lF.c.k ? ` and ${lY.c.short}` : '';
    points.push({
      id: 'gap',
      q: 'Where did the difference come from?',
      a:
        `Indicatively, ${month}'s ${(x1 ?? 0) < 0 ? 'shortfall traces to' : 'lead came mainly from'} ` +
        `${l1.c.short} (${pct(l1.c.r[oneMonth])} against a ${pct(l1.c.b[oneMonth])} benchmark); the ` +
        `fiscal-year and one-year ${(xF ?? 0) < 0 ? 'gaps trace' : 'results trace'} to ${lF.c.short}${also}. ` +
        'The panel below shows how much of the difference this proxy explains and how much is residual.',
      jumpTo: 'cio-attr',
      proxy: true,
    });
  }

  // 3 — positioned per policy
  const gaps = e.comps.map((c) => ({ c, d: c.pct - c.tgt }));
  const widest = gaps.reduce((a, b) => (Math.abs(b.d) > Math.abs(a.d) ? b : a));
  const overlayMonth = e.overlays ? e.overlays.reduce((s, o) => s + o.may, 0) : null;
  points.push({
    id: 'position',
    q: 'Positioned per policy?',
    a:
      `${Math.abs(widest.d) <= 1 ? 'Every category is within 1 pp of its 2024 SAA target' : 'Not every category is within 1 pp of its 2024 SAA target'} ` +
      `(widest: ${widest.c.short} ${signed(widest.d)} pp, ${pct(widest.c.pct)} against a ${pct(widest.c.tgt)} target). ` +
      `${month} flows netted ${moneyMm(e.netflow)}` +
      (overlayMonth === null ? '.' : `; overlay programs added ${moneyMm(overlayMonth)}.`),
    jumpTo: 'cio-comps',
  });

  // 4 — risk and market context
  const below = e.hist.c.slice(0, e.hist.latestBin).reduce((s, n) => s + n, 0);
  const months = e.hist.c.reduce((s, n) => s + n, 0) || 120;
  const tail = e.hist.c.slice(0, 5).reduce((s, n) => s + n, 0);
  const mktRows = (v.MKT ?? []).flatMap((g) => g.rows).filter((r) => r.v[fytd] !== null);
  const lead = mktRows.length ? mktRows.reduce((a, b) => (b.v[fytd]! > a.v[fytd]! ? b : a)) : null;
  points.push({
    id: 'risk',
    q: 'What is the risk and market context?',
    a:
      `${monthYear(v.dataThrough)}'s ${signed(e.hist.latest)}% sits above ${Math.round((below / months) * 100)}% ` +
      `of the last ${months} months; ${tail} of them fell below −2%.` +
      (lead ? ` ${lead.n} led the fiscal year (${signed(lead.v[fytd]!)}%).` : '') +
      (opts.macroLine ? ` ${opts.macroLine}` : ''),
    jumpTo: 'cio-hist',
  });

  return points;
}

export interface ChangeItem {
  id: string;
  label: string;
  /** signed change, in the item's own unit */
  delta: number;
  unit: string;
  detail: string;
}

/** What moved since the prior report — the short list an analyst would act on, not every
 *  difference. Thresholds: half a point of weight, a tenth of a point of return, a sign change
 *  in excess, any change in a policy target, and the fund's market value. */
export function cioChanges(cur: CioEntity, prev: CioEntity): ChangeItem[] {
  const out: ChangeItem[] = [];
  const { oneMonth, fytd, oneYear } = PERIOD_INDEX;

  const mvDelta = (cur.mv - prev.mv) / 1000;
  if (Math.abs(mvDelta) >= 0.05) {
    out.push({
      id: 'mv',
      label: 'Total fund market value',
      delta: mvDelta,
      unit: '$B',
      detail: `${prev.aum.toFixed(1)} → ${cur.aum.toFixed(1)} $B`,
    });
  }

  for (const [i, name] of [
    [fytd, 'Fiscal-year-to-date return'],
    [oneYear, 'One-year return'],
  ] as const) {
    const a = cur.total.r[i];
    const b = prev.total.r[i];
    if (a === null || a === undefined || b === null || b === undefined) continue;
    if (Math.abs(a - b) >= 0.1) {
      out.push({
        id: `ret-${i}`,
        label: name,
        delta: a - b,
        unit: 'pp',
        detail: `${pct(b)} → ${pct(a)}`,
      });
    }
  }

  PERIODS.forEach((p, i) => {
    const a = excessAt(cur, i);
    const b = excessAt(prev, i);
    if (a === null || b === null) return;
    if ((a > 0 && b < 0) || (a < 0 && b > 0)) {
      out.push({
        id: `flip-${i}`,
        label: `${p} excess turned ${a > 0 ? 'positive' : 'negative'}`,
        delta: a - b,
        unit: 'pp',
        detail: `${signed(b)} → ${signed(a)} pp against the policy benchmark`,
      });
    }
  });

  for (const c of cur.comps) {
    const p = prev.comps.find((x) => x.k === c.k);
    if (!p) continue;
    if (Math.abs(c.tgt - p.tgt) >= 0.05) {
      out.push({
        id: `tgt-${c.k}`,
        label: `${c.short} policy target changed`,
        delta: c.tgt - p.tgt,
        unit: 'pp',
        detail: `${pct(p.tgt)} → ${pct(c.tgt)} — drift is not comparable across policy versions`,
      });
    }
    if (Math.abs(c.pct - p.pct) >= 0.5) {
      out.push({
        id: `w-${c.k}`,
        label: `${c.short} weight`,
        delta: c.pct - p.pct,
        unit: 'pp',
        detail: `${pct(p.pct)} → ${pct(c.pct)} against a ${pct(c.tgt)} target`,
      });
    }
  }

  const m1 = cur.total.r[oneMonth];
  if (m1 !== null && m1 !== undefined && Math.abs(m1) >= 2) {
    out.push({
      id: 'month',
      label: `Monthly return of ${pct(m1)}`,
      delta: m1,
      unit: 'pp',
      detail: `sits above ${Math.round((cur.hist.c.slice(0, cur.hist.latestBin).reduce((s, n) => s + n, 0) / 120) * 100)}% of the last 120 months`,
    });
  }

  return out.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
}
