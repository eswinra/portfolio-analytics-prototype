import { Fragment, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

import { DeckFrame } from '../components/DeckFrame';
import { CioExplore } from './CioExplore';
import { GdpBars } from '../components/GdpBars';
import { GlossaryLink } from '../components/Glossary';
import { AboutFigures, PageMeta, PageSources } from '../components/page';
import { ReportPlayer } from '../components/ReportPlayer';
import { scrollToPanel, SubTabs } from '../components/SubTabs';
import { TrendSparks } from '../components/TrendSparks';
import { WorldMap } from '../components/WorldMap';
import { CONFIG } from '../config';
import {
  ChangeChip,
  ClassBadge,
  excessTag,
  Panel,
  PANEL_FOOT,
  SourceLine,
  Tag,
  type TagVariant,
} from '../components/ui';
import {
  BINS,
  CIO_LATEST,
  CIO_MACRO,
  CIO_VINTAGE,
  CIO_VINTAGES,
  cioFor,
  longDate,
  macroFor,
  monthYear,
  OPS,
  PERIOD_INDEX,
  PERIODS,
  STATUS,
  type CioEntity,
  type CioVintage,
  type OpsStatus,
} from '../fixtures/cioMonthly';
import { publishedFor, type EntityId } from '../fixtures/published';
import { SOURCES, type SourceRecord } from '../fixtures/sources';
import { useCioFile } from '../lib/cioFile';
import { cioChanges, cioNarrative, fiscalYearOf } from '../lib/cioNarrative';
import { PACKAGE_SHEET, readCioPackage } from '../lib/cioPackage';
import { FEED_KEY, FILE_KEY, useCioVintage } from '../lib/cioVintage';
import { feedClassification } from '../lib/dataset/cioFeed';
import { useDataset } from '../lib/dataset/useDataset';
import { useEntity } from '../lib/entity';
import { useUrlFlag, useUrlParam } from '../lib/urlState';
import {
  isWorkbookName,
  MAX_WORKBOOK_BYTES,
  SPREADSHEET_ACCEPT,
  workbookToCsv,
} from '../lib/workbook';

/** Sub-tabs: the report's slides first — opening the tab shows the deck inside the dashboard —
 *  then a one-screen summary and the detail, one click each. */
const TABS: [key: string, label: string][] = [
  ['slides', 'Slides'],
  ['summary', 'Summary'],
  ['performance', 'Performance'],
  ['positioning', 'Positioning'],
  ['markets', 'Markets & items'],
  ['explore', 'Explore'],
];

/** Which sub-tab holds each panel, so a jump or a panel link opens the right tab. */
const TAB_OF: Record<string, string> = {
  'cio-read': 'summary',
  'cio-changed': 'summary',
  'cio-perf': 'performance',
  'cio-attr': 'performance',
  'cio-trend': 'performance',
  'cio-comps': 'positioning',
  'cio-flows': 'positioning',
  'cio-hist': 'positioning',
  'cio-geo': 'positioning',
  'cio-market': 'markets',
  'cio-macro': 'markets',
  'cio-ops': 'markets',
  'cio-x-grid': 'explore',
  'cio-x-cat': 'explore',
  'cio-x-corr': 'explore',
  'cio-x-scenario': 'explore',
};

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
// a figure the input did not supply is said to be missing, never shown as zero
const mm = (v: number | null) => (v === null ? '—' : v.toLocaleString('en-US'));
const moneyMm = (v: number | null) =>
  v === null ? 'not supplied' : `${v < 0 ? '−' : ''}$${mm(Math.abs(v))}M`;
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
  if (v.origin === 'file') {
    return {
      id: `CIO_FILE_${v.file}`,
      label: `template file ${v.file} (not published)`,
      doc: 'CIO Monthly template file, read in this browser',
      pageTable: 'as entered in the template',
      asOf: longDate(v.dataThrough),
    };
  }
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

/** Source record for the macro strip's FRED figures, read as of the report's as-of date. */
function fredMacroSource(v: CioVintage): SourceRecord | null {
  const m = CIO_MACRO[v.reportDate];
  if (!m) return null;
  return {
    id: `FRED_CIO_${m.asOf}`,
    label: `FRED, as known on ${longDate(m.asOf)}`,
    doc: 'Federal Reserve Economic Data, real-time archive (ALFRED): PCEPI, PCEPILFE (BEA); UNRATE, CIVPART (BLS); DFEDTARL, DFEDTARU (Federal Reserve)',
    pageTable: 'observations as FRED showed them on the date given',
    asOf: longDate(m.asOf),
    url: 'https://alfred.stlouisfed.org/',
  };
}

/** Slide index in the deck (its URL hash is the slide number). */
const SLIDE = {
  summary: 4,
  perf: 5,
  wf: 6,
  alloc: 7,
  hist: 9,
  fvol: 10,
  market: 11,
  econ: 12,
  geo: 13,
  ops: 14,
} as const;

/** Opens the Slides tab at the slide that carries this panel's figures, for the report on
 *  screen — the slides are built from the same data as the panel. */
function DeckLink({ n }: { n: number }) {
  const [params] = useSearchParams();
  const q = new URLSearchParams(params);
  q.delete('tab'); // the slides are the tab's default view
  q.set('slide', String(n));
  q.delete('p');
  return (
    <Link className="present-chip" to={`/cio?${q.toString()}`}>
      ▶ Slide {n}
    </Link>
  );
}

(DeckLink as unknown as { [PANEL_FOOT]?: true })[PANEL_FOOT] = true;

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
  const { vintage, prior, isLatest, feed, feedAvailable, pkg, fileAvailable, fileGone, select } =
    useCioVintage();
  const cioFile = useCioFile();
  const [fileErrors, setFileErrors] = useState<{ name: string; errors: string[] } | null>(null);
  // a template file (the workbook, or its Export tab saved as CSV) is read here, in the browser;
  // nothing is uploaded or stored. A workbook becomes the same CSV text, checked the same way.
  const openFile = async (ev: React.ChangeEvent<HTMLInputElement>) => {
    const f = ev.target.files?.[0];
    ev.target.value = '';
    if (!f) return;
    const book = isWorkbookName(f.name);
    if (f.size > (book ? MAX_WORKBOOK_BYTES : 2_000_000)) {
      setFileErrors({
        name: f.name,
        errors: ['The file is far larger than a CIO template; check that it is the right file.'],
      });
      return;
    }
    let text: string;
    if (book) {
      const sheet = await workbookToCsv(await f.arrayBuffer(), PACKAGE_SHEET);
      if (!sheet.ok) {
        setFileErrors({ name: f.name, errors: sheet.errors });
        return;
      }
      text = sheet.csv;
    } else {
      text = await f.text();
    }
    const res = readCioPackage(text, f.name);
    if (!res.ok) {
      setFileErrors({ name: f.name, errors: res.errors });
      return;
    }
    setFileErrors(null);
    cioFile.open(res.pkg);
    select(FILE_KEY);
  };
  const closeFile = () => {
    cioFile.close();
    select(CIO_LATEST.dataThrough);
  };
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
  const [tabRaw, setTab] = useUrlParam('tab', 'slides');
  const tab =
    tabRaw === 'present' ? 'slides' : TABS.some(([k]) => k === tabRaw) ? tabRaw : 'slides';
  // choosing the Slides tab is a request to present: the deck scrolls into place and takes the keys
  const [presentIntent, setPresentIntent] = useState(false);
  const chooseTab = (k: string) => {
    if (k === 'slides') setPresentIntent(true);
    setTab(k);
  };
  // the other fund, for side-by-side comparison; the header toggle still sets the primary one
  const otherEntity: EntityId = P ? 'OPEB' : 'PENSION';
  const o = cioFor(otherEntity, vintage);
  const cmp = compare && !feed;
  // a jump to a panel on another sub-tab opens that tab first
  const jump = (id: string) => {
    const t = TAB_OF[id];
    if (t && t !== tab) setTab(t);
    scrollToPanel(id);
  };
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

  const hist = e.hist;
  const histMax = hist ? Math.max(...hist.c) : 0;
  // an imported feed is labelled as its rows are, never as the published report
  const feedCls = feed ? feedClassification(feed.classifications) : null;
  const pageCls = pkg ? 'calculated' : feedCls ? feedCls.primary : 'reported_public';
  const alsoCls = [
    ...new Set([...(feedCls ? feedCls.also : []), 'calculated', 'proxy_estimate'] as const),
  ].filter((c) => c !== pageCls);
  // a new fiscal year restarts FYTD: the two reports' FYTD figures are not compared
  const fyReset = prior
    ? fiscalYearOf(vintage.dataThrough) !== fiscalYearOf(prior.dataThrough)
    : false;
  const monthLabel = longDate(vintage.dataThrough);
  // the four standing questions, answered from this report's figures; the macro line comes
  // from FRED as known on the report's date, so every public report has one (a feed has none)
  const macro = pkg ? pkg.macro : feed ? [] : macroFor(vintage);
  const fredSrc = feed || pkg ? null : fredMacroSource(vintage);
  const ops = pkg ? pkg.ops : OPS;
  const narrative = cioNarrative(
    e,
    vintage,
    macro[0] && macro[1]
      ? {
          macroLine: `${macro[0].l.replace(/,.*$/, '')} ${macro[0].v}, ${macro[1].l.replace(/,.*$/, '')} ${macro[1].v}.`,
        }
      : {},
  );
  const changes =
    ep && prior
      ? cioChanges(e, ep, { through: vintage.dataThrough, priorThrough: prior.dataThrough })
      : [];

  const vIndex = CIO_VINTAGES.indexOf(vintage);
  return (
    <PageMeta classification={pageCls} sources={[src.main]}>
      <SubTabs tabs={TABS} value={tab} onChange={chooseTab} label="CIO Monthly sections" />
      <div className="vintage-bar">
        <div className="vintage-slider">
          <label htmlFor="report-slider">
            {feed
              ? 'Workstation dataset'
              : pkg
                ? 'Template file'
                : `${monthYear(vintage.dataThrough)} data`}
          </label>
          <input
            id="report-slider"
            type="range"
            min={0}
            max={CIO_VINTAGES.length - 1}
            step={1}
            value={vIndex < 0 ? CIO_VINTAGES.length - 1 : vIndex}
            disabled={Boolean(feed || pkg)}
            aria-label="Report month"
            aria-valuetext={
              feed
                ? 'Workstation dataset'
                : pkg
                  ? `Template file ${pkg.fileName}`
                  : `${vintage.reportLabel} report, data through ${monthLabel}`
            }
            onChange={(ev) => select(CIO_VINTAGES[Number(ev.target.value)]!.dataThrough)}
          />
          <span className="vs-ends" aria-hidden="true">
            <span>{monthYear(CIO_VINTAGES[0]!.dataThrough)}</span>
            <span>{monthYear(CIO_LATEST.dataThrough)}</span>
          </span>
        </div>
        <ReportPlayer
          index={vIndex}
          count={CIO_VINTAGES.length}
          onStep={(i) => select(CIO_VINTAGES[i]!.dataThrough)}
          nowShowing={`${monthLabel}: ${vintage.reportLabel} report`}
          disabled={Boolean(feed || pkg)}
        />
        <select
          aria-label="Report"
          className="vs-select"
          value={pkg ? FILE_KEY : feed ? FEED_KEY : vintage.dataThrough}
          onChange={(ev) => select(ev.target.value)}
        >
          {fileAvailable ? (
            <option value={FILE_KEY}>
              Template file {fileAvailable.fileName} — data through{' '}
              {longDate(fileAvailable.vintage.dataThrough)} (not published)
            </option>
          ) : null}
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
        <label className="btn-outline vs-file">
          Open a template file…
          <input
            type="file"
            accept={SPREADSHEET_ACCEPT}
            className="visually-hidden"
            aria-describedby="vs-file-help"
            onChange={(ev) => void openFile(ev)}
          />
        </label>
        <span id="vs-file-help" className="vs-file-help">
          Builds the slides from a filled{' '}
          <a href="templates/CIO_Monthly_Template.xlsx">CIO template</a> (the workbook, or its
          Export tab as CSV), read in this browser only
        </span>
        {feed || (tab !== 'performance' && tab !== 'positioning') ? null : (
          <label className="vintage-compare">
            <input
              type="checkbox"
              checked={compare}
              onChange={(ev) => setCompare(ev.target.checked)}
            />{' '}
            Compare both funds
          </label>
        )}
      </div>
      {fileErrors ? (
        <div className="file-errors" role="alert">
          <p>
            <strong>{fileErrors.name} was not opened</strong> — nothing from it is shown. Fix these
            in the workbook (its Checks tab helps), save it and open it again:
          </p>
          <ul>
            {fileErrors.errors.slice(0, 12).map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
          {fileErrors.errors.length > 12 ? <p>…and {fileErrors.errors.length - 12} more.</p> : null}
          <button type="button" className="btn-outline" onClick={() => setFileErrors(null)}>
            Dismiss
          </button>
        </div>
      ) : null}
      {pkg ? (
        <div className="publish-banner blocked file-banner" role="status">
          <span>
            <strong>Template file {pkg.fileName}</strong> — read in this browser only: nothing was
            uploaded, and it is not published. Closing or reloading this page clears it.
          </span>
          <button type="button" className="btn-outline" onClick={closeFile}>
            Close file
          </button>
        </div>
      ) : fileGone ? (
        <p className="muted-note" role="status">
          The template file was cleared when the page reloaded (files are never stored). Showing the
          latest published report; open the file again to see it.
        </p>
      ) : null}
      {feed ? (
        <div
          className={`publish-banner ${dataset.publishEligible ? 'ok' : 'blocked'}`}
          role="status"
        >
          <strong>Workstation feed (schema 1.4):</strong> {feed.rowCount} cio_monthly rows for{' '}
          {feed.entityId}, data through {longDate(feed.asOf)}, from {feed.sourceName}; publication
          gate (demonstrated){' '}
          {dataset.publishEligible
            ? 'ELIGIBLE.'
            : `INELIGIBLE — ${dataset.publishBlockers.join(' · ')}.`}{' '}
          The Present tab builds the slides from this feed.
        </div>
      ) : null}
      <AboutFigures
        summary={
          feed
            ? `Imported workstation dataset (${feed.entityId}), data through ${monthLabel} — not a published report`
            : pkg
              ? `Template file ${pkg.fileName} for the ${vintage.reportLabel} report, data through ${monthLabel} — not published${prior ? ` · changes against the ${prior.reportLabel} report` : ''}`
              : `${CIO_VINTAGE.title}, ${vintage.reportLabel}; fund data through ${monthLabel}${prior ? ` · changes against the ${prior.reportLabel} report` : ''}`
        }
        classification={pageCls}
        alsoUsed={alsoCls}
      >
        <p>
          <strong>Monthly vintage, kept apart from the fiscal-year tabs.</strong> The fund&apos;s
          market value here is not the June 30, 2025 fiduciary net position on the Overview, and
          monthly periods are not fiscal-year horizons; the two vintages are never combined.
        </p>
        <p>
          {pkg
            ? 'Figures are as entered in the template file, not yet published. '
            : feed
              ? `Figures are as imported from ${feed.sourceName}, classified ${feed.classifications.join(', ')} by its rows — not a published report. `
              : `Figures are as printed in the report (${e.pages}). `}
          Differences and changes against the prior report are calculated from the printed
          one-decimal values, so ±0.1 pp rounding is possible.
          {prior
            ? ` The prior report is ${prior.reportLabel} (data through ${longDate(prior.dataThrough)}).`
            : ' This is the earliest report in the series, so there is no prior report to compare.'}
        </p>
        <p>
          {CIO_VINTAGE.periodNote} The slides on the Present tab are built from the same figures.
        </p>
      </AboutFigures>

      <div role="tabpanel" id="subtab-panel" aria-labelledby={`subtab-${tab}`}>
        {tab === 'summary' ? (
          <>
            <div className="grid-kpi">
              <Panel tight kicker="Total fund market value">
                <div className="stat-value">${e.aum.toFixed(1)}B</div>
                <div className="stat-sub">
                  ${mm(e.mv)}M ·{' '}
                  {e.cash === null
                    ? 'cash and equivalents not supplied'
                    : `cash and equivalents $${mm(e.cash)}M`}
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
                  Policy benchmark {pct(e.total.b[oneMonth])} · {signed(excess(e, oneMonth))} pp
                  excess
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
                  {ep && fyReset ? (
                    <span
                      className="chip-change"
                      title={`FYTD restarted July 1; the ${prior?.reportLabel} report's ${pct(ep.total.r[fytd])} covered the prior fiscal year`}
                    >
                      new fiscal year
                    </span>
                  ) : ep ? (
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
                  Policy benchmark {pct(e.total.b[oneYear])} · {signed(excess(e, oneYear))} pp
                  excess
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

            <div className="grid-panels mt">
              <Panel
                id="cio-read"
                kicker="Two-minute read"
                title={`What this report says about the ${e.short}`}
                method={
                  <p>
                    Every sentence is computed from the figures on this page — nothing is written
                    for a particular month. Read it against the reported figures, which are quoted
                    as printed. A sentence marked <em>proxy estimate</em> points to where to look;
                    it does not quantify manager value-add.
                  </p>
                }
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
              </Panel>

              <Panel
                id="cio-changed"
                kicker={
                  prior ? `Against the ${prior.reportLabel} report` : 'Against the prior report'
                }
                title={
                  !ep
                    ? 'No prior report in the series'
                    : changes.length === 0
                      ? 'Nothing moved past the reporting thresholds'
                      : `What changed (${changes.length})`
                }
                method={
                  <p>
                    Listed: weights that moved half a point or more, returns that moved a tenth or
                    more, an excess that changed sign, and any policy-target change (called out
                    because drift is not comparable across policy versions). Changes are calculated
                    from the two reports&apos; printed one-decimal values.
                  </p>
                }
              >
                {!ep ? (
                  <p className="muted-note">
                    This is the earliest report on the site, so there is nothing to compare it with.
                  </p>
                ) : changes.length === 0 ? (
                  <p className="muted-note">
                    Every figure moved by less than the thresholds above. The tables below carry the
                    exact values.
                  </p>
                ) : (
                  <div className="change-list">
                    {changes.map((c) => (
                      <div className="change-row" key={c.id}>
                        <span>{c.label}</span>
                        {c.reset ? (
                          <span className="chip-change">reset</span>
                        ) : (
                          <ChangeChip delta={c.delta} unit={c.unit} dp={c.unit === '$B' ? 1 : 1} />
                        )}
                        <span className="detail">{c.detail}</span>
                      </div>
                    ))}
                  </div>
                )}
                {prior ? <SourceLine records={[entityPages(prior, key).main]} /> : null}
              </Panel>
            </div>
          </>
        ) : null}

        {tab === 'performance' ? (
          <>
            <div className="grid-panels mt">
              <Panel
                id="cio-perf"
                kicker="Net of fees — total fund"
                title="Performance vs. policy benchmark and actuarial hurdle"
                method={
                  <p>
                    {CIO_VINTAGE.periodNote} Excess = fund − benchmark (calculated). The actuarial
                    hurdle applies at the total-fund level only. A period the report does not print
                    shows as —. <GlossaryLink>What these terms mean</GlossaryLink>.
                    {cmp
                      ? ' The two funds hold different policy allocations and different benchmarks; compare each against its own benchmark, not against each other.'
                      : ''}
                  </p>
                }
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
                        Both funds side by side for the same report; each fund is measured against
                        its own policy benchmark, so the excess columns are comparable and the
                        return columns are not a like-for-like ranking
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
                              <td className="num">
                                {t ? <Tag variant={t.variant}>{t.text}</Tag> : '—'}
                              </td>
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
                        (calculated, percentage points); bar length is relative to the largest
                        excess
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
                                    style={{
                                      width: `${((Math.abs(x) / excessMax) * 100).toFixed(1)}%`,
                                    }}
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
                {cmp ? (
                  <SourceLine records={[entityPages(vintage, P ? 'opeb' : 'pension').main]} />
                ) : null}
                <DeckLink n={SLIDE.perf} />
              </Panel>

              <Panel
                id="cio-attr"
                kicker="Where the benchmark gap came from"
                title="Composite excess × month-end weight"
                sub="Proxy estimate — a pointer to where to look, not a manager value-add figure"
                method={
                  <p>
                    Contribution = (composite return − its policy benchmark) × month-end weight. Not
                    the report&apos;s attribution and not a Brinson decomposition.
                    Beginning-of-period weights, the allocation effect, overlays, cash and
                    compounding are all folded into the residual, shown so the reader can see how
                    much the proxy explains.
                  </p>
                }
              >
                <div className="panel-controls">
                  <ClassBadge c="proxy_estimate" />
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
                <div
                  className="table-scroll"
                  role="region"
                  aria-label="Gap attribution"
                  tabIndex={0}
                >
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
                <DeckLink n={SLIDE.wf} />
              </Panel>
            </div>
          </>
        ) : null}

        {tab === 'positioning' ? (
          <Panel
            id="cio-comps"
            kicker={`Composites — ${monthLabel}`}
            title="Market value, weight vs. 2024 SAA target and IPS range, returns vs. benchmark"
            method={
              <p>
                The IPS range is the policy in force, quoted from IPS Table 1, set against the
                month-end weight as printed; “near bound” flags a weight within{' '}
                {CONFIG.nearBoundPp.toFixed(1)} pp of a boundary. Range status is a factual report —
                the IPS defines no mechanical trade trigger, and this is not a compliance statement.
                Composites have no 10-year figure in the report. Real estate and private equity
                values are best-available cash-flow-adjusted market values.
              </p>
            }
          >
            {cmp ? (
              <CompositesCompare a={e} b={o} />
            ) : (
              <div className="table-scroll" role="region" aria-label="Composites" tabIndex={0}>
                <table className="table cardable" role="table">
                  <caption>
                    Drift = weight − target; Δ weight = change against the prior report; IPS range
                    and distance to the nearer bound compare the month-end weight with the policy in
                    force (IPS Table 1, restated June 12, 2024) — all calculated. Return cells show
                    composite / policy benchmark.
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
            <SourceLine sources={P ? ['IPS_T1'] : ['IPS_OPEB_T1']} />
            <DeckLink n={SLIDE.alloc} />
          </Panel>
        ) : null}

        {tab === 'performance' ? (
          <Panel
            id="cio-trend"
            className="mt"
            kicker="Across reports"
            title="Trend by report, oldest first"
            method={
              <p>
                Each row is one report as printed; excess is calculated. A report that does not
                print a period leaves a gap in the line rather than a straight segment through it.
                FYTD resets each July (fiscal year ends June 30). Reports whose performance table is
                not machine-readable are absent from the series and are listed in the
                extractor&apos;s log.
              </p>
            }
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
                <TrendSparks
                  vintages={CIO_VINTAGES}
                  entityOf={(v) => cioFor(entity, v)}
                  current={vIndex}
                  onSelect={(i) => select(CIO_VINTAGES[i]!.dataThrough)}
                />
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
            <SourceLine>
              {CIO_VINTAGES.length} CIO Monthly Reports, {CIO_VINTAGES[0]!.reportLabel} through{' '}
              {CIO_VINTAGES[CIO_VINTAGES.length - 1]!.reportLabel} — each report's own pages; select
              a row to open that month with its citation
            </SourceLine>
          </Panel>
        ) : null}

        {tab === 'positioning' ? (
          <div className="grid-panels mt">
            <Panel
              id="cio-flows"
              kicker={`${monthLabel} rebalancing activity`}
              title="Flows by composite"
              method={
                <p>
                  Flows may include capital calls, distributions and cash management, so a flow away
                  from target is a prompt for a question, not a finding.
                  {P
                    ? ' Overlay gains are Total Fund only.'
                    : ' The report prints no overlay programs for the OPEB Master Trust.'}
                </p>
              }
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
              <SourceLine records={[flowsSrc]} />
              <DeckLink n={SLIDE.alloc} />
            </Panel>

            {hist ? (
              <Panel
                id="cio-hist"
                kicker="Monthly return distribution — last 120 months"
                title="Months by return bin"
                note={`Mean ${pct(hist.mean)} · 2024 SAA expected ${pct(hist.saa)} · standard deviation ${pct(hist.sd)} · min ${pct(hist.min)} · max ${pct(hist.max)} · latest month ${pct(hist.latest)}`}
                method={
                  <p>
                    Counts and bin edges as printed; the latest month is placed by value. The
                    forecast-volatility pages are image-only in the PDF and are not reproduced.
                  </p>
                }
              >
                <div
                  className="table-scroll"
                  role="region"
                  aria-label="Return distribution"
                  tabIndex={0}
                >
                  <table className="table">
                    <caption>
                      Number of months in each monthly-return bin (percent); bar length is relative
                      to the fullest bin
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
                            {i === hist.latestBin ? (
                              <>
                                {' '}
                                <Tag variant="accent">latest month</Tag>
                              </>
                            ) : null}
                          </td>
                          <td className="num">{hist.c[i]}</td>
                          <td className="hist-cell">
                            <div
                              className={`fill${i === hist.latestBin ? ' hi' : ''}`}
                              style={{ width: `${((hist.c[i]! / histMax) * 100).toFixed(1)}%` }}
                              aria-hidden="true"
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <DeckLink n={SLIDE.hist} />
              </Panel>
            ) : (
              <Panel
                id="cio-hist"
                kicker="Monthly return distribution — last 120 months"
                title="Months by return bin"
              >
                <p className="muted-note">
                  The return distribution was not supplied
                  {feed ? ' in the imported dataset' : pkg ? ' in the template file' : ''}, so no
                  distribution statistics are shown.
                </p>
              </Panel>
            )}
          </div>
        ) : null}

        {tab === 'positioning' && e.geo.top.length > 0 ? (
          <Panel
            id="cio-geo"
            className="mt"
            kicker={`Geographic exposure by AUM — ${e.short}`}
            title={`Developed ${e.geo.dm}% · emerging ${e.geo.em}% · ${e.geo.total} markets`}
            sub={`${e.geo.dmN} developed and ${e.geo.emN} emerging markets; the report's top five in each group`}
            method={
              <p>
                Exposure excludes overlays and hedges and is based on the domicile country of each
                security or asset (MSCI Market Classification Framework); best available
                holdings-level transparency. The remaining markets are not itemized in the report.
              </p>
            }
          >
            <WorldMap top={e.geo.top} fund={e.short} page={e.geo.page} />
            <GeoTable e={e} />
            <SourceLine records={[src.geo, SOURCES.WORLD_OUTLINES]} />
            <DeckLink n={SLIDE.geo} />
          </Panel>
        ) : null}

        {tab === 'markets' ? (
          <>
            <Panel
              id="cio-market"
              kicker="Market context — not fund performance"
              title="Index returns by period"
              sub={vintage.marketAsOf ? `As of ${longDate(vintage.marketAsOf)}` : undefined}
              method={
                <p>
                  Total-return indices as printed in the report (Bloomberg, State Street). Index
                  moves explain the environment the benchmarks moved in, not the Fund&apos;s result
                  against them. NCREIF ODCE (net) is the latest available quarter.
                </p>
              }
            >
              {vintage.MKT ? (
                <div
                  className="table-scroll"
                  role="region"
                  aria-label="Market context"
                  tabIndex={0}
                >
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
              ) : (
                <p className="muted-note">
                  {feed
                    ? 'The feed does not carry the market table.'
                    : 'The market table in this report is not machine-readable, so it is not reproduced; the printed page is in the PDF.'}
                </p>
              )}
              <SourceLine records={[marketSrc]} />
              <DeckLink n={SLIDE.market} />
            </Panel>

            <div className="grid-panels mt">
              {macro.length ? (
                <Panel
                  id="cio-macro"
                  kicker="Key macro indicators"
                  title="Macro strip"
                  sub={
                    fredSrc
                      ? `FRED figures as known on ${fredSrc.asOf}, the date the report's macro page reads as of`
                      : undefined
                  }
                  method={
                    pkg ? (
                      <p>
                        As entered in the template file: the team&apos;s figures and commentary.
                        Published reports read these indicators from FRED instead.
                      </p>
                    ) : (
                      <p>
                        PCE inflation, the federal funds target range and the unemployment and
                        participation rates are read from FRED as FRED showed them at the month end
                        before the report's month (its real-time archive, ALFRED), so later
                        revisions do not change them and every report has them. PCE inflation is the
                        year-over-year change of the price index (calculated); the other figures are
                        as published. For the latest report the report's own commentary sits beside
                        them, and the dollar index and themes are typed from the report, which a
                        unit test checks against FRED's figures.
                      </p>
                    )
                  }
                >
                  {!pkg && !feed ? <GdpBars reportDate={vintage.reportDate} /> : null}
                  <div>
                    {macro.map((m) => (
                      <div className="flow-row" key={m.l}>
                        <span>
                          {m.l}
                          <div className="footnote">{m.s}</div>
                        </span>
                        <span className="v">{m.v}</span>
                      </div>
                    ))}
                  </div>
                  <SourceLine
                    records={[
                      ...(fredSrc ? [fredSrc] : []),
                      ...(isLatest || pkg ? [cioSource(vintage, 'pp. 4–6', 4)] : []),
                    ]}
                  />
                  <DeckLink n={SLIDE.econ} />
                </Panel>
              ) : null}

              {isLatest || pkg ? (
                <Panel
                  id="cio-ops"
                  kicker="Portfolio, structural and operational items"
                  title="Items for attention"
                  sub="Statuses as printed; the report gives no dates or owners"
                  method={
                    <p>
                      “For attention” groups a named manager personnel change and an external search
                      in quiet period — an editorial grouping to help the reader, not a report
                      category.
                    </p>
                  }
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
                        {ops.map((o) => (
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
                  <SourceLine records={[cioSource(vintage, 'pp. 19–20, 24', 19)]} />
                  <DeckLink n={SLIDE.ops} />
                </Panel>
              ) : (
                <Panel id="cio-ops" kicker="Editorial pages" title="Items for attention">
                  <p className="muted-note">
                    {feed
                      ? 'The macro strip and the items for attention come from the public report and are not part of the feed.'
                      : "The items for attention are maintained for the latest report only. For this month, read the report's pages 19–20 in the PDF."}
                  </p>
                  {feed ? null : <SourceLine records={[cioSource(vintage, 'pp. 19–20', 19)]} />}
                </Panel>
              )}
            </div>
          </>
        ) : null}

        {tab === 'explore' ? (
          <CioExplore
            entity={entity}
            vintage={vintage}
            e={e}
            source={pkg ? 'template file' : feed ? 'workstation dataset' : 'published'}
            onSelectReport={select}
          />
        ) : null}

        {tab === 'slides' ? (
          <DeckFrame
            vintage={vintage}
            isLatest={isLatest}
            feed={feed}
            pkg={pkg}
            loaded={cioFile.loaded}
            intent={presentIntent}
          />
        ) : null}
      </div>
      <PageSources sources={[src.main]} />
    </PageMeta>
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
    </>
  );
}
