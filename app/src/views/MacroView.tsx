import { Fragment, useMemo, useState } from 'react';

import { GlossaryLink } from '../components/Glossary';
import { LineChart, MiniSpark, QuadrantChart, signed, num, ZBar } from '../components/MacroCharts';
import { AboutFigures, PageMeta, PageSources } from '../components/page';
import { scrollToPanel, SubTabs } from '../components/SubTabs';
import { ChangeChip, ClassBadge, Panel, SourceLine, Tag } from '../components/ui';
import { longDate } from '../fixtures/cioMonthly';
import { MACRO_SNAPSHOT } from '../fixtures/macroSnapshot.data';
import { publishedFor } from '../fixtures/published';
import type { SourceRecord } from '../fixtures/sources';
import { PANELS, reading, transmission, treasuryCurves, type Reading } from '../lib/macro/board';
import {
  computeFactors,
  FACTOR_KEYS,
  FACTORS,
  HISTORY_MONTHS,
  type FactorKey,
} from '../lib/macro/factors';
import {
  buildLens,
  dominantFactor,
  formatScenario,
  parseScenario,
  SENSITIVITIES,
  withScenario,
  type LensRow,
} from '../lib/macro/lens';
import { directionRead, levelRead, NEAR_NORM, QUADRANT_NAME, RULES } from '../lib/macro/regime';
import { dayLabel, monthLabel, transformedAt, type Transform } from '../lib/macro/series';
import { useEntity } from '../lib/entity';
import { MACRO_TABS as TABS } from '../lib/routes';
import { useUrlParam } from '../lib/urlState';

/**
 * Economic Context — public U.S. macroeconomic data read three ways: where the economy sits
 * against its long-run norms, which way it is moving, and which of the fund's policy sleeves the
 * current readings lean against under stated assumptions. Everything is computed in the browser
 * from a dated FRED snapshot; the site calls no API and holds no key. Market context only: nothing
 * here is LACERA performance, a forecast, or a recommendation.
 */

const SNAP = MACRO_SNAPSHOT;
const MODEL = computeFactors(SNAP);
const LEVEL = levelRead(MODEL);
const DIRECTION = directionRead(SNAP, MODEL.end);
const CURVES = treasuryCurves(SNAP);
const CHANNELS = transmission(SNAP);
const BOARD = PANELS.map((p) => ({
  panel: p,
  head: reading(SNAP, p.headline),
  rows: p.rows.map((d) => reading(SNAP, d)),
}));

const RETRIEVED = longDate(SNAP.retrieved);
const THROUGH = monthLabel(MODEL.end);

const TAB_OF: Record<string, string> = {
  'mac-read': 'summary',
  'mac-regime': 'summary',
  'mac-rules': 'summary',
  'mac-lens': 'factors',
  'mac-factors': 'factors',
  'mac-board': 'indicators',
  'mac-history': 'indicators',
  'mac-curve': 'indicators',
  'mac-sources': 'sources',
};

const FRED: SourceRecord = {
  id: 'FRED',
  label: `FRED, Federal Reserve Bank of St. Louis — retrieved ${RETRIEVED}`,
  doc: 'Federal Reserve Economic Data (FRED)',
  pageTable: 'series listed under Sources and method',
  asOf: RETRIEVED,
  url: 'https://fred.stlouisfed.org/',
};

const FREQ: Record<string, string> = { D: 'Daily', W: 'Weekly', M: 'Monthly' };

const TRANSFORM_LABEL: Record<Transform, string> = {
  level: 'level',
  yoy: '% change on a year earlier',
  ann3m: '3-month change, annualised',
  chg1m: 'change on the prior month',
  bps: 'basis points',
  thousands: 'thousands',
  millions: 'millions',
};

const MONTH_SHORT = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

/** Change-chip unit for a board unit. */
function changeUnit(unit: string): string {
  if (unit.startsWith('%')) return 'pp';
  if (unit === 'bps') return 'bps';
  if (unit.startsWith('k ')) return 'k';
  if (unit.startsWith('M ')) return 'M';
  if (unit.startsWith('USD')) return 'USD';
  return 'pts';
}

function Value({ r }: { r: Reading }) {
  return (
    <>
      {num(r.value, r.def.dp)}
      <span className="stat-unit"> {r.def.unit}</span>
    </>
  );
}

const factorName = Object.fromEntries(FACTORS.map((f) => [f.key, f.name])) as Record<
  FactorKey,
  string
>;

function sigma(x: number | null, dp = 2): string {
  return x === null ? '—' : `${signed(x, dp)} σ`;
}

const CURVE_VARIANTS = ['primary', 'secondary', 'tertiary'] as const;

