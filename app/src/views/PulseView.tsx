import { Link } from 'react-router-dom';

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

  return (
    <>
      <Panel
        className="monthly-strip"
        kicker={`Latest monthly report — ${CIO_LATEST.reportLabel}`}
        title={`Where the ${m.short} stands, data through ${longDate(CIO_LATEST.dataThrough)}`}
        sub="A different reporting vintage from the fiscal-year figures below: this is the investment portfolio's market value and monthly performance, not the fiduciary net position at the fiscal year end"
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
              Policy benchmark {mPct(m.total.b[oneMonth])} · {mSigned(mExcess(oneMonth))} pp excess
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
            <div className="l">Widest allocation gap</div>
            <div className="v">{mSigned(widestGap.pct - widestGap.tgt)} pp</div>
            <div className="s">
              {widestGap.short} {mPct(widestGap.pct)} against a {mPct(widestGap.tgt)} target
            </div>
          </div>
        </div>
        <p className="panel-note">
          <Link to="/cio">Open the CIO Monthly view</Link> for the two-minute read, what changed
          since the prior report, and sixteen months of history. Excess and the allocation gap are
          calculated from the printed figures.
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
      <div className="kpi-provenance">
        <ClassBadge c="reported_public" />
        <span>
          Headline figures as printed in the 2025 PAFR
          {P ? '; the funded ratio is the June 30, 2024 actuarial valuation (Milliman)' : ''}.
        </span>
        <SourceLine sources={P ? ['PAFR_PENSION'] : ['PAFR_OPEB', 'PAFR_OPEB_ENROLL']} />
      </div>

      <div className="grid-panels mt">
        <Panel
          kicker={`Growth of the ${d.label}`}
          title="Fiduciary net position, FY2016–FY2025"
          sub={`${d.growthUnit} · net of fees and expenses`}
        >
          <div className="bar-chart" style={{ marginTop: 16 }}>
            {d.growth.map((v, i) => (
              <div className="bar-col" key={GROWTH_YEARS[i]}>
                <div className={`bar-val${i === 9 ? ' hi' : ''}`}>{v.toFixed(1)}</div>
                <div
                  className={`bar${i === 9 ? ' hi' : ''}`}
                  style={{ height: `${((v / gMax) * 100).toFixed(1)}%` }}
                />
              </div>
            ))}
          </div>
          <div className="bar-x">
            {GROWTH_YEARS.map((y) => (
              <span key={y}>’{y.slice(2)}</span>
            ))}
          </div>
          <p className="panel-note">{d.growthNote}</p>
          <SourceLine sources={['PAFR_GROWTH']} />
        </Panel>

        <Panel kicker={d.allocKicker} title="Asset allocation">
          <div className="alloc-strip" style={{ marginTop: 4 }}>
            {d.mix.map((m) => (
              <div
                key={m.label}
                style={{ width: `${((m.pct / mixTotal) * 100).toFixed(2)}%`, background: m.color }}
              />
            ))}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9, marginTop: 16 }}>
            {d.mix.map((m) => (
              <div key={m.label}>
                <div className="legend-row">
                  <span className="swatch" style={{ background: m.color }} />
                  <span>{m.label}</span>
                  <span className="pct">{m.pct}%</span>
                </div>
                <div className="legend-note">{m.note}</div>
              </div>
            ))}
          </div>
          <p className="panel-note">{d.allocFoot}</p>
          <SourceLine sources={P ? ['PAFR_PENSION', 'IPS_T1'] : ['PAFR_OPEB', 'IPS_OPEB_T1']} />
        </Panel>
      </div>

      <div className="grid-panels mt">
        <Panel
          kicker="Time-weighted returns (TWR) — net of investment-management fees"
          title="Fund vs policy benchmark"
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
          <p className="panel-note">
            {d.retNote} Excess = fund − benchmark (calculated from quoted figures).
          </p>
          <p className="footnote">
            Time-weighted returns (TWR), net of investment-management fees, annualized for periods
            over one year, as published. The ACFR separately reports money-weighted returns (MWR);
            the two are not comparable. Private-market benchmarks are lagged 1–3 months (IPS Table
            2).
          </p>
        </Panel>

        <Panel
          kicker="Changes in fiduciary net position — FY2025"
          title="Where the year's change came from"
        >
          <div>
            {d.flows.map(([label, v, bold]) => (
              <div className="flow-row" key={label}>
                <span style={{ fontWeight: bold ? 600 : 400 }}>{label}</span>
                <span className="v">{v}</span>
              </div>
            ))}
          </div>
          <p className="panel-note">
            Three-year detail on the <Link to="/performance">Performance</Link> view.
          </p>
          <SourceLine sources={['PAFR_CHANGES']} />
        </Panel>
      </div>
    </>
  );
}
