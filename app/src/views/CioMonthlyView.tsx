import { Fragment } from 'react';

import { DateLine } from '../components/DateLine';
import { GlossaryLink } from '../components/Glossary';
import { SectionNav } from '../components/SectionNav';
import { TrendSparks } from '../components/TrendSparks';
import { CONFIG } from '../config';
import {
  ChangeChip,
  ClassBadge,
  excessTag,
  Panel,
  SourceLine,
  Tag,
  type TagVariant,
} from '../components/ui';
import {
  BINS,
  CIO_VINTAGE,
  CIO_VINTAGES,
  cioFor,
  longDate,
  MACRO,
  OPS,
  PERIOD_INDEX,
  PERIODS,
  STATUS,
  type CioEntity,
  type CioVintage,
  type OpsStatus,
} from '../fixtures/cioMonthly';
import { publishedFor, type EntityId } from '../fixtures/published';
import type { SourceRecord } from '../fixtures/sources';
import { cioChanges, cioNarrative } from '../lib/cioNarrative';
import { FEED_KEY, useCioVintage } from '../lib/cioVintage';
import { useDataset } from '../lib/dataset/useDataset';
import { useEntity } from '../lib/entity';
import { useUrlFlag, useUrlParam } from '../lib/urlState';

/** Panels in page order, for the sticky section bar. */
const SECTIONS: [id: string, label: string][] = [
  ['cio-read', 'Two-minute read'],
  ['cio-changed', 'What changed'],
  ['cio-perf', 'Performance'],
  ['cio-attr', 'Attribution'],
  ['cio-comps', 'Composites'],
  ['cio-trend', 'Across reports'],
  ['cio-flows', 'Flows'],
  ['cio-hist', 'Distribution'],
  ['cio-market', 'Markets'],
  ['cio-geo', 'Geography'],
  ['cio-ops', 'Items for attention'],
];

/** CIO Monthly — the monthly vintage rendered as dashboard panels from the same fixture that
 *  feeds the slide deck at /deck/. Any extracted report can be selected (the URL carries it);
 *  changes are shown against the prior report. Deliberately separate from the fiscal-year tabs:
 *  nothing here is combined with FY2025. */

const pct = (v: number | null | undefined) =>
  v === null || v === undefined ? '—' : `${v < 0 ? '−' : ''}${Math.abs(v).toFixed(1)}%`;
const signed = (v: number | null | undefined, dp = 1) =>
  v === null || v === undefined
    ? '—'
    : `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v).toFixed(dp)}`;
const mm = (v: number) => v.toLocaleString('en-US');
const moneyMm = (v: number) => `${v < 0 ? '−' : ''}$${mm(Math.abs(v))}M`;
const diff = (a: number | null | undefined, b: number | null | undefined): number | null =>
  a === null || a === undefined || b === null || b === undefined ? null : a - b;

const STATUS_VARIANT: Record<OpsStatus, TagVariant> = {
  prog: 'accent',
  dev: 'neutral',
  info: 'outline',
  quiet: 'blocked',
  done: 'accent',
};

/** Source record for one report's pages, built per vintage (the registry holds fixed documents). */
function cioSource(v: CioVintage, pages: string, firstPage: number | null): SourceRecord {
  const url = v.url && firstPage ? `${v.url}#page=${firstPage}` : null;
  const isFeed = v.url === null && v.pages.flows === 0;
  return {
    id: `CIO_${v.dataThrough}_${pages}`,
    label: isFeed
      ? `imported dataset ${v.file} (${pages})`
      : `CIO Monthly Report (${v.reportLabel}), ${pages}`,
    doc: isFeed
      ? 'Workstation dataset — schema 1.4 cio_monthly rows'
      : 'Chief Investment Officer Monthly Report',
    pageTable: pages,
    asOf: longDate(v.dataThrough),
    ...(url ? { url } : {}),
  };
}

/** Slide index in the deck (its URL hash is the slide number). */
const SLIDE = { summary: 2, perf: 3, wf: 4, alloc: 5, hist: 6, market: 7, geo: 8, ops: 9 } as const;

function DeckLink({ n, show }: { n: number; show: boolean }) {
  if (!show) return null;
  return (
    <a className="deck-link" href={`deck/#${n}`}>
      Slide {n} in the deck ↗
    </a>
  );
}

/** Both funds' composites for one report. Each fund has its own policy allocation, so the
 *  targets differ by design; the drift columns are what compare, not the weights. */
