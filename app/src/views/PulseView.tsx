import { Link } from 'react-router-dom';

import { excessTag, Panel, SourceLine, Tag } from '../components/ui';
import { GROWTH_YEARS, HORIZONS, publishedFor } from '../fixtures/published';
import { useEntity } from '../lib/entity';

/** Overview — KPI row, decade growth bars, allocation strip, returns vs benchmark, and the
 *  FY2025 flows list. All figures quoted from the 2025 PAFR / ACFR / IPS. */

export function PulseView() {
  const { entity } = useEntity();
  const d = publishedFor(entity);
  const P = entity === 'PENSION';

  const gMax = Math.max(...d.growth);
  const mixTotal = d.mix.reduce((s, m) => s + m.pct, 0);

  return (
    <>
      <div className="grid-kpi">
        {d.kpis.map(([kicker, value, sub]) => (
          <Panel key={kicker} tight kicker={kicker}>
            <div className="stat-value">{value}</div>
            <div className="stat-sub">{sub}</div>
          </Panel>
        ))}
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
          <SourceLine>2025 PAFR, pp. 4–7</SourceLine>
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
          <SourceLine>2025 PAFR p. {P ? 5 : 7} · IPS Table 1 (restated June 12, 2024)</SourceLine>
        </Panel>
      </div>

      <div className="grid-panels mt">
        <Panel kicker="Annualized total returns — net of fees" title="Fund vs policy benchmark">
          <div className="table-scroll">
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
          <p className="panel-note">{d.retNote}</p>
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
        </Panel>
      </div>
    </>
  );
}
