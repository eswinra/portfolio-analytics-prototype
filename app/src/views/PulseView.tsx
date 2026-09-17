import { useState } from 'react';
import { Link } from 'react-router-dom';

import { ChartTip, Reveal, useActiveIndex } from '../components/ChartKit';
import { AboutFigures, PageMeta } from '../components/page';
import { ChangeChip, ClassBadge, excessTag, Panel, SourceLine, Tag } from '../components/ui';
import { CIO_LATEST, cioFor, longDate, PERIOD_INDEX, priorVintage } from '../fixtures/cioMonthly';
import { GROWTH_YEARS, HORIZONS, publishedFor } from '../fixtures/published';
import { useEntity } from '../lib/entity';

/** Overview — the latest monthly state of the fund, then the fiscal-year picture: KPI row,
 *  decade growth bars, allocation strip, returns vs benchmark, and the FY2025 flows list.
 *  The two vintages sit in separate blocks with their own dates and are never combined. */

export function PulseView() {
  const { entity } = useEntity();
  const d = publishedFor(entity);
  const P = entity === 'PENSION';

  const gMax = Math.max(...d.growth);
  const mixTotal = d.mix.reduce((s, m) => s + m.pct, 0);
  const growth = useActiveIndex(d.growth.length);
  const [mixOn, setMixOn] = useState<string | null>(null);

  // monthly strip: the newest CIO Monthly Report, kept visually and textually apart from the
  // fiscal-year figures below it
  const { oneMonth, fytd } = PERIOD_INDEX;
  const m = cioFor(entity, CIO_LATEST);
  const mPrior = priorVintage(CIO_LATEST);
  const mp = mPrior ? cioFor(entity, mPrior) : null;
  const mPct = (v: number | null | undefined) =>
    v === null || v === undefined ? '—' : `${v < 0 ? '−' : ''}${Math.abs(v).toFixed(1)}%`;
  const mSigned = (v: number | null | undefined) =>
    v === null || v === undefined
      ? '—'
      : `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v).toFixed(1)}`;
  const mExcess = (i: number) => {
    const f = m.total.r[i];
    const b = m.total.b[i];
    return f === null || f === undefined || b === null || b === undefined ? null : f - b;
  };
  const widestGap = m.comps.reduce((a, b) =>
    Math.abs(b.pct - b.tgt) > Math.abs(a.pct - a.tgt) ? b : a,
  );
  const g = growth.active;

  return (
    <PageMeta classification="reported_public">
      <AboutFigures
        summary={`Fiscal year ended June 30, 2025 (2025 PAFR, ACFR and IPS); the strip on top is the ${CIO_LATEST.reportLabel} CIO Monthly Report`}
        classification="reported_public"
        alsoUsed={['calculated']}
      >
        <p>
          Two reporting vintages, never combined. The monthly strip quotes the investment
          portfolio&apos;s market value and returns from the latest CIO Monthly Report (data through{' '}
          {longDate(CIO_LATEST.dataThrough)}). Everything below the divider is the fiscal year ended
          June 30, 2025, as printed in the 2025 Popular Annual Financial Report, the 2025 ACFR and
          the Investment Policy Statements.
        </p>
        {P ? (
          <p>
            The funded ratio comes from the June 30, 2024 actuarial valuation (Milliman), which is
            dated separately from the financial statements.
          </p>
        ) : null}
      </AboutFigures>

      <Panel
        id="ov-monthly"
        className="monthly-strip"
        kicker={`Latest monthly report — ${CIO_LATEST.reportLabel}`}
        title={`Where the ${m.short} stands, data through ${longDate(CIO_LATEST.dataThrough)}`}
        sub="A separate vintage from the fiscal-year figures below"
        method={
          <p>
            Market value is the investment portfolio at month end, not the fiduciary net position at
            the fiscal year end. Excess (fund − benchmark) and the allocation gap (weight − 2024 SAA
            target) are calculated from the printed one-decimal figures.
          </p>
        }
      >
        <div className="strip-figures">
          <div>
            <div className="l">Market value</div>
            <div className="v">${m.aum.toFixed(1)}B</div>
            <div className="s">
              {mp ? <ChangeChip delta={m.mv - mp.mv} unit="$M" dp={0} /> : null} since the prior
              report
            </div>
          </div>
          <div>
            <div className="l">Month return, net</div>
            <div className="v">{mPct(m.total.r[oneMonth])}</div>
            <div className="s">
              Benchmark {mPct(m.total.b[oneMonth])} · {mSigned(mExcess(oneMonth))} pp excess
            </div>
          </div>
          <div>
            <div className="l">Fiscal year to date</div>
            <div className="v">{mPct(m.total.r[fytd])}</div>
            <div className="s">
              Benchmark {mPct(m.total.b[fytd])} · hurdle {mPct(m.total.h[fytd])}
            </div>
          </div>
          <div>
            <div className="l">
              Widest allocation gap <ClassBadge c="calculated" />
            </div>
            <div className="v">{mSigned(widestGap.pct - widestGap.tgt)} pp</div>
            <div className="s">
              {widestGap.short} {mPct(widestGap.pct)} vs {mPct(widestGap.tgt)} target
            </div>
          </div>
        </div>
        <p className="panel-note">
          <Link to="/cio">Open the CIO Monthly view →</Link>
        </p>
        <SourceLine
          records={[
            {
              id: 'CIO_OVERVIEW',
              label: `CIO Monthly Report (${CIO_LATEST.reportLabel})`,
              doc: 'Chief Investment Officer Monthly Report',
              pageTable: m.pages,
              asOf: longDate(CIO_LATEST.dataThrough),
              ...(CIO_LATEST.url ? { url: CIO_LATEST.url } : {}),
            },
          ]}
        />
      </Panel>

      <div className="fy-divider" role="separator">
        <span>Fiscal year ended June 30, 2025 — annual reports</span>
      </div>

      <div className="grid-kpi">
        {d.kpis.map(([kicker, value, sub]) => (
          <Panel key={kicker} tight kicker={kicker}>
            <div className="stat-value">{value}</div>
            <div className="stat-sub">{sub}</div>
          </Panel>
        ))}
      </div>
      <div className="tile-sources">
        <SourceLine sources={P ? ['PAFR_PENSION'] : ['PAFR_OPEB', 'PAFR_OPEB_ENROLL']} />
      </div>

      <div className="grid-panels mt">
        <Panel
          id="ov-growth"
          kicker={`Growth of the ${d.label}`}
          title="Fiduciary net position, FY2016–FY2025"
          sub={`${d.growthUnit} · net of fees and expenses`}
          note={d.growthNote}
        >
          <Reveal className="chart-wrap" style={{ marginTop: 16 }}>
            <div
              className="bar-chart"
              role="img"
              aria-label={`Fiduciary net position by fiscal year, ${d.growthUnit}: ${d.growth
                .map((v, i) => `FY${GROWTH_YEARS[i]} ${v.toFixed(1)}`)
                .join(', ')}. Use the arrow keys to read each year.`}
              onPointerLeave={() => growth.setActive(null)}
              {...growth.keyProps}
            >
              {d.growth.map((v, i) => (
                <div
                  className={`bar-col${g === i ? ' on' : ''}${g !== null && g !== i ? ' dim' : ''}`}
                  key={GROWTH_YEARS[i]}
                  onPointerEnter={() => growth.setActive(i)}
                >
                  <div className={`bar-val${i === 9 ? ' hi' : ''}`}>{v.toFixed(1)}</div>
                  <div
                    className={`bar${i === 9 ? ' hi' : ''}`}
                    style={{ height: `${((v / gMax) * 100).toFixed(1)}%` }}
                  />
                </div>
              ))}
            </div>
            {g !== null ? (
              <ChartTip
                left={`${(((g + 0.5) / d.growth.length) * 100).toFixed(1)}%`}
                flip={g > d.growth.length / 2}
              >
                <strong>FY{GROWTH_YEARS[g]}</strong>
                <span>
                  {d.growth[g]!.toFixed(1)} {d.growthUnit}
                </span>
                {g > 0 ? (
                  <span>
                    {d.growth[g]! - d.growth[g - 1]! >= 0 ? '+' : '−'}
                    {Math.abs(d.growth[g]! - d.growth[g - 1]!).toFixed(1)} on FY
                    {GROWTH_YEARS[g - 1]} (calculated)
                  </span>
                ) : null}
              </ChartTip>
            ) : null}
          </Reveal>
          <div className="bar-x">
            {GROWTH_YEARS.map((y) => (
              <span key={y}>’{y.slice(2)}</span>
            ))}
          </div>
          <SourceLine sources={['PAFR_GROWTH']} />
        </Panel>

        <Panel id="ov-mix" kicker={d.allocKicker} title="Asset allocation" note={d.allocFoot}>
          <Reveal className="mix-wrap" style={{ marginTop: 4 }}>
            <div className="alloc-strip" onPointerLeave={() => setMixOn(null)}>
              {d.mix.map((x) => (
                <div
                  key={x.label}
                  className={mixOn && mixOn !== x.label ? 'dim' : undefined}
                  style={{
                    width: `${((x.pct / mixTotal) * 100).toFixed(2)}%`,
                    background: x.color,
                  }}
                  title={`${x.label} ${x.pct}%`}
                  onPointerEnter={() => setMixOn(x.label)}
                />
              ))}
            </div>
          </Reveal>
          <div
            style={{ display: 'flex', flexDirection: 'column', gap: 9, marginTop: 16 }}
            onPointerLeave={() => setMixOn(null)}
          >
            {d.mix.map((x) => (
              <div
                key={x.label}
                className={`legend-item${mixOn === x.label ? ' on' : ''}${mixOn && mixOn !== x.label ? ' dim' : ''}`}
                onPointerEnter={() => setMixOn(x.label)}
              >
                <div className="legend-row">
                  <span className="swatch" style={{ background: x.color }} />
                  <span>{x.label}</span>
                  <span className="pct">{x.pct}%</span>
                </div>
                <div className="legend-note">{x.note}</div>
              </div>
            ))}
          </div>
          <SourceLine sources={P ? ['PAFR_PENSION', 'IPS_T1'] : ['PAFR_OPEB', 'IPS_OPEB_T1']} />
        </Panel>
      </div>

      <div className="grid-panels mt">
        <Panel
          id="ov-returns"
          kicker="Net of investment-management fees"
          title="Fund vs policy benchmark"
          note={d.retNote}
          method={
            <p>
              Time-weighted returns (TWR), net of investment-management fees, annualized for periods
              over one year, as published. Excess = fund − benchmark, calculated from the quoted
              figures. The ACFR separately reports money-weighted returns (MWR); the two are not
              comparable. Private-market benchmarks are lagged 1–3 months (IPS Table 2).
            </p>
          }
        >
          <div
            className="table-scroll"
            role="region"
            aria-label="Fund vs policy benchmark by horizon"
            tabIndex={0}
          >
            <table className="table">
              <caption>Fund vs policy benchmark by horizon</caption>
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
                </tr>
              </thead>
              <tbody>
                {HORIZONS.map((h, i) => {
                  const t = excessTag(d.ret.f[i]!, d.ret.b[i]!);
                  return (
                    <tr key={h}>
                      <td>{h}</td>
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
          <SourceLine sources={P ? ['PAFR_PENSION'] : ['PAFR_OPEB']} />
        </Panel>

        <Panel
          id="ov-flows"
          kicker="Changes in fiduciary net position — FY2025"
          title="Where the year's change came from"
          note={
            <>
              Three-year detail on the <Link to="/performance">Performance</Link> view.
            </>
          }
        >
          <div>
            {d.flows.map(([label, v, bold]) => (
              <div className="flow-row" key={label}>
                <span style={{ fontWeight: bold ? 600 : 400 }}>{label}</span>
                <span className="v">{v}</span>
              </div>
            ))}
          </div>
          <SourceLine sources={['PAFR_CHANGES']} />
        </Panel>
      </div>
    </PageMeta>
  );
}