function CompositesCompare({ a, b }: { a: CioEntity; b: CioEntity }) {
  const sgn = (v: number) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v).toFixed(1)}`;
  return (
    <div className="table-scroll" role="region" aria-label="Composites, both funds" tabIndex={0}>
      <table className="table">
        <caption>
          Both funds side by side: weight, 2024 SAA target and drift (weight − target, calculated)
          for the same report. The two funds hold different policy allocations, so compare the drift
          columns rather than the weights.
        </caption>
        <thead>
          <tr>
            <th scope="col" rowSpan={2}>
              Composite
            </th>
            <th scope="col" colSpan={3} className="num grp">
              {a.short}
            </th>
            <th scope="col" colSpan={3} className="num grp">
              {b.short}
            </th>
          </tr>
          <tr>
            <th scope="col" className="num grp">
              Weight
            </th>
            <th scope="col" className="num">
              Target
            </th>
            <th scope="col" className="num">
              Drift
            </th>
            <th scope="col" className="num grp">
              Weight
            </th>
            <th scope="col" className="num">
              Target
            </th>
            <th scope="col" className="num">
              Drift
            </th>
          </tr>
        </thead>
        <tbody>
          {a.comps.map((c) => {
            const d = b.comps.find((x) => x.k === c.k);
            return (
              <tr key={c.k}>
                <td>{c.short}</td>
                <td className="num grp" style={{ fontWeight: 500 }}>
                  {c.pct.toFixed(1)}%
                </td>
                <td className="num">{c.tgt.toFixed(1)}%</td>
                <td className="num">{sgn(c.pct - c.tgt)} pp</td>
                <td className="num grp" style={{ fontWeight: 500 }}>
                  {d ? `${d.pct.toFixed(1)}%` : '—'}
                </td>
                <td className="num">{d ? `${d.tgt.toFixed(1)}%` : '—'}</td>
                <td className="num">{d ? `${sgn(d.pct - d.tgt)} pp` : '—'}</td>
              </tr>
            );
          })}
          <tr style={{ fontWeight: 600 }}>
            <td>Total fund market value</td>
            <td className="num grp" colSpan={3}>
              ${a.aum.toFixed(1)}B
            </td>
            <td className="num grp" colSpan={3}>
              ${b.aum.toFixed(1)}B
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function entityPages(v: CioVintage, key: 'pension' | 'opeb') {
  const [summary, table, hist, geo] = v.pages[key];
  const last = Math.max(table, hist);
  return {
    main: cioSource(v, summary === last ? `p. ${summary}` : `pp. ${summary}–${last}`, summary),
    geo: cioSource(v, `p. ${geo}`, geo),
  };
}

export function CioMonthlyView() {
  const { entity } = useEntity();
  const { dataset } = useDataset();
  const { vintage, prior, isLatest, feed, feedAvailable, select } = useCioVintage();
  const P = entity === 'PENSION';
  const key = P ? 'pension' : 'opeb';
  const e = cioFor(entity, vintage);
  const ep = prior ? cioFor(entity, prior) : null;
  const src = entityPages(vintage, key);
  const flowsSrc = cioSource(vintage, `p. ${vintage.pages.flows}`, vintage.pages.flows);
  const marketSrc = cioSource(
    vintage,
    vintage.pages.market ? `p. ${vintage.pages.market}` : 'market table not readable',
    vintage.pages.market,
  );
  const { oneMonth, fytd, oneYear } = PERIOD_INDEX;
  const excess = (x: CioEntity, i: number) => diff(x.total.r[i], x.total.b[i]);
  const tagFor = (f: number | null | undefined, b: number | null | undefined) =>
    f === null || f === undefined || b === null || b === undefined ? null : excessTag(f, b);
  // view state lives in the URL so a pasted link reproduces the screen
  const [perfView, setPerfView] = useUrlParam('perf', 'returns');
  const [attrRaw, setAttrRaw] = useUrlParam('attr', String(oneYear));
  const attrPeriod = PERIODS[Number(attrRaw)] ? Number(attrRaw) : oneYear;
  const setAttrPeriod = (i: number) => setAttrRaw(String(i));
  const [trendView, setTrendView] = useUrlParam('trend', 'chart');
  const [compare, setCompare] = useUrlFlag('compare');
  // the other fund, for side-by-side comparison; the header toggle still sets the primary one
  const otherEntity: EntityId = P ? 'OPEB' : 'PENSION';
  const o = cioFor(otherEntity, vintage);
  const cmp = compare && !feed;
  const jump = (id: string) =>
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  const excessMax = Math.max(0.1, ...PERIODS.map((_, i) => Math.abs(excess(e, i) ?? 0)));

  // IPS range for a composite: the policy in force (IPS Table 1, restated June 12, 2024) against
  // the month-end weight — calculated here; the IPS defines no mechanical trigger
  const majors = publishedFor(entity).majors;
  const norm = (s: string) =>
    s
      .replace(/^OPEB /, '')
      .replace('&', 'and')
      .toLowerCase();
  const ipsFor = (name: string) => {
    const m = majors.find((row) => norm(row[0]) === norm(name));
    return m ? { lo: m[1] - m[2], hi: m[1] + m[2] } : null;
  };

  // proxy attribution, as on the deck's slide 4: (composite return − its benchmark) × month-end
  // weight; the residual carries everything the proxy cannot see (allocation effect, overlays,
  // cash, compounding, beginning-of-period weights) and is shown, never hidden
  const attribution = [fytd, attrPeriod].map((i) => {
    const rows = e.comps.map((c) => ({
      label: c.short,
      contrib: c.r[i] !== null && c.b[i] !== null ? (c.r[i]! - c.b[i]!) * (c.pct / 100) : null,
    }));
    const explained = rows.reduce((s, r) => s + (r.contrib ?? 0), 0);
    const total = excess(e, i);
    return {
      period: PERIODS[i]!,
      rows,
      explained,
      total,
      residual: total === null ? null : total - explained,
    };
  });

  const histMax = Math.max(...e.hist.c);
  const monthLabel = longDate(vintage.dataThrough);
  // the four standing questions, answered from this report's figures; the macro line is
  // editorial content and exists for the latest public report only
  const narrative = cioNarrative(
    e,
    vintage,
    isLatest && MACRO[0] && MACRO[1]
      ? {
          macroLine: `${MACRO[0].l.replace(/,.*$/, '')} ${MACRO[0].v}, ${MACRO[1].l.replace(/,.*$/, '')} ${MACRO[1].v}.`,
        }
      : {},
  );
  const changes = ep ? cioChanges(e, ep) : [];

  return (
    <>
      <SectionNav sections={SECTIONS} />
      <DateLine
        report={vintage.reportLabel}
        dataThrough={monthLabel}
        retrieved={`the ${CIO_VINTAGE.title} of ${vintage.reportLabel}`}
      />
      <div className="vintage-bar">
        <label>
          Report{' '}
          <select
            aria-label="Report"
            value={feed ? FEED_KEY : vintage.dataThrough}
            onChange={(ev) => select(ev.target.value)}
          >
            {feedAvailable ? (
              <option value={FEED_KEY}>
                Workstation dataset ({feedAvailable.entityId}) — data through{' '}
                {longDate(feedAvailable.asOf)}
              </option>
            ) : null}
            {[...CIO_VINTAGES].reverse().map((v) => (
              <option key={v.dataThrough} value={v.dataThrough}>
                {v.reportLabel} — data through {longDate(v.dataThrough)}
              </option>
            ))}
          </select>
        </label>
        {feed ? null : (
          <label className="vintage-compare">
            <input
              type="checkbox"
              checked={compare}
              onChange={(ev) => setCompare(ev.target.checked)}
            />{' '}
            Compare both funds
          </label>
        )}
        <span className="footnote">
          {prior
            ? `Changes are shown against the ${prior.reportLabel} report (data through ${longDate(prior.dataThrough)}).`
            : 'Earliest report in the series — no prior report to compare.'}
          {isLatest ? '' : ' The slide deck always shows the latest public report.'}
        </span>
      </div>
      {feed ? (
        <div
          className={`publish-banner ${dataset.publishEligible ? 'ok' : 'blocked'}`}
          role="status"
        >
          <strong>Workstation feed (schema 1.4):</strong> {feed.rowCount} cio_monthly rows for{' '}
          {feed.entityId}, data through {longDate(feed.asOf)}, from {feed.sourceName} (
          {feed.pageTable}); classification {feed.classifications.join(', ')}. Publication gate
          (demonstrated):{' '}
          {dataset.publishEligible
            ? 'ELIGIBLE — no blocking conditions in the active dataset.'
            : `INELIGIBLE — ${dataset.publishBlockers.join(' · ')}.`}{' '}
          In the internal version this feed also regenerates the deck; on this public site the deck
          shows the latest public report.
        </div>
      ) : null}
      <div className="muted-note vintage-note" role="note">
        <strong>Monthly vintage, kept apart from the fiscal-year tabs.</strong>{' '}
        {feed
          ? `This tab renders the imported workstation dataset (${feed.entityId}) with fund data through ${monthLabel} — not a published report.`
          : `This tab quotes the ${CIO_VINTAGE.title} of ${vintage.reportLabel}, with fund data through ${monthLabel}.`}{' '}
        The fund's market value here is not the June 30, 2025 fiduciary net position on the
        Overview, and monthly periods are not fiscal-year horizons; the two vintages are never
        combined.
        {isLatest ? (
          <>
            {' '}
            The same figures drive the <a href="deck/">slide deck</a>.
          </>
        ) : null}
      </div>

      <div className="grid-kpi">
        <Panel tight kicker="Total fund market value">
          <div className="stat-value">${e.aum.toFixed(1)}B</div>
          <div className="stat-sub">
            ${mm(e.mv)}M · cash and equivalents ${mm(e.cash)}M
          </div>
          <div className="stat-foot">
            {ep ? (
              <ChangeChip
                delta={e.mv - ep.mv}
                unit="$M"
                dp={0}
                title={`against the ${prior?.reportLabel} report`}
              />
            ) : null}
            <button type="button" className="linklike" onClick={() => jump('cio-comps')}>
              composites ↓
            </button>
          </div>
        </Panel>
        <Panel tight kicker="Net return — 1 month">
          <div className="stat-value">{pct(e.total.r[oneMonth])}</div>
          <div className="stat-sub">
            Policy benchmark {pct(e.total.b[oneMonth])} · {signed(excess(e, oneMonth))} pp excess
          </div>
          <div className="stat-foot">
            {ep ? (
              <ChangeChip
                delta={diff(e.total.r[oneMonth], ep.total.r[oneMonth])}
                unit="pp"
                title={`against the prior report's month (${pct(ep.total.r[oneMonth])})`}
              />
            ) : null}
            <button type="button" className="linklike" onClick={() => jump('cio-perf')}>
              by period ↓
            </button>
          </div>
        </Panel>
        <Panel tight kicker="Net return — fiscal year to date">
          <div className="stat-value">{pct(e.total.r[fytd])}</div>
          <div className="stat-sub">
            Benchmark {pct(e.total.b[fytd])} · actuarial hurdle {pct(e.total.h[fytd])}
          </div>
          <div className="stat-foot">
            {ep ? (
              <ChangeChip
                delta={diff(e.total.r[fytd], ep.total.r[fytd])}
                unit="pp"
                title={`against the ${prior?.reportLabel} report (${pct(ep.total.r[fytd])})`}
              />
            ) : null}
            <button type="button" className="linklike" onClick={() => jump('cio-attr')}>
              where the difference came from ↓
            </button>
          </div>
        </Panel>
        <Panel tight kicker="Net return — 1 year">
          <div className="stat-value">{pct(e.total.r[oneYear])}</div>
          <div className="stat-sub">
            Policy benchmark {pct(e.total.b[oneYear])} · {signed(excess(e, oneYear))} pp excess
          </div>
          <div className="stat-foot">
            {ep ? (
              <ChangeChip
                delta={diff(e.total.r[oneYear], ep.total.r[oneYear])}
                unit="pp"
                title={`against the ${prior?.reportLabel} report (${pct(ep.total.r[oneYear])})`}
              />
            ) : null}
            <button type="button" className="linklike" onClick={() => jump('cio-trend')}>
              across reports ↓
            </button>
          </div>
        </Panel>
      </div>
      <div className="kpi-provenance">
        <ClassBadge c="reported_public" />
        <span>
          Figures as printed in the CIO Monthly Report ({e.pages}); differences and changes against
          the prior report are calculated from the printed one-decimal values, so ±0.1 pp rounding
          is possible.
        </span>
        <SourceLine records={[src.main]} />
      </div>

      <div className="grid-panels mt">
        <Panel
          id="cio-read"
          kicker="Two-minute read"
          title={`What this report says about the ${e.short}`}
          sub="Every sentence is computed from the figures on this page — nothing here is written for a particular month"
        >
          <div className="read-list">
            {narrative.map((p, i) => (
              <div className="read-item" key={p.id}>
                <div className="n">0{i + 1}</div>
                <div>
                  <div className="q">{p.q}</div>
                  <div className="a">{p.a}</div>
                  <div className="go">
                    <button type="button" className="linklike" onClick={() => jump(p.jumpTo)}>
                      See the figures ↓
                    </button>
                    <ClassBadge c={p.proxy ? 'proxy_estimate' : 'calculated'} />
                  </div>
                </div>
              </div>
            ))}
          </div>
          <p className="panel-note">
            Read against the reported figures below, which are quoted as printed. A sentence marked{' '}
            <em>proxy estimate</em> points to where to look; it does not quantify manager value-add.
          </p>
          <SourceLine records={[src.main]} />
        </Panel>

        <Panel
          id="cio-changed"
          kicker={prior ? `Against the ${prior.reportLabel} report` : 'Against the prior report'}
          title={
            !ep
              ? 'No prior report in the series'
              : changes.length === 0
                ? 'Nothing moved past the reporting thresholds'
                : `What changed (${changes.length})`
          }
          sub="Weights of half a point or more, returns of a tenth or more, an excess that changed sign, and any policy-target change"
        >
          {!ep ? (
            <p className="muted-note">
              This is the earliest report on the site, so there is nothing to compare it with.
            </p>
          ) : changes.length === 0 ? (
            <p className="muted-note">
              Every figure moved by less than the thresholds above. The tables below carry the exact
              values.
            </p>
          ) : (
            <div className="change-list">
              {changes.map((c) => (
                <div className="change-row" key={c.id}>
                  <span>{c.label}</span>
                  <ChangeChip delta={c.delta} unit={c.unit} dp={c.unit === '$B' ? 1 : 1} />
                  <span className="detail">{c.detail}</span>
                </div>
              ))}
            </div>
          )}
          <p className="panel-note">
            Changes are calculated from the two reports' printed one-decimal values. A policy-target
            change is called out because drift is not comparable across policy versions.
          </p>
          {prior ? <SourceLine records={[src.main, entityPages(prior, key).main]} /> : null}
        </Panel>
      </div>

      <div className="grid-panels mt">
        <Panel
          id="cio-perf"
          kicker="Net of fees — total fund"
          title="Performance vs. policy benchmark and actuarial hurdle"
          sub={CIO_VINTAGE.periodNote}
        >
          {cmp ? null : (
            <div className="seg-mini" role="group" aria-label="View">
              <button
                type="button"
                aria-pressed={perfView === 'returns'}
                onClick={() => setPerfView('returns')}
              >
                Returns
              </button>
              <button
                type="button"
                aria-pressed={perfView === 'excess'}
                onClick={() => setPerfView('excess')}
              >
                Excess vs. benchmark
              </button>
            </div>
          )}
          <div
            className="table-scroll"
            role="region"
            aria-label="Performance by period"
            tabIndex={0}
          >
            {cmp ? (
              <table className="table">
                <caption>
                  Both funds side by side for the same report; each fund is measured against its own
                  policy benchmark, so the excess columns are comparable and the return columns are
                  not a like-for-like ranking
                </caption>
                <thead>
                  <tr>
                    <th scope="col" rowSpan={2}>
                      Period
                    </th>
                    <th scope="col" colSpan={3} className="num grp">
                      {e.short}
                    </th>
                    <th scope="col" colSpan={3} className="num grp">
                      {o.short}
                    </th>
                  </tr>
                  <tr>
                    <th scope="col" className="num grp">
                      Fund
                    </th>
                    <th scope="col" className="num">
                      Benchmark
                    </th>
                    <th scope="col" className="num">
                      Excess
                    </th>
                    <th scope="col" className="num grp">
                      Fund
                    </th>
                    <th scope="col" className="num">
                      Benchmark
                    </th>
                    <th scope="col" className="num">
                      Excess
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {PERIODS.map((p, i) => (
                    <tr key={p}>
                      <td>{p}</td>
                      <td className="num grp" style={{ fontWeight: 500 }}>
                        {pct(e.total.r[i])}
                      </td>
                      <td className="num">{pct(e.total.b[i])}</td>
                      <td className="num">
                        {excess(e, i) === null ? '—' : `${signed(excess(e, i))} pp`}
                      </td>
                      <td className="num grp" style={{ fontWeight: 500 }}>
                        {pct(o.total.r[i])}
                      </td>
                      <td className="num">{pct(o.total.b[i])}</td>
                      <td className="num">
                        {excess(o, i) === null ? '—' : `${signed(excess(o, i))} pp`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : perfView === 'returns' ? (
              <table className="table">
                <caption>
                  Total fund return, policy benchmark, excess, and actuarial hurdle by period
                  {ep ? '; prior column = the same period in the prior report' : ''}
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Period</th>
                    <th scope="col" className="num">
                      Fund
                    </th>
                    <th scope="col" className="num">
                      Benchmark
                    </th>
                    <th scope="col" className="num">
                      Excess
                    </th>
                    <th scope="col" className="num">
                      Hurdle
                    </th>
                    {ep ? (
                      <th scope="col" className="num">
                        Prior report
                      </th>
                    ) : null}
                  </tr>
                </thead>
                <tbody>
                  {PERIODS.map((p, i) => {
                    const t = tagFor(e.total.r[i], e.total.b[i]);
                    return (
                      <tr key={p}>
                        <td>{p}</td>
                        <td className="num" style={{ fontWeight: 500 }}>
                          {pct(e.total.r[i])}
                        </td>
                        <td className="num">{pct(e.total.b[i])}</td>
                        <td className="num">{t ? <Tag variant={t.variant}>{t.text}</Tag> : '—'}</td>
                        <td className="num">{pct(e.total.h[i])}</td>
                        {ep ? <td className="num">{pct(ep.total.r[i])}</td> : null}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              <table className="table">
                <caption>
                  Excess = fund − benchmark and margin over the actuarial hurdle, by period
                  (calculated, percentage points); bar length is relative to the largest excess
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Period</th>
                    <th scope="col" className="num">
                      Excess
                    </th>
                    <th scope="col">Signed bar</th>
                    <th scope="col" className="num">
                      vs. hurdle
                    </th>
                    {ep ? (
                      <th scope="col" className="num">
                        Prior report excess
                      </th>
                    ) : null}
                  </tr>
                </thead>
                <tbody>
                  {PERIODS.map((p, i) => {
                    const x = excess(e, i);
                    const h = diff(e.total.r[i], e.total.h[i]);
                    return (
                      <tr key={p}>
                        <td>{p}</td>
                        <td className="num" style={{ fontWeight: 500 }}>
                          {x === null ? '—' : `${signed(x)} pp`}
                        </td>
                        <td className="excess-cell">
                          {x === null ? null : (
                            <div
                              className={`fill${x < 0 ? ' neg' : ''}`}
                              style={{ width: `${((Math.abs(x) / excessMax) * 100).toFixed(1)}%` }}
                              aria-hidden="true"
                            />
                          )}
                        </td>
                        <td className="num">{h === null ? '—' : `${signed(h)} pp`}</td>
                        {ep ? (
                          <td className="num">
                            {excess(ep, i) === null ? '—' : `${signed(excess(ep, i))} pp`}
                          </td>
                        ) : null}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
          <p className="panel-note">
            Excess = fund − benchmark (calculated). The actuarial hurdle applies at the total-fund
            level only. A period the report does not print shows as —.{' '}
            <GlossaryLink>What these terms mean</GlossaryLink>.
            {cmp
              ? ' The two funds hold different policy allocations and different benchmarks; compare each against its own benchmark, not against each other.'
              : ''}
          </p>
          <SourceLine
            records={
              cmp ? [src.main, entityPages(vintage, P ? 'opeb' : 'pension').main] : [src.main]
            }
          />
          <DeckLink n={SLIDE.perf} show={isLatest} />
        </Panel>

        <Panel
          id="cio-attr"
          kicker="Where the benchmark gap came from"
          title="Composite excess × month-end weight"
          sub="Proxy estimate — a pointer to where to look, not a manager value-add figure"
        >
          <div className="kpi-provenance" style={{ marginTop: 0, marginBottom: 8 }}>
            <ClassBadge c="proxy_estimate" />
            <span>
              Contribution = (composite return − its policy benchmark) × month-end weight. Not the
              report's attribution and not a Brinson decomposition.
            </span>
            <label className="footnote">
              Second period{' '}
              <select
                aria-label="Attribution period"
                value={attrPeriod}
                onChange={(ev) => setAttrPeriod(Number(ev.target.value))}
              >
                {PERIODS.map((p, i) =>
                  i === fytd ? null : (
                    <option key={p} value={i}>
                      {p}
                    </option>
                  ),
                )}
              </select>
            </label>
          </div>
          <div className="table-scroll" role="region" aria-label="Gap attribution" tabIndex={0}>
            <table className="table">
              <caption>Contribution to total-fund excess, percentage points</caption>
              <thead>
                <tr>
                  <th scope="col">Composite</th>
                  {attribution.map((a) => (
                    <th scope="col" className="num" key={a.period}>
                      {a.period}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {e.comps.map((c, ci) => (
                  <tr key={c.k}>
                    <td>{c.short}</td>
                    {attribution.map((a) => {
                      const v = a.rows[ci]!.contrib;
                      return (
                        <td className="num" key={a.period}>
                          {v === null ? '—' : `${signed(v, 2)} pp`}
                        </td>
                      );
                    })}
                  </tr>
                ))}
                <tr style={{ fontWeight: 600 }}>
                  <td>Explained by the proxy</td>
                  {attribution.map((a) => (
                    <td className="num" key={a.period}>
                      {signed(a.explained, 2)} pp
                    </td>
                  ))}
                </tr>
                <tr>
                  <td>Residual (allocation, overlays, cash, compounding)</td>
                  {attribution.map((a) => (
                    <td className="num" key={a.period}>
                      {a.residual === null ? '—' : `${signed(a.residual, 2)} pp`}
                    </td>
                  ))}
                </tr>
                <tr style={{ fontWeight: 600 }}>
                  <td>Total-fund excess (reported fund − benchmark)</td>
                  {attribution.map((a) => (
                    <td className="num" key={a.period}>
                      {a.total === null ? '—' : `${signed(a.total, 1)} pp`}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
          <p className="panel-note">
            Beginning-of-period weights, the allocation effect, overlays, cash and compounding are
            all folded into the residual, shown so the reader can see how much the proxy explains.
          </p>
          <SourceLine records={[src.main]} />
          <DeckLink n={SLIDE.wf} show={isLatest} />
        </Panel>
      </div>

      <Panel
        id="cio-comps"
        className="mt"
        kicker={`Composites — ${monthLabel}`}
        title="Market value, weight vs. 2024 SAA target and IPS range, returns vs. benchmark"
      >
        {cmp ? (
          <CompositesCompare a={e} b={o} />
        ) : (
          <div className="table-scroll" role="region" aria-label="Composites" tabIndex={0}>
            <table className="table cardable" role="table">
              <caption>
                Drift = weight − target; Δ weight = change against the prior report; IPS range and
                distance to the nearer bound compare the month-end weight with the policy in force
                (IPS Table 1, restated June 12, 2024) — all calculated. Return cells show composite
                / policy benchmark.
              </caption>
              <thead role="rowgroup">
                <tr role="row">
                  <th scope="col" role="columnheader">
                    Composite
                  </th>
                  <th scope="col" role="columnheader" className="num">
                    Market value ($M)
                  </th>
                  <th scope="col" role="columnheader" className="num">
                    Weight
                  </th>
                  <th scope="col" role="columnheader" className="num">
                    Target
                  </th>
                  <th scope="col" role="columnheader" className="num">
                    Drift
                  </th>
                  <th scope="col" role="columnheader" className="num">
                    Δ weight
                  </th>
                  <th scope="col" role="columnheader" className="num">
                    IPS range
                  </th>
                  <th scope="col" role="columnheader" className="num">
                    To bound
                  </th>
                  <th scope="col" role="columnheader" className="num">
                    1 M
                  </th>
                  <th scope="col" role="columnheader" className="num">
                    FYTD
                  </th>
                  <th scope="col" role="columnheader" className="num">
                    1 Y
                  </th>
                </tr>
              </thead>
              <tbody role="rowgroup">
                {e.comps.map((c) => {
                  const pc = ep?.comps.find((x) => x.k === c.k);
                  const ips = ipsFor(c.n);
                  const dist = ips ? Math.min(c.pct - ips.lo, ips.hi - c.pct) : null;
                  return (
                    <tr role="row" key={c.k}>
                      <td role="cell" data-label="Composite">
                        {c.n}
                      </td>
                      <td role="cell" className="num" data-label="Market value ($M)">
                        {mm(c.mv)}
                      </td>
                      <td
                        role="cell"
                        className="num"
                        data-label="Weight"
                        style={{ fontWeight: 500 }}
                      >
                        {c.pct.toFixed(1)}%
                      </td>
                      <td role="cell" className="num" data-label="Target">
                        {c.tgt.toFixed(1)}%
                      </td>
                      <td role="cell" className="num" data-label="Drift">
                        {signed(c.pct - c.tgt)} pp
                      </td>
                      <td role="cell" className="num" data-label="Δ weight">
                        {pc ? `${signed(c.pct - pc.pct)} pp` : '—'}
                      </td>
                      <td role="cell" className="num" data-label="IPS range">
                        {ips ? `${ips.lo}–${ips.hi}%` : '—'}
                      </td>
                      <td role="cell" className="num" data-label="To bound">
                        {dist === null ? (
                          '—'
                        ) : (
                          <>
                            {dist.toFixed(1)} pp{' '}
                            {dist < 0 ? (
                              <Tag variant="blocked">outside</Tag>
                            ) : dist <= CONFIG.nearBoundPp ? (
                              <Tag variant="outline">near bound</Tag>
                            ) : null}
                          </>
                        )}
                      </td>
                      {[oneMonth, fytd, oneYear].map((i) => (
                        <td role="cell" className="num" data-label={PERIODS[i]} key={i}>
                          {pct(c.r[i])} / {pct(c.b[i])}
                        </td>
                      ))}
                    </tr>
                  );
                })}
                {e.other ? (
                  <tr role="row">
                    <td role="cell" data-label="Composite">
                      {e.other.n}
                    </td>
                    <td role="cell" className="num" data-label="Market value ($M)">
                      {mm(e.other.mv)}
                    </td>
                    <td role="cell" className="num" data-label="Weight">
                      {e.other.pct.toFixed(1)}%
                    </td>
                    <td role="cell" className="num" data-label="Target">
                      —
                    </td>
                    <td role="cell" className="num" data-label="Drift">
                      no policy weight
                    </td>
                    <td role="cell" className="num" data-label="Δ weight">
                      —
                    </td>
                    <td role="cell" className="num" data-label="IPS range">
                      —
                    </td>
                    <td role="cell" className="num" data-label="To bound">
                      —
                    </td>
                    <td role="cell" className="num" data-label="1 M">
                      —
                    </td>
                    <td role="cell" className="num" data-label="FYTD">
                      —
                    </td>
                    <td role="cell" className="num" data-label="1 Y">
                      —
                    </td>
                  </tr>
                ) : null}
                <tr role="row" style={{ fontWeight: 600 }}>
                  <td role="cell" data-label="Composite">
                    {e.name}
                  </td>
                  <td role="cell" className="num" data-label="Market value ($M)">
                    {mm(e.mv)}
                  </td>
                  <td role="cell" className="num" data-label="Weight">
                    100.0%
                  </td>
                  <td role="cell" className="num" data-label="Target">
                    100.0%
                  </td>
                  <td role="cell" className="num" data-label="Drift">
                    —
                  </td>
                  <td role="cell" className="num" data-label="Δ weight">
                    —
                  </td>
                  <td role="cell" className="num" data-label="IPS range">
                    —
                  </td>
                  <td role="cell" className="num" data-label="To bound">
                    —
                  </td>
                  {[oneMonth, fytd, oneYear].map((i) => (
                    <td role="cell" className="num" data-label={PERIODS[i]} key={i}>
                      {pct(e.total.r[i])} / {pct(e.total.b[i])}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        )}
        <p className="panel-note">
          The IPS range is the policy in force, quoted from IPS Table 1, set against the month-end
          weight as printed; “near bound” flags a weight within {CONFIG.nearBoundPp.toFixed(1)} pp
          of a boundary. Range status is a factual report — the IPS defines no mechanical trade
          trigger, and this is not a compliance statement. Composites have no 10-year figure in the
          report. Real estate and private equity values are best-available cash-flow-adjusted market
          values.
        </p>
        <SourceLine sources={P ? ['IPS_T1'] : ['IPS_OPEB_T1']} records={[src.main]} />
        <DeckLink n={SLIDE.alloc} show={isLatest} />
      </Panel>

      <Panel
        id="cio-trend"
        className="mt"
        kicker="Across reports"
        title="Trend by report, oldest first"
        sub="Each row is one report as printed; excess is calculated. Select a row to open that month."
      >
        <div className="seg-mini" role="group" aria-label="Trend view">
          <button
            type="button"
            aria-pressed={trendView === 'chart'}
            onClick={() => setTrendView('chart')}
          >
            Chart
          </button>
          <button
            type="button"
            aria-pressed={trendView === 'table'}
            onClick={() => setTrendView('table')}
          >
            Table
          </button>
        </div>
        {trendView === 'chart' ? (
          <>
            <TrendSparks vintages={CIO_VINTAGES} entityOf={(v) => cioFor(entity, v)} />
            <p className="footnote" style={{ marginTop: 10 }}>
              Shapes only — the table has the values, and a report that does not print a period
              leaves a gap in the line rather than a straight segment through it.
            </p>
          </>
        ) : null}
        <div
          className="table-scroll"
          role="region"
          aria-label="Trend across reports"
          tabIndex={0}
          hidden={trendView === 'chart'}
        >
          <table className="table">
            <caption>
              Market value, monthly and fiscal-year-to-date return, one-year excess, composite
              weights and net rebalancing flow for every extracted report
            </caption>
            <thead>
              <tr>
                <th scope="col">Data through</th>
                <th scope="col" className="num">
                  MV ($B)
                </th>
                <th scope="col" className="num">
                  1 M
                </th>
                <th scope="col" className="num">
                  FYTD
                </th>
                <th scope="col" className="num">
                  1 Y excess
                </th>
                {e.comps.map((c) => (
                  <th scope="col" className="num" key={c.k}>
                    {c.short}
                  </th>
                ))}
                <th scope="col" className="num">
                  Net flow ($M)
                </th>
              </tr>
            </thead>
            <tbody>
              {CIO_VINTAGES.map((v) => {
                const x = cioFor(entity, v);
                const current = v === vintage;
                return (
                  <tr key={v.dataThrough} className={current ? 'trend-current' : undefined}>
                    <td>
                      {current ? (
                        <strong>{longDate(v.dataThrough)}</strong>
                      ) : (
                        <button
                          type="button"
                          className="linklike"
                          onClick={() => select(v.dataThrough)}
                        >
                          {longDate(v.dataThrough)}
                        </button>
                      )}
                    </td>
                    <td className="num">{x.aum.toFixed(1)}</td>
                    <td className="num">{pct(x.total.r[oneMonth])}</td>
                    <td className="num">{pct(x.total.r[fytd])}</td>
                    <td className="num">
                      {excess(x, oneYear) === null ? '—' : `${signed(excess(x, oneYear))} pp`}
                    </td>
                    {e.comps.map((c) => {
                      const xc = x.comps.find((k) => k.k === c.k);
                      return (
                        <td className="num" key={c.k}>
                          {xc ? `${xc.pct.toFixed(1)}%` : '—'}
                        </td>
                      );
                    })}
                    <td className="num">{mm(x.netflow)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="panel-note">
          FYTD resets each July (fiscal year ends June 30). Reports whose performance table is not
          machine-readable are absent from the series and are listed in the extractor's log.
        </p>
        <SourceLine>
          {CIO_VINTAGES.length} CIO Monthly Reports, {CIO_VINTAGES[0]!.reportLabel} through{' '}
          {CIO_VINTAGES[CIO_VINTAGES.length - 1]!.reportLabel} — each report's own pages; select a
          row to open that month with its citation
        </SourceLine>
      </Panel>

      <div className="grid-panels mt">
        <Panel
          id="cio-flows"
          kicker={`${monthLabel} rebalancing activity`}
          title="Flows by composite"
        >
          <div>
            {e.comps.map((c) => (
              <div className="flow-row" key={c.k}>
                <span>{c.short}</span>
                <span className="v">{moneyMm(c.flow)}</span>
              </div>
            ))}
            {e.other ? (
              <div className="flow-row">
                <span>{e.other.n}</span>
                <span className="v">{moneyMm(e.other.flow)}</span>
              </div>
            ) : null}
            <div className="flow-row">
              <span style={{ fontWeight: 600 }}>Net flow</span>
              <span className="v">{moneyMm(e.netflow)}</span>
            </div>
          </div>
          {e.overlays ? (
            <div
              className="table-scroll"
              style={{ marginTop: 14 }}
              role="region"
              aria-label="Overlay programs"
              tabIndex={0}
            >
              <table className="table">
                <caption>Overlay programs — gains, $ millions</caption>
                <thead>
                  <tr>
                    <th scope="col">Program</th>
                    <th scope="col" className="num">
                      Month
                    </th>
                    <th scope="col" className="num">
                      Since inception
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {e.overlays.map((o) => (
                    <tr key={o.n}>
                      <td>{o.n}</td>
                      <td className="num">{o.may.toFixed(1)}</td>
                      <td className="num">{o.si.toFixed(1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
          <p className="panel-note">
            Flows may include capital calls, distributions and cash management, so a flow away from
            target is a prompt for a question, not a finding.
            {P
              ? ' Overlay gains are Total Fund only.'
              : ' The report prints no overlay programs for the OPEB Master Trust.'}
          </p>
          <SourceLine records={[flowsSrc]} />
          <DeckLink n={SLIDE.alloc} show={isLatest} />
        </Panel>

        <Panel
          id="cio-hist"
          kicker="Monthly return distribution — last 120 months"
          title="Months by return bin"
          sub="Counts as printed; bin edges as printed"
        >
          <div className="table-scroll" role="region" aria-label="Return distribution" tabIndex={0}>
            <table className="table">
              <caption>
                Number of months in each monthly-return bin (percent); bar length is relative to the
                fullest bin
              </caption>
              <thead>
                <tr>
                  <th scope="col">Bin (%)</th>
                  <th scope="col" className="num">
                    Months
                  </th>
                  <th scope="col">Relative frequency</th>
                </tr>
              </thead>
              <tbody>
                {BINS.map((b, i) => (
                  <tr key={b}>
                    <td>
                      {b}
                      {i === e.hist.latestBin ? (
                        <>
                          {' '}
                          <Tag variant="accent">latest month</Tag>
                        </>
                      ) : null}
                    </td>
                    <td className="num">{e.hist.c[i]}</td>
                    <td className="hist-cell">
                      <div
                        className={`fill${i === e.hist.latestBin ? ' hi' : ''}`}
                        style={{ width: `${((e.hist.c[i]! / histMax) * 100).toFixed(1)}%` }}
                        aria-hidden="true"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="panel-note">
            Mean {pct(e.hist.mean)} · 2024 SAA expected {pct(e.hist.saa)} · standard deviation{' '}
            {pct(e.hist.sd)} · min {pct(e.hist.min)} · max {pct(e.hist.max)} · latest month{' '}
            {pct(e.hist.latest)} (placed by value). The forecast-volatility pages are image-only in
            the PDF and are not reproduced.
          </p>
          <SourceLine records={[src.main]} />
          <DeckLink n={SLIDE.hist} show={isLatest} />
        </Panel>
      </div>

      <Panel
        id="cio-market"
        className="mt"
        kicker="Market context — not fund performance"
        title="Index returns by period"
        sub={
          vintage.marketAsOf
            ? `As of ${longDate(vintage.marketAsOf)} — index moves explain the environment the benchmarks moved in, not the Fund's result against them`
            : "Index moves explain the environment the benchmarks moved in, not the Fund's result against them"
        }
      >
        {vintage.MKT ? (
          <>
            <div className="table-scroll" role="region" aria-label="Market context" tabIndex={0}>
              <table className="table">
                <caption>
                  Total-return indices as printed in the report (Bloomberg, State Street)
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Index</th>
                    {PERIODS.map((p) => (
                      <th scope="col" className="num" key={p}>
                        {p}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {vintage.MKT.map((g) => (
                    <Fragment key={g.g}>
                      <tr>
                        <td colSpan={PERIODS.length + 1} style={{ fontWeight: 600 }}>
                          {g.g}
                        </td>
                      </tr>
                      {g.rows.map((row) => (
                        <tr key={row.n}>
                          <td style={{ paddingLeft: 26 }}>
                            {row.n}
                            <div className="footnote">{row.i}</div>
                          </td>
                          {row.v.map((v, i) => (
                            <td className="num" key={PERIODS[i]}>
                              {pct(v)}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="panel-note">
              NCREIF ODCE (net) is the latest available quarter. Kept separate from fund performance
              by design.
            </p>
          </>
        ) : (
          <p className="muted-note">
            {feed
              ? 'The feed does not carry the market table.'
              : 'The market table in this report is not machine-readable, so it is not reproduced; the printed page is in the PDF.'}
          </p>
        )}
        <SourceLine records={[marketSrc]} />
        <DeckLink n={SLIDE.market} show={isLatest} />
      </Panel>

      {isLatest ? (
        <>
          <div className="grid-panels mt">
            <Panel kicker="Key macro indicators and themes" title="Macro strip">
              <div>
                {MACRO.map((m) => (
                  <div className="flow-row" key={m.l}>
                    <span>
                      {m.l}
                      <div className="footnote">{m.s}</div>
                    </span>
                    <span className="v">{m.v}</span>
                  </div>
                ))}
              </div>
              <SourceLine records={[cioSource(vintage, 'pp. 4–6', 4)]} />
            </Panel>

            {e.geo.top.length > 0 ? (
              <Panel
                id="cio-geo"
                kicker={`Geographic exposure by AUM — ${e.short}`}
                title={`Developed ${e.geo.dm}% · emerging ${e.geo.em}% · ${e.geo.total} markets`}
                sub={`${e.geo.dmN} developed and ${e.geo.emN} emerging markets; the report's top five in each group`}
              >
                <GeoTable e={e} />
                <SourceLine records={[src.geo]} />
                <DeckLink n={SLIDE.geo} show={isLatest} />
              </Panel>
            ) : null}
          </div>

          <Panel
            id="cio-ops"
            className="mt"
            kicker="Portfolio, structural and operational items"
            title="Items for attention"
            sub="Statuses as printed; the report gives no dates or owners"
          >
            <div
              className="table-scroll"
              role="region"
              aria-label="Items for attention"
              tabIndex={0}
            >
              <table className="table">
                <caption>
                  Key initiatives, personnel searches, manager and consultant updates
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Scope</th>
                    <th scope="col">Item</th>
                    <th scope="col">Status</th>
                    <th scope="col" className="num">
                      p.
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {OPS.map((o) => (
                    <tr key={`${o.e}|${o.item}`}>
                      <td>{o.e}</td>
                      <td>{o.item}</td>
                      <td>
                        <Tag variant={STATUS_VARIANT[o.st]}>{STATUS[o.st][0]}</Tag>
                      </td>
                      <td className="num">{o.p}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="panel-note">
              “For attention” groups a named manager personnel change and an external search in
              quiet period — an editorial grouping to help the reader, not a report category.
            </p>
            <SourceLine records={[cioSource(vintage, 'pp. 19–20, 24', 19)]} />
            <DeckLink n={SLIDE.ops} show={isLatest} />
          </Panel>
        </>
      ) : (
        <div className="grid-panels mt">
          {e.geo.top.length > 0 ? (
            <Panel
              kicker={`Geographic exposure by AUM — ${e.short}`}
              title={`Developed ${e.geo.dm}% · emerging ${e.geo.em}% · ${e.geo.total} markets`}
              sub={`${e.geo.dmN} developed and ${e.geo.emN} emerging markets; the report's top five in each group`}
            >
              <GeoTable e={e} />
              <SourceLine records={[src.geo]} />
            </Panel>
          ) : null}
          <Panel kicker="Editorial pages" title="Macro strip and items for attention">
            <p className="muted-note">
              {feed
                ? 'The macro strip and the items for attention are editorial pages of the public report and are not part of the feed.'
                : "The macro strip and the items for attention are maintained for the latest report only. For this month, read the report's pages 4–6 and 19–20 in the PDF."}
            </p>
            {feed ? null : <SourceLine records={[cioSource(vintage, 'pp. 4–6, 19–20', 4)]} />}
          </Panel>
        </div>
      )}
    </>
  );
}

function GeoTable({ e }: { e: CioEntity }) {
  return (
    <>
      <div className="table-scroll" role="region" aria-label="Geographic exposure" tabIndex={0}>
        <table className="table">
          <caption>Top five countries in each market group, percent of AUM</caption>
          <thead>
            <tr>
              <th scope="col">Country</th>
              <th scope="col">Group</th>
              <th scope="col" className="num">
                % of AUM
              </th>
            </tr>
          </thead>
          <tbody>
            {e.geo.top.map(([country, share, group]) => (
              <tr key={country}>
                <td>{country}</td>
                <td>{group === 'dm' ? 'Developed' : 'Emerging'}</td>
                <td className="num">{share.toFixed(1)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="panel-note">
        Exposure excludes overlays and hedges and is based on the domicile country of each security
        or asset (MSCI Market Classification Framework); best available holdings-level transparency.
        The remaining markets are not itemized in the report.
      </p>
    </>
  );
}