export function MacroView() {
  const { entity } = useEntity();
  const pub = publishedFor(entity);
  const [tabRaw, setTab] = useUrlParam('tab', 'summary');
  const tab = TABS.some(([k]) => k === tabRaw) ? tabRaw : 'summary';
  const [lensSel, setLensSel] = useUrlParam('lens', 'fund');
  const [open, setOpen] = useUrlParam('f', '');
  const [histSel, setHistSel] = useUrlParam('hs', 'factor:inflation');
  const [histRange, setHistRange] = useUrlParam('hr', '5');
  const [scenarioRaw, setScenarioRaw] = useUrlParam('s', '');
  const [curvesOff, setCurvesOff] = useState<string[]>([]);

  const observed = useMemo(() => buildLens(MODEL, pub.pol), [pub]);
  const scenario = useMemo(() => parseScenario(scenarioRaw), [scenarioRaw]);
  const scenarioOn = Object.keys(scenario).length > 0;
  const lens = useMemo(
    () => (scenarioOn ? buildLens(withScenario(MODEL, scenario), pub.pol) : observed),
    [scenarioOn, scenario, pub, observed],
  );
  const setFactorZ = (k: FactorKey, z: number) => {
    const next = { ...scenario };
    if (Math.abs(z - (MODEL.factors[k].z ?? 0)) < 0.005) delete next[k];
    else next[k] = z;
    setScenarioRaw(formatScenario(next));
  };

  const fund = observed[0]!;
  const selected = lens.find((r) => r.id === lensSel) ?? lens[0]!;
  const assetsObserved = observed.filter((r) => r.kind === 'asset');
  const lowest = assetsObserved.reduce((a, b) => ((b.exposure ?? 0) < (a.exposure ?? 0) ? b : a));
  const highest = assetsObserved.reduce((a, b) => ((b.exposure ?? 0) > (a.exposure ?? 0) ? b : a));
  const ranked = lens
    .filter((r) => r.kind === 'asset')
    .map((r) => ({ r, v: r.exposure ?? 0 }))
    .sort((a, b) => a.v - b.v);
  const rankOf = new Map(ranked.map((x, i) => [x.r.id, i]));
  const fundDriver = dominantFactor(fund);
  const mover = FACTOR_KEYS.map((k) => MODEL.factors[k])
    .filter((f) => f.d3 !== null)
    .reduce((a, b) => (Math.abs(b.d3!) > Math.abs(a.d3!) ? b : a));
  const jump = (id: string) => {
    const t = TAB_OF[id];
    if (t && t !== tab) setTab(t);
    scrollToPanel(id);
  };
  const ipsSource = entity === 'PENSION' ? 'IPS_T1' : 'IPS_OPEB_T1';

  // history: a factor (z) or a board indicator, over 1, 3 or 5 years to the last complete month
  const years = histRange === '1' || histRange === '3' ? Number(histRange) : 5;
  const span = years * 12;
  const histStart = MODEL.end - span + 1;
  const histFactor =
    FACTOR_KEYS.find((k) => histSel === `factor:${k}`) ??
    (histSel.startsWith('factor:') ? 'inflation' : null);
  const histDef = histFactor
    ? null
    : (PANELS.flatMap((p) => [p.headline, ...p.rows]).find((d) => d.id === histSel) ??
      PANELS[0]!.headline);
  const histValues: (number | null)[] = histFactor
    ? MODEL.factors[histFactor].hist.slice(HISTORY_MONTHS - span)
    : Array.from({ length: span }, (_, k) =>
        transformedAt(SNAP.series[histDef!.id]!, histStart + k, histDef!.transform),
      );
  const histLabel = histFactor
    ? `${factorName[histFactor]} factor`
    : `${histDef!.label} (${histDef!.unit})`;
  const histTicks: [number, string][] = [];
  for (let k = 0; k < span; k++) {
    const m = histStart + k;
    if (years === 1 ? m % 3 === 0 : m % 12 === 0) {
      histTicks.push([
        k,
        years === 1
          ? `${MONTH_SHORT[m % 12]} ’${String(Math.floor(m / 12)).slice(2)}`
          : String(Math.floor(m / 12)),
      ]);
    }
  }
  const histDp = histFactor ? 2 : histDef!.dp;
  const histKey = `${histFactor ?? histDef!.id}|${years}`;
  const histClass =
    histFactor ||
    (histDef &&
      (histDef.transform === 'yoy' ||
        histDef.transform === 'chg1m' ||
        histDef.transform === 'ann3m' ||
        SNAP.series[histDef.id]?.frequency !== 'M'))
      ? 'calculated'
      : 'reported_public';

  return (
    <PageMeta classification="calculated" sources={[FRED]}>
      <SubTabs tabs={TABS} value={tab} onChange={setTab} label="Economic context sections" />
      <AboutFigures
        summary={`Public U.S. data from FRED, retrieved ${RETRIEVED}; monthly factors through ${THROUGH} · market context, not LACERA performance`}
        classification="calculated"
        alsoUsed={['reported_public', 'proxy_estimate', 'stale']}
      >
        <p>
          <strong>Market context, kept apart from portfolio performance.</strong> Public U.S.
          economic series from FRED, read against their own history. Nothing on this tab is a LACERA
          return, a forecast, or a recommendation. The portfolio lens applies stated sensitivity
          assumptions to the IPS policy targets for the {pub.label}; it does not use holdings.
        </p>
        <p>
          The snapshot is dated: the page does not update itself. Factors use monthly averages
          through {THROUGH}; each indicator on the board shows its own latest date, so a daily
          series there can differ from the monthly average the factors use.
        </p>
      </AboutFigures>

      <div role="tabpanel" id="subtab-panel" aria-labelledby={`subtab-${tab}`}>
        {tab === 'summary' ? (
          <>
            <div id="mac-read" className="grid-kpi">
              <Panel tight kicker={`Where the economy sits — ${THROUGH}`}>
                <div className="stat-value smaller">{LEVEL ? LEVEL.headline : 'Not available'}</div>
                <div className="stat-sub">
                  {LEVEL
                    ? `${LEVEL.where}. Growth ${sigma(LEVEL.growthZ)}, inflation ${sigma(LEVEL.inflationZ)}.`
                    : 'The growth or inflation factor is missing in this snapshot.'}
                </div>
                <div className="stat-foot">
                  <button type="button" className="linklike" onClick={() => jump('mac-regime')}>
                    regime map ↓
                  </button>
                </div>
              </Panel>
              <Panel
                tight
                kicker={`Which way it is moving — ${DIRECTION ? monthLabel(DIRECTION.month) : 'n/a'}`}
              >
                <div className="stat-value smaller">
                  {DIRECTION ? DIRECTION.label : 'Not available'}
                </div>
                <div className="stat-sub">
                  {DIRECTION
                    ? `Core PCE inflation ${DIRECTION.inflation} (${signed(DIRECTION.inflationDelta, 2)} pp over three months); labor ${DIRECTION.labor}.`
                    : 'Core PCE, unemployment or payrolls is missing or stale in this snapshot.'}
                </div>
                <div className="stat-foot">
                  <button type="button" className="linklike" onClick={() => jump('mac-rules')}>
                    the rules ↓
                  </button>
                </div>
              </Panel>
              <Panel tight kicker={`Portfolio lens — ${pub.label}`}>
                <div className="stat-value smaller">
                  {fund.exposure === null ? '—' : signed(fund.exposure, 2)}{' '}
                  <ClassBadge c="proxy_estimate" />
                </div>
                <div className="stat-sub">
                  Below zero: today’s readings lean against this policy mix under the stated
                  sensitivities. Largest driver: {fundDriver ? fundDriver.name : '—'}; most negative
                  sleeve: {lowest.name} ({signed(lowest.exposure ?? 0, 2)}); most positive:{' '}
                  {highest.name} ({signed(highest.exposure ?? 0, 2)}).
                </div>
                <div className="stat-foot">
                  <button type="button" className="linklike" onClick={() => jump('mac-lens')}>
                    by sleeve →
                  </button>
                </div>
              </Panel>
              <Panel tight kicker="Largest factor move — three months">
                <div className="stat-value smaller">
                  {mover.name} {sigma(mover.d3)}
                </div>
                <div className="stat-sub">
                  Now {sigma(mover.z)}, against {sigma(mover.z! - mover.d3!)} in{' '}
                  {monthLabel(MODEL.end - 3)}.
                </div>
                <div className="stat-foot">
                  <button type="button" className="linklike" onClick={() => jump('mac-factors')}>
                    all factors →
                  </button>
                </div>
              </Panel>
            </div>

            <div id="mac-regime" className="grid-panels mt">
              <Panel
                kicker="Where — growth against inflation"
                title="Distance from long-run norms"
                sub={`Monthly factor z-scores, ${monthLabel(MODEL.end - 11)} to ${THROUGH}`}
                note={LEVEL?.sentence}
                method={
                  <p>
                    z = (latest − mean) ÷ standard deviation of each series since 1995 (or its first
                    month). The shaded cross is the near-norm band (±{NEAR_NORM} σ), inside which no
                    quadrant is named. The path uses today’s mean and standard deviation for every
                    month, so earlier points are not what could have been computed at the time.
                    Bottom-left is the {QUADRANT_NAME.contraction.toLowerCase()} quadrant.
                  </p>
                }
              >
                {LEVEL ? (
                  <div className="quad-wrap">
                    <QuadrantChart
                      near={NEAR_NORM}
                      trail={LEVEL.trail.map((p) => ({
                        g: p.g,
                        i: p.i,
                        label: monthLabel(p.month),
                      }))}
                      labels={{
                        ne: QUADRANT_NAME.overheating,
                        nw: QUADRANT_NAME.stagflation,
                        se: QUADRANT_NAME.goldilocks,
                        sw: 'Slowdown',
                      }}
                      ariaLabel={`Growth and inflation z-scores over twelve months. ${LEVEL.sentence} ${LEVEL.where}.`}
                    />
                  </div>
                ) : (
                  <p>Not available in this snapshot.</p>
                )}
              </Panel>

              <Panel
                id="mac-rules"
                kicker="Which way — three-month rules"
                title={DIRECTION ? DIRECTION.label : 'Direction not available'}
                sub={DIRECTION ? `Evaluated on ${monthLabel(DIRECTION.month)}` : undefined}
                method={
                  <p>
                    Evaluated on the latest month in which core PCE, unemployment and payrolls are
                    all published and not stale. “Mixed signals” whenever inflation is steady or
                    labor is mixed; otherwise the two results are named together. The thresholds are
                    analyst assumptions, stated so they can be challenged. This is not a recession
                    model.
                  </p>
                }
              >
                {DIRECTION ? (
                  <div
                    className="table-scroll"
                    role="region"
                    aria-label="Direction rules"
                    tabIndex={0}
                  >
                    <table className="table">
                      <caption>Direction rules, their inputs and thresholds</caption>
                      <thead>
                        <tr>
                          <th scope="col">Input</th>
                          <th scope="col" className="num">
                            Reading
                          </th>
                          <th scope="col" className="hide-sm">
                            Rule
                          </th>
                          <th scope="col">Result</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td>
                            Core PCE inflation, change over three months
                            <span className="row-date show-sm">
                              rising above +{RULES.inflationBand} pp; easing below −
                              {RULES.inflationBand} pp
                            </span>
                          </td>
                          <td className="num">{signed(DIRECTION.inflationDelta, 2)} pp</td>
                          <td className="hide-sm">
                            rising above +{RULES.inflationBand} pp; easing below −
                            {RULES.inflationBand} pp
                          </td>
                          <td>
                            <strong>{DIRECTION.inflation}</strong>
                          </td>
                        </tr>
                        <tr>
                          <td>Unemployment, three-month average against the prior three</td>
                          <td className="num">{signed(DIRECTION.laborDelta, 2)} pp</td>
                          <td rowSpan={2} className="hide-sm">
                            softening at +{RULES.laborSoftening} pp or more, or payrolls below zero;
                            firm at +{RULES.laborFirm} pp or less with payrolls above zero
                          </td>
                          <td rowSpan={2}>
                            <strong>{DIRECTION.labor}</strong>
                          </td>
                        </tr>
                        <tr>
                          <td>
                            Payrolls, average monthly change over three months
                            <span className="row-date show-sm">
                              labor softening at +{RULES.laborSoftening} pp or more, or payrolls
                              below zero; firm at +{RULES.laborFirm} pp or less with payrolls above
                              zero
                            </span>
                          </td>
                          <td className="num">{signed(DIRECTION.payrolls, 0)}k</td>
                        </tr>
                        <tr>
                          <td>Core PCE inflation, latest (year-over-year, for reference)</td>
                          <td className="num">{num(DIRECTION.corePce, 2)}%</td>
                          <td className="hide-sm" />
                          <td />
                        </tr>
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p>Core PCE, unemployment or payrolls is missing or stale in this snapshot.</p>
                )}
              </Panel>
            </div>
          </>
        ) : null}

        {tab === 'factors' ? (
          <>
            <Panel
              id="mac-lens"
              kicker={`Portfolio lens — ${pub.label}`}
              title="Which policy sleeves today’s readings lean against"
              sub="Proxy estimate under stated sensitivities: not holdings, not returns, not a forecast"
              method={
                <>
                  <p>
                    Exposure = Σ (stated sensitivity × factor z). Sleeves are weighted by the IPS
                    Table 1 long-term targets, not actual holdings.
                  </p>
                  <p>
                    Real rates carry large negative sensitivities in most sleeves, so a high
                    real-rate reading dominates the total. Z-scores depend on the look-back window
                    (1995 onward, or the series’ first month) and use the full sample. Actual
                    weights, overlays, currency hedges and valuation lags in private markets are not
                    modelled.
                  </p>
                </>
              }
            >
              <div className="panel-controls">
                <ClassBadge c="proxy_estimate" always />
                {scenarioOn ? <Tag variant="blocked">Scenario — not observed</Tag> : null}
              </div>

              <details className="scenario" open={scenarioOn || undefined}>
                <summary>What if? Set factor readings and watch the sleeves re-rank</summary>
                <div className="scenario-body">
                  <div className="scenario-grid">
                    {FACTORS.map((f) => {
                      const obs = MODEL.factors[f.key].z ?? 0;
                      const z = scenario[f.key] ?? obs;
                      const changed = scenario[f.key] !== undefined;
                      return (
                        <label key={f.key} className={`scenario-row${changed ? ' changed' : ''}`}>
                          <span className="sc-name">{f.name}</span>
                          <input
                            type="range"
                            min={-3}
                            max={3}
                            step={0.25}
                            value={Math.round(z * 4) / 4}
                            aria-valuetext={`${signed(z, 2)} standard deviations${changed ? ', set by you' : ', observed'}`}
                            onChange={(ev) => setFactorZ(f.key, Number(ev.target.value))}
                          />
                          <span className="sc-val">
                            {sigma(z)}
                            {changed ? <small> observed {sigma(obs)}</small> : null}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                  <div className="scenario-actions">
                    <button
                      type="button"
                      className="btn-outline btn-small"
                      disabled={!scenarioOn}
                      onClick={() => setScenarioRaw('')}
                    >
                      Reset to observed
                    </button>
                    <span className="footnote">
                      Illustrative only: readings you set are not observed data, and the exposures
                      remain proxy estimates under the stated sensitivities.
                    </span>
                  </div>
                  <div
                    className="rank-list"
                    style={{ height: ranked.length * 30 }}
                    aria-label="Asset classes ranked by exposure, most negative first"
                    role="list"
                  >
                    {lens
                      .filter((r) => r.kind === 'asset')
                      .map((r) => (
                        <div
                          key={r.id}
                          role="listitem"
                          className="rank-row"
                          style={{ transform: `translateY(${(rankOf.get(r.id) ?? 0) * 30}px)` }}
                        >
                          <span className="swatch" style={{ background: r.color }} />
                          <span className="rank-name">{r.name}</span>
                          <ZBar z={r.exposure} max={2} />
                          <span className="rank-val">
                            {r.exposure === null ? '—' : signed(r.exposure, 2)}
                          </span>
                        </div>
                      ))}
                  </div>
                </div>
              </details>

              <div className="lens-layout">
                <div
                  className="table-scroll"
                  role="region"
                  aria-label="Exposure by sleeve"
                  tabIndex={0}
                >
                  <table className="table lens-table">
                    <caption>
                      Exposure by policy sleeve, in factor-weighted standard deviations
                      {scenarioOn ? ' — illustrative scenario' : ''}
                    </caption>
                    <thead>
                      <tr>
                        <th scope="col">Sleeve</th>
                        <th scope="col" className="num">
                          IPS target
                        </th>
                        <th scope="col" className="num">
                          Exposure
                        </th>
                        <th scope="col" className="hide-sm">
                          <span className="visually-hidden">Exposure bar</span>
                        </th>
                        <th scope="col" className="hide-sm">
                          Largest driver
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {lens.map((r) => {
                        const d = dominantFactor(r);
                        const on = r.id === selected.id;
                        return (
                          <tr key={r.id} className={`lens-${r.kind}${on ? ' is-selected' : ''}`}>
                            <td>
                              <button
                                type="button"
                                className="row-select"
                                aria-pressed={on}
                                onClick={() => setLensSel(r.id)}
                              >
                                {r.kind !== 'fund' ? (
                                  <span className="swatch" style={{ background: r.color }} />
                                ) : null}
                                {r.name}
                              </button>
                              {d ? (
                                <span className="row-date show-sm">
                                  driver: {d.name} {signed(d.contrib!, 2)}
                                </span>
                              ) : null}
                            </td>
                            <td className="num">{r.weight}%</td>
                            <td className="num">
                              {r.exposure === null ? '—' : signed(r.exposure, 2)}
                            </td>
                            <td className="hide-sm">
                              <ZBar z={r.exposure} max={2} />
                            </td>
                            <td className="hide-sm">
                              {d ? `${d.name} ${signed(d.contrib!, 2)}` : '—'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <LensDetail row={selected} />
              </div>
              <details className="details-block">
                <summary>
                  Stated sensitivities — all {Object.keys(SENSITIVITIES).length} rows
                </summary>
                <div
                  className="table-scroll"
                  role="region"
                  aria-label="Stated sensitivities"
                  tabIndex={0}
                >
                  <table className="table">
                    <caption>Stated sensitivity of each asset class to each factor</caption>
                    <thead>
                      <tr>
                        <th scope="col">Asset class</th>
                        {FACTORS.map((f) => (
                          <th scope="col" className="num" key={f.key}>
                            {f.name}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(SENSITIVITIES).map(([name, row]) => (
                        <tr key={name}>
                          <td>
                            {name}
                            {row.added ? ' †' : ''}
                          </td>
                          {row.sens.map((v, i) => (
                            <td className="num" key={FACTORS[i]!.key}>
                              {signed(v, 1)}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="footnote">
                  +1 = the class tends to benefit when the factor rises; −1 = it tends to suffer.
                  Analyst priors, not estimated from LACERA returns. † Added so every IPS Table 1
                  sleeve has a row. Credit conditions: higher = tighter, so a negative sensitivity
                  means tighter conditions hurt.
                </p>
              </details>
              <SourceLine sources={[ipsSource]} />
            </Panel>

            <Panel
              id="mac-factors"
              className="mt"
              kicker={`Seven macro factors — monthly, through ${THROUGH}`}
              title="Factor readings against their history since 1995"
              method={
                <p>
                  Each factor is the average of its components’ z-scores, signed so higher always
                  means more of the factor. σ = standard deviations from the series’ own mean. A
                  month that a monthly release has not yet reached carries the prior value forward
                  for up to three months, and the component’s month says which. A factor is reported
                  for a month only when at least half of its inputs are present. Changes are in σ.{' '}
                  <GlossaryLink>What these terms mean</GlossaryLink>.
                </p>
              }
            >
              <div className="table-scroll" role="region" aria-label="Macro factors" tabIndex={0}>
                <table className="table factor-table">
                  <caption>Factor z-scores with three- and twelve-month changes</caption>
                  <thead>
                    <tr>
                      <th scope="col">Factor</th>
                      <th scope="col" className="num">
                        Reading
                      </th>
                      <th scope="col" className="hide-sm">
                        <span className="visually-hidden">Reading bar</span>
                      </th>
                      <th scope="col" className="num">
                        3 months
                      </th>
                      <th scope="col" className="num">
                        12 months
                      </th>
                      <th scope="col" className="hide-sm">
                        5 years
                      </th>
                      <th scope="col" className="num">
                        Inputs
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {FACTOR_KEYS.map((k) => {
                      const f = MODEL.factors[k];
                      const isOpen = open === k;
                      return (
                        <Fragment key={k}>
                          <tr className={isOpen ? 'is-selected' : ''}>
                            <td>
                              <button
                                type="button"
                                className="row-select"
                                aria-expanded={isOpen}
                                aria-controls={`factor-${k}`}
                                onClick={() => setOpen(isOpen ? '' : k)}
                              >
                                <span aria-hidden="true">{isOpen ? '▾' : '▸'}</span> {f.name}
                              </button>
                            </td>
                            <td className="num">{sigma(f.z)}</td>
                            <td className="hide-sm">
                              <ZBar z={f.z} />
                            </td>
                            <td className="num">{f.d3 === null ? '—' : signed(f.d3, 2)}</td>
                            <td className="num">{f.d12 === null ? '—' : signed(f.d12, 2)}</td>
                            <td className="hide-sm">
                              <MiniSpark values={f.hist} zeroLine />
                            </td>
                            <td className="num">
                              {f.coverage}/{f.parts.length}
                            </td>
                          </tr>
                          {isOpen ? (
                            <tr id={`factor-${k}`} className="factor-detail">
                              <td colSpan={7}>
                                <p className="factor-q">{f.question}</p>
                                <table className="table inner">
                                  <caption>Components of the {f.name} factor</caption>
                                  <thead>
                                    <tr>
                                      <th scope="col">Series</th>
                                      <th scope="col">Measure</th>
                                      <th scope="col" className="num">
                                        Latest
                                      </th>
                                      <th scope="col">Month</th>
                                      <th scope="col" className="num">
                                        Signed z
                                      </th>
                                      <th scope="col" className="num hide-sm">
                                        Sample
                                      </th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {f.parts.map((p) => (
                                      <tr key={p.id}>
                                        <td>
                                          <a
                                            href={`https://fred.stlouisfed.org/series/${p.id}`}
                                            target="_blank"
                                            rel="noreferrer"
                                          >
                                            {p.short}
                                          </a>{' '}
                                          <span className="footnote-inline">{p.id}</span>
                                        </td>
                                        <td>
                                          {TRANSFORM_LABEL[p.transform]}
                                          {p.sign < 0 ? ' (inverted)' : ''}
                                        </td>
                                        <td className="num">
                                          {p.value === null
                                            ? '—'
                                            : num(p.value, Math.abs(p.value) >= 1000 ? 0 : 2)}
                                        </td>
                                        <td>{p.month === null ? '—' : monthLabel(p.month)}</td>
                                        <td className="num">
                                          {p.z === null ? '—' : signed(p.z, 2)}
                                        </td>
                                        <td className="num hide-sm">
                                          {p.params
                                            ? `${p.params.n} months from ${monthLabel(p.params.from)}`
                                            : '—'}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </td>
                            </tr>
                          ) : null}
                        </Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Panel>
          </>
        ) : null}

        {tab === 'indicators' ? (
          <>
            <Panel
              id="mac-board"
              kicker="Indicator board — each series at its own latest date"
              title="Six questions, answered from the latest published figures"
              method={
                <p>
                  Daily and weekly series: latest observation, change over about 30 days. Monthly
                  series: latest month, change on the month before. Levels and rescaled levels are
                  reproduced as published (reported public); year-over-year and monthly changes are
                  calculated here. A series is marked stale when its latest observation is older
                  than 7 days (daily), 21 days (weekly) or 60 days after the month ends (monthly),
                  measured from the retrieval date.
                </p>
              }
            >
              <div className="board-grid">
                {BOARD.map(({ panel, head, rows }) => (
                  <section
                    className="board-card"
                    key={panel.key}
                    aria-labelledby={`board-${panel.key}`}
                  >
                    <div className="kicker">{panel.title}</div>
                    <h3 id={`board-${panel.key}`}>{panel.question}</h3>
                    {head ? (
                      <>
                        <div className="stat-value smaller">
                          <Value r={head} />
                        </div>
                        <div className="stat-sub">
                          {head.def.label} · {head.date}
                          {head.def.note ? ` · ${head.def.note}` : ''}
                        </div>
                        <div className="stat-foot">
                          {head.def.transform === 'chg1m' ? (
                            <span className="footnote-inline">
                              {head.change === null
                                ? ''
                                : `prior month ${signed(head.value - head.change, head.def.dp)}k`}
                            </span>
                          ) : (
                            <>
                              <ChangeChip
                                delta={head.change}
                                unit={changeUnit(head.def.unit)}
                                dp={head.def.dp}
                                title={head.changeBasis}
                              />
                              <span className="footnote-inline">{head.changeBasis}</span>
                            </>
                          )}
                          <ClassBadge c={head.stale ? 'stale' : head.classification} />
                        </div>
                        <MiniSpark values={head.spark} zeroLine={head.def.transform !== 'level'} />
                      </>
                    ) : (
                      <p>Not in this snapshot.</p>
                    )}
                    <table className="table board-rows">
                      <caption>{panel.title}: supporting indicators</caption>
                      <thead>
                        <tr>
                          <th scope="col">Indicator</th>
                          <th scope="col" className="num">
                            Latest
                          </th>
                          <th scope="col" className="num">
                            Change
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((r, i) =>
                          r ? (
                            <tr key={r.def.id}>
                              <td>
                                {r.def.label}
                                <span className="row-date">
                                  {r.date}
                                  {r.stale ? ' · stale' : ''}
                                </span>
                              </td>
                              <td className="num">
                                <Value r={r} />
                              </td>
                              <td className="num" title={r.changeBasis}>
                                {r.change === null || r.def.transform === 'chg1m'
                                  ? '—'
                                  : signed(r.change, r.def.dp)}
                              </td>
                            </tr>
                          ) : (
                            <tr key={panel.rows[i]!.id}>
                              <td>{panel.rows[i]!.label}</td>
                              <td className="num">—</td>
                              <td className="num">—</td>
                            </tr>
                          ),
                        )}
                      </tbody>
                    </table>
                  </section>
                ))}
              </div>
            </Panel>

            <Panel
              id="mac-history"
              className="mt"
              kicker="History"
              title={histLabel}
              sub={`Monthly, ${monthLabel(histStart)} to ${THROUGH}${histFactor ? ' — shaded band = near norm' : ''}`}
              method={
                <p>
                  Daily and weekly series are shown as FRED’s monthly averages. Drag across the
                  chart to zoom into a stretch of months; the values table lists every month in the
                  selected range.
                </p>
              }
            >
              <div className="panel-controls">
                <label>
                  Series{' '}
                  <select
                    aria-label="History series"
                    value={histFactor ? `factor:${histFactor}` : histDef!.id}
                    onChange={(ev) => setHistSel(ev.target.value)}
                  >
                    <optgroup label="Factors (z-score)">
                      {FACTORS.map((f) => (
                        <option key={f.key} value={`factor:${f.key}`}>
                          {f.name}
                        </option>
                      ))}
                    </optgroup>
                    {PANELS.map((p) => (
                      <optgroup key={p.key} label={p.title}>
                        {[p.headline, ...p.rows].map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.label}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </label>
                <div className="seg-mini" role="group" aria-label="History range">
                  {['1', '3', '5'].map((y) => (
                    <button
                      type="button"
                      key={y}
                      aria-pressed={String(years) === y}
                      onClick={() => setHistRange(y)}
                    >
                      {y}Y
                    </button>
                  ))}
                </div>
                <ClassBadge c={histClass} />
              </div>
              <LineChart
                key={histKey}
                zoomable
                series={[{ label: histLabel, values: histValues }]}
                xTicks={histTicks}
                xCount={span}
                unit={histFactor ? 'σ' : histDef!.unit}
                band={histFactor ? [-NEAR_NORM, NEAR_NORM] : undefined}
                pointLabel={(i) => monthLabel(histStart + i)}
                format={(v) => num(v, histDp)}
                ariaLabel={`${histLabel}, monthly from ${monthLabel(histStart)} to ${THROUGH}. Values are listed in the table below the chart.`}
              />
              <details className="details-block">
                <summary>Values</summary>
                <div
                  className="table-scroll"
                  role="region"
                  aria-label="History values"
                  tabIndex={0}
                >
                  <table className="table">
                    <caption>{histLabel} by month</caption>
                    <thead>
                      <tr>
                        <th scope="col">Month</th>
                        <th scope="col" className="num">
                          {histFactor ? 'z-score' : histDef!.unit}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {histValues
                        .map((v, k) => [histStart + k, v] as const)
                        .reverse()
                        .map(([m, v]) => (
                          <tr key={m}>
                            <td>{monthLabel(m)}</td>
                            <td className="num">{v === null ? '—' : num(v, histDp)}</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </details>
            </Panel>

            <div id="mac-curve" className="grid-panels mt">
              <Panel
                kicker="Treasury yield curve"
                title={CURVES[0] ? `Curve on ${dayLabel(CURVES[0].date)}` : 'Curve not available'}
                note="Select a date in the legend to show or hide its curve."
                method={
                  <p>
                    Each curve uses one date on which all five maturities were published; comparison
                    dates are the last common dates at least 30 and 365 days before the latest.
                    Maturities are evenly spaced, not to scale.
                  </p>
                }
              >
                <div className="panel-controls">
                  <ClassBadge c="reported_public" />
                </div>
                {CURVES.length ? (
                  <>
                    <LineChart
                      series={CURVES.map((c, i) => ({
                        label: dayLabel(c.date),
                        values: c.points.map((p) => p.value),
                        variant: CURVE_VARIANTS[i] ?? 'tertiary',
                      })).filter((s) => !curvesOff.includes(s.label))}
                      xTicks={CURVES[0]!.points.map((p, i) => [i, p.maturity])}
                      xCount={5}
                      unit="%"
                      height={210}
                      points
                      pointLabel={(i) => `${CURVES[0]!.points[i]?.maturity ?? ''} maturity`}
                      format={(v) => num(v, 2)}
                      ariaLabel={`Treasury yields by maturity on ${CURVES.map((c) => dayLabel(c.date)).join(', ')}. Values are in the table below the chart.`}
                    />
                    <div className="chart-legend curve-legend">
                      {CURVES.map((c, i) => {
                        const label = dayLabel(c.date);
                        const on = !curvesOff.includes(label);
                        return (
                          <button
                            type="button"
                            key={c.date}
                            className={`legend-toggle${on ? '' : ' off'}`}
                            aria-pressed={on}
                            onClick={() =>
                              setCurvesOff((prev) =>
                                prev.includes(label)
                                  ? prev.filter((x) => x !== label)
                                  : prev.length < CURVES.length - 1
                                    ? [...prev, label]
                                    : prev,
                              )
                            }
                          >
                            <span
                              className={`legend-line lc-${CURVE_VARIANTS[i] ?? 'tertiary'}`}
                              aria-hidden="true"
                            />
                            {label}
                          </button>
                        );
                      })}
                    </div>
                    <div
                      className="table-scroll"
                      role="region"
                      aria-label="Treasury yields"
                      tabIndex={0}
                    >
                      <table className="table">
                        <caption>Treasury constant-maturity yields, percent</caption>
                        <thead>
                          <tr>
                            <th scope="col">Date</th>
                            {CURVES[0]!.points.map((p) => (
                              <th scope="col" className="num" key={p.maturity}>
                                {p.maturity}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {CURVES.map((c) => (
                            <tr key={c.date}>
                              <td>{dayLabel(c.date)}</td>
                              {c.points.map((p) => (
                                <td className="num" key={p.maturity}>
                                  {num(p.value, 2)}%
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                ) : (
                  <p>No date in the snapshot has all five maturities.</p>
                )}
              </Panel>

              <Panel
                kicker="Transmission channels"
                title="How the latest moves reach asset prices"
                sub="General mechanisms, not a statement about LACERA’s portfolio"
                method={
                  <p>
                    Changes over about 30 days of native daily or weekly observations. “Little
                    change” thresholds: ±5 bps for yields, ±0.10 for the stress index.
                  </p>
                }
              >
                <div className="read-list">
                  {CHANNELS.map((c, i) => (
                    <div className="read-item" key={c.channel}>
                      <span className="n">{String(i + 1).padStart(2, '0')}</span>
                      <div>
                        <div className="q">{c.channel}</div>
                        <div className="a">{c.text}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </Panel>
            </div>
          </>
        ) : null}

        {tab === 'sources' ? (
          <Panel
            id="mac-sources"
            kicker="Sources, terms and method"
            title={`${Object.keys(SNAP.series).length} public series used; ${SNAP.excluded.length} left out`}
            sub={`Retrieved from FRED on ${RETRIEVED}; redistribution terms checked ${longDate(SNAP.termsCheckedOn)}`}
          >
            <details className="details-block" style={{ marginTop: 0 }}>
              <summary>All {Object.keys(SNAP.series).length} series, with original sources</summary>
              <div className="table-scroll" role="region" aria-label="Series used" tabIndex={0}>
                <table className="table">
                  <caption>Series used on this tab</caption>
                  <thead>
                    <tr>
                      <th scope="col">Series</th>
                      <th scope="col">Original source</th>
                      <th scope="col">Frequency</th>
                      <th scope="col">Units</th>
                      <th scope="col">Updated on FRED</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.values(SNAP.series).map((s) => (
                      <tr key={s.id}>
                        <td>
                          <a
                            href={`https://fred.stlouisfed.org/series/${s.id}`}
                            target="_blank"
                            rel="noreferrer"
                          >
                            {s.id}
                          </a>{' '}
                          <span className="row-date">{s.title}</span>
                        </td>
                        <td>{s.provider}</td>
                        <td>
                          {FREQ[s.frequency] ?? s.frequency}
                          {s.seasonal === 'SA' ? ', seasonally adjusted' : ''}
                        </td>
                        <td>{s.unitsShort}</td>
                        <td>{longDate(s.lastUpdated)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
            <h3 className="sub-h">Left out on their terms</h3>
            <div className="table-scroll" role="region" aria-label="Series left out" tabIndex={0}>
              <table className="table">
                <caption>Series not used, and why</caption>
                <thead>
                  <tr>
                    <th scope="col">Series</th>
                    <th scope="col">Why it is not shown</th>
                  </tr>
                </thead>
                <tbody>
                  {SNAP.excluded.map((x) => (
                    <tr key={x.id}>
                      <td>
                        {x.title} <span className="row-date">{x.id}</span>
                      </td>
                      <td>{x.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <h3 className="sub-h">Method</h3>
            <ul className="limits">
              <li>
                A dated snapshot, not a live feed. <code>tools/fetch_macro_snapshot.py</code> pulls
                the raw observations with a FRED key kept outside the repository; the site never
                calls FRED and holds no key. Every derived figure is computed in the browser by
                tested code.
              </li>
              <li>
                Monthly values are FRED’s monthly averages for daily and weekly series.
                Year-over-year changes compare the same calendar month; a missing base month stays
                missing.
              </li>
              <li>
                Factors: equal-weighted averages of component z-scores. Credit conditions use the
                Chicago Fed credit and risk subindexes and the St. Louis Fed stress index, because
                the usual corporate-spread series may not be republished. Oil and gas enter as
                year-over-year changes.
              </li>
              <li>
                The regime read and the transmission thresholds are rules with stated assumptions;
                the portfolio lens and any scenario are proxy estimates. None is a forecast,
                attribution, or recommendation.
              </li>
              <li>
                Kept apart from the fiscal-year tabs and the CIO Monthly tab: different sources,
                different dates, never combined.
              </li>
            </ul>
          </Panel>
        ) : null}
      </div>
      <PageSources sources={[FRED]} />
    </PageMeta>
  );
}

function LensDetail({ row }: { row: LensRow }) {
  const total = row.contribs.reduce((s, c) => s + (c.contrib ?? 0), 0);
  return (
    <div className="lens-detail" aria-live="polite">
      <div className="kicker">Factor arithmetic</div>
      <h3>
        {row.name} <Tag variant="neutral">{row.weight}% target</Tag>
      </h3>
      <table className="table lens-math">
        <caption>
          Contribution of each factor to the {row.name} exposure: factor z times stated sensitivity
        </caption>
        <thead>
          <tr>
            <th scope="col">Factor</th>
            <th scope="col" className="num">
              z
            </th>
            <th scope="col" className="num">
              × sens.
            </th>
            <th scope="col" className="num">
              = contrib.
            </th>
          </tr>
        </thead>
        <tbody>
          {row.contribs.map((c) => (
            <tr key={c.factor}>
              <td>{c.name}</td>
              <td className="num">{c.z === null ? '—' : signed(c.z, 2)}</td>
              <td className="num">{signed(c.sens, 2)}</td>
              <td className="num">{c.contrib === null ? '—' : signed(c.contrib, 2)}</td>
            </tr>
          ))}
          <tr className="total-row">
            <td>Exposure</td>
            <td />
            <td />
            <td className="num">{row.exposure === null ? '—' : signed(row.exposure, 2)}</td>
          </tr>
        </tbody>
      </table>
      <p className="footnote">
        {row.kind === 'asset'
          ? `Sensitivities from the “${row.sensRow}” row.`
          : 'Sensitivities are the target-weighted average of the sleeves below.'}{' '}
        {Math.abs(total - (row.exposure ?? total)) > 0.005
          ? 'Contributions are rounded; the exposure is computed before rounding.'
          : ''}
      </p>
    </div>
  );
}
