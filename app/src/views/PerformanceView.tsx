import { useState } from 'react';

import { ChartTip, LegendToggle, Reveal, useActiveIndex } from '../components/ChartKit';
import { AboutFigures, PageMeta } from '../components/page';
import { excessTag, money, Panel, SourceLine, Tag } from '../components/ui';
import { HORIZONS, publishedFor } from '../fixtures/published';
import { useEntity } from '../lib/entity';
import { useTween } from '../lib/motion';

/** Performance — annualized returns vs the policy benchmark, three years of changes in
 *  fiduciary net position, and cumulative investment income since FY2016. Quoted figures. */

const FY_START = 2016;

export function PerformanceView() {
  const { entity } = useEntity();
  const d = publishedFor(entity);
  const P = entity === 'PENSION';
  // tested against the highest assumed rate of the ten-year window, not just the current one
  const aboveAssumed = d.ret.f.every((f) => f > d.assumedRate.decadeMax);

  const [showFund, setShowFund] = useState(true);
  const [showBench, setShowBench] = useState(true);
  const bars = useActiveIndex(HORIZONS.length);
  const cum = useActiveIndex(d.cum.length);
  const h = bars.active;

  const rMax = Math.max(...d.ret.f, ...d.ret.b);

  // cumulative income area chart; the geometry moves to the other fund's values on a switch
  const PLOT_SPAN = 128;
  const cMin = Math.min(0, ...d.cum);
  const cMax = Math.max(...d.cum);
  const cRange = cMax - cMin;
  const yOf = (v: number) => 172 - ((v - cMin) / cRange) * PLOT_SPAN;
  const xOf = (i: number) => (i / (d.cum.length - 1)) * 600;
  const ys = useTween(d.cum.map(yOf));
  const pts = ys.map((y, i) => `${xOf(i).toFixed(1)} ${(y ?? 172).toFixed(1)}`);
  const cumLine = `M ${pts.join(' L ')}`;
  const cumArea = `${cumLine} L 600 179 L 0 179 Z`;
  let cStep = Math.pow(10, Math.floor(Math.log10(cRange)));
  if (cRange / cStep < 3) cStep = cStep / 2;
  const cumGrid: { top: number; label: string }[] = [];
  for (let v = Math.ceil(cMin / cStep) * cStep; v < cMax - cStep * 0.15; v += cStep) {
    if (v <= cMin) continue;
    cumGrid.push({ top: yOf(v), label: v.toLocaleString('en-US') });
  }
  const c = cum.active;

  return (
    <PageMeta classification="reported_public">
      <AboutFigures
        summary="Fiscal year ended June 30, 2025 — 2025 PAFR and 2025 ACFR"
        classification="reported_public"
        alsoUsed={['calculated']}
      >
        <p>
          Time-weighted returns (TWR), net of investment-management fees, annualized for periods
          over one year, as published. The ACFR separately reports money-weighted returns (MWR); the
          two are not comparable and are never mixed here. Private-market benchmarks are lagged 1–3
          months (IPS Table 2).
        </p>
      </AboutFigures>

      <div className="grid-panels">
        <Panel
          id="perf-returns"
          kicker="Net of investment-management fees"
          title="Periods ended June 30, 2025"
          note={`${d.retNote} ${
            aboveAssumed
              ? 'Every horizon also exceeds the actuarial assumed rate of return.'
              : 'Not every horizon exceeds the actuarial assumed rate of return.'
          }`}
          method={
            <p>
              Excess = fund − policy benchmark, calculated in percentage points from the quoted
              figures. The assumed-rate test uses the highest rate in force during the ten years (
              {d.assumedRate.basis}).
            </p>
          }
        >
          <div
            className="table-scroll"
            role="region"
            aria-label="Annualized returns vs policy benchmark"
            tabIndex={0}
          >
            <table className="table">
              <caption>Annualized returns vs policy benchmark</caption>
              <thead>
                <tr>
                  <th scope="col">Period</th>
                  <th scope="col" className="num">
                    Fund
                  </th>
                  <th scope="col" className="num">
                    Policy benchmark
                  </th>
                  <th scope="col" className="num">
                    Excess
                  </th>
                </tr>
              </thead>
              <tbody onPointerLeave={() => bars.setActive(null)}>
                {HORIZONS.map((label, i) => {
                  const t = excessTag(d.ret.f[i]!, d.ret.b[i]!);
                  return (
                    <tr
                      key={label}
                      className={h === i ? 'is-linked' : undefined}
                      onPointerEnter={() => bars.setActive(i)}
                    >
                      <td>{label}</td>
                      <td className="num" style={{ fontWeight: 500 }}>
                        {d.ret.f[i]!.toFixed(1)}%
                      </td>
                      <td className="num">{d.ret.b[i]!.toFixed(1)}%</td>
                      <td className="num">
                        <Tag variant={t.variant}>{t.text}</Tag>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <SourceLine
            sources={P ? ['PAFR_PENSION', 'ACFR_RETURNS'] : ['PAFR_OPEB', 'ACFR_RETURNS']}
          />
        </Panel>

        <Panel id="perf-chart" kicker="Fund vs benchmark by horizon" title="Percent, annualized">
          <Reveal className="chart-wrap" style={{ marginTop: 16 }}>
            <div
              className="pair-chart"
              role="img"
              aria-label={`Fund and policy benchmark returns by horizon: ${HORIZONS.map(
                (x, i) =>
                  `${x} fund ${d.ret.f[i]!.toFixed(1)}%, benchmark ${d.ret.b[i]!.toFixed(1)}%`,
              ).join('; ')}. Use the arrow keys to read each horizon.`}
              onPointerLeave={() => bars.setActive(null)}
              {...bars.keyProps}
            >
              {HORIZONS.map((label, i) => (
                <div
                  key={label}
                  className={`pair${h === i ? ' on' : ''}${h !== null && h !== i ? ' dim' : ''}`}
                  onPointerEnter={() => bars.setActive(i)}
                >
                  {showFund ? (
                    <div className="bar-col pair-col">
                      <div className="bar-val" style={{ color: 'var(--accent-800)' }}>
                        {d.ret.f[i]!.toFixed(1)}
                      </div>
                      <div
                        className="bar bar-fund"
                        style={{ height: `${((d.ret.f[i]! / rMax) * 100).toFixed(1)}%` }}
                      />
                    </div>
                  ) : null}
                  {showBench ? (
                    <div className="bar-col pair-col">
                      <div className="bar-val" style={{ fontWeight: 400 }}>
                        {d.ret.b[i]!.toFixed(1)}
                      </div>
                      <div
                        className="bar bar-bench"
                        style={{ height: `${((d.ret.b[i]! / rMax) * 100).toFixed(1)}%` }}
                      />
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
            {h !== null ? (
              <ChartTip
                left={`${(((h + 0.5) / HORIZONS.length) * 100).toFixed(1)}%`}
                flip={h >= HORIZONS.length / 2}
              >
                <strong>{HORIZONS[h]}</strong>
                <span>Fund {d.ret.f[h]!.toFixed(1)}%</span>
                <span>Benchmark {d.ret.b[h]!.toFixed(1)}%</span>
                <span>{excessTag(d.ret.f[h]!, d.ret.b[h]!).text} (calculated)</span>
              </ChartTip>
            ) : null}
          </Reveal>
          <div className="pair-x">
            {HORIZONS.map((label) => (
              <div key={label}>{label}</div>
            ))}
          </div>
          <div className="chart-legend">
            <LegendToggle
              on={showFund}
              onToggle={() => (showFund && !showBench ? null : setShowFund(!showFund))}
              swatch={{ background: 'var(--cyan-bar)', border: '1px solid var(--accent-700)' }}
            >
              Fund
            </LegendToggle>
            <LegendToggle
              on={showBench}
              onToggle={() => (showBench && !showFund ? null : setShowBench(!showBench))}
              swatch={{ background: 'var(--accent-700)', border: '1px solid var(--accent-800)' }}
            >
              Policy benchmark
            </LegendToggle>
          </div>
        </Panel>
      </div>

      <div className="grid-panels mt">
        <Panel
          id="perf-changes"
          kicker="Changes in fiduciary net position"
          title="Fiscal years ended June 30 · $ millions"
        >
          <div
            className="table-scroll"
            role="region"
            aria-label="Changes in fiduciary net position, three fiscal years"
            tabIndex={0}
          >
            <table className="table">
              <caption>Changes in fiduciary net position, three fiscal years</caption>
              <thead>
                <tr>
                  <th scope="col">
                    <span className="visually-hidden">Line item</span>
                  </th>
                  <th scope="col" className="num">
                    FY2025
                  </th>
                  <th scope="col" className="num">
                    FY2024
                  </th>
                  <th scope="col" className="num">
                    FY2023
                  </th>
                </tr>
              </thead>
              <tbody>
                {d.chg.map((r) => (
                  <tr key={r.label}>
                    <td style={{ fontWeight: r.bold ? 600 : 400 }}>{r.label}</td>
                    <td className="num" style={{ fontWeight: r.bold ? 600 : 400 }}>
                      {money(r.fy2025)}
                    </td>
                    <td className="num">{money(r.fy2024)}</td>
                    <td className="num">{money(r.fy2023)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <SourceLine sources={['PAFR_CHANGES']} />
        </Panel>

        <Panel
          id="perf-cum"
          kicker="Net investment activities"
          title="Cumulative investment income, FY2016–FY2025"
          sub={`${d.cumUnit} · summed from the quoted annual figures (calculated)`}
          note={d.cumNote}
        >
          <Reveal className="chart-wrap" style={{ marginTop: 14 }}>
            <div
              className="cum-chart"
              role="img"
              aria-label={`Cumulative investment income rising to ${d.cumEnd} by FY2025. Use the arrow keys to read each year.`}
              onPointerMove={(ev) => {
                const r = ev.currentTarget.getBoundingClientRect();
                const k = Math.round(((ev.clientX - r.left) / r.width) * (d.cum.length - 1));
                cum.setActive(Math.max(0, Math.min(d.cum.length - 1, k)));
              }}
              onPointerLeave={() => cum.setActive(null)}
              {...cum.keyProps}
            >
              <svg
                viewBox="0 0 600 180"
                preserveAspectRatio="none"
                style={{ width: '100%', height: 180, display: 'block' }}
                aria-hidden="true"
              >
                <path d={cumArea} fill="var(--accent-200)" className="fade" />
                <path
                  d={cumLine}
                  fill="none"
                  stroke="var(--accent-700)"
                  strokeWidth={2}
                  vectorEffect="non-scaling-stroke"
                  pathLength={1}
                  className="draw"
                />
                <line
                  x1={0}
                  y1={179}
                  x2={600}
                  y2={179}
                  stroke="var(--divider)"
                  strokeWidth={1}
                  vectorEffect="non-scaling-stroke"
                />
                {c !== null ? (
                  <line
                    x1={xOf(c)}
                    x2={xOf(c)}
                    y1={0}
                    y2={179}
                    className="crosshair"
                    vectorEffect="non-scaling-stroke"
                  />
                ) : null}
              </svg>
              <div className="cum-end">{d.cumEnd}</div>
              {cumGrid.map((gr) => (
                <div key={gr.label}>
                  <div className="cum-grid" style={{ top: gr.top }} />
                  <span className="cum-grid-label" style={{ top: gr.top - 15 }}>
                    {gr.label}
                  </span>
                </div>
              ))}
            </div>
            {c !== null ? (
              <ChartTip
                left={`${((c / (d.cum.length - 1)) * 100).toFixed(1)}%`}
                top={Math.max(0, yOf(d.cum[c]!) - 70)}
                flip={c >= d.cum.length / 2}
              >
                <strong>FY{FY_START + c}</strong>
                <span>
                  {d.cum[c]!.toLocaleString('en-US')} cumulative ({d.cumUnit})
                </span>
              </ChartTip>
            ) : null}
          </Reveal>
          <div className="cum-x">
            <span>FY2016</span>
            <span>FY2025</span>
          </div>
        </Panel>
      </div>
    </PageMeta>
  );
}
