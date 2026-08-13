import { excessTag, money, Panel, SourceLine, Tag } from '../components/ui';
import { HORIZONS, publishedFor } from '../fixtures/published';
import { useEntity } from '../lib/entity';

/** Performance — annualized returns vs the policy benchmark, three years of changes in
 *  fiduciary net position, and cumulative investment income since FY2016. Quoted figures. */

export function PerformanceView() {
  const { entity } = useEntity();
  const d = publishedFor(entity);
  const P = entity === 'PENSION';

  const rMax = Math.max(...d.ret.f, ...d.ret.b);

  // cumulative income area chart — geometry ported from the design source
  const cMin = Math.min(0, ...d.cum);
  const cMax = Math.max(...d.cum);
  const pts = d.cum.map((v, i) => {
    const x = (i / (d.cum.length - 1)) * 600;
    const y = 172 - ((v - cMin) / (cMax - cMin)) * 158;
    return `${x.toFixed(1)} ${y.toFixed(1)}`;
  });
  const cumLine = `M ${pts.join(' L ')}`;
  const cumArea = `${cumLine} L 600 179 L 0 179 Z`;
  const cRange = cMax - cMin;
  let cStep = Math.pow(10, Math.floor(Math.log10(cRange)));
  if (cRange / cStep < 3) cStep = cStep / 2;
  const cumGrid: { top: number; label: string }[] = [];
  for (let v = Math.ceil(cMin / cStep) * cStep; v < cMax - cStep * 0.15; v += cStep) {
    if (v <= cMin) continue;
    cumGrid.push({ top: 172 - ((v - cMin) / cRange) * 158, label: v.toLocaleString('en-US') });
  }

  return (
    <>
      <div className="grid-panels">
        <Panel kicker="Annualized total returns — net of fees" title="Periods ended June 30, 2025">
          <div className="table-scroll">
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
            {d.retNote} Returns exceeded the actuarial assumed rate of return at every horizon
            (PAFR).
          </p>
          <SourceLine>2025 PAFR, p. {P ? '5 (Pension)' : '7 (OPEB)'}</SourceLine>
        </Panel>

        <Panel kicker="Fund vs benchmark by horizon" title="Percent, annualized">
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-end',
              gap: 22,
              height: 180,
              borderBottom: '1px solid var(--divider)',
              marginTop: 16,
            }}
          >
            {HORIZONS.map((h, i) => (
              <div
                key={h}
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'flex-end',
                  justifyContent: 'center',
                  gap: 6,
                  height: '100%',
                }}
              >
                <div className="bar-col" style={{ flex: 'none', width: 26 }}>
                  <div className="bar-val" style={{ fontSize: 11, color: 'var(--accent-800)' }}>
                    {d.ret.f[i]!.toFixed(1)}
                  </div>
                  <div
                    style={{
                      height: `${((d.ret.f[i]! / rMax) * 100).toFixed(1)}%`,
                      background: 'var(--accent-600)',
                      border: '1px solid var(--accent-800)',
                      borderBottom: 'none',
                    }}
                  />
                </div>
                <div className="bar-col" style={{ flex: 'none', width: 26 }}>
                  <div className="bar-val" style={{ fontSize: 11, fontWeight: 400 }}>
                    {d.ret.b[i]!.toFixed(1)}
                  </div>
                  <div
                    style={{
                      height: `${((d.ret.b[i]! / rMax) * 100).toFixed(1)}%`,
                      background: 'var(--accent-200)',
                      border: '1px solid var(--accent-500)',
                      borderBottom: 'none',
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 22, marginTop: 6 }}>
            {HORIZONS.map((h) => (
              <div
                key={h}
                style={{ flex: 1, textAlign: 'center', fontSize: 11, color: 'var(--muted-68)' }}
              >
                {h}
              </div>
            ))}
          </div>
          <div className="chart-legend">
            <span className="key">
              <span
                className="sw"
                style={{ background: 'var(--accent-600)', border: '1px solid var(--accent-800)' }}
              />
              Fund
            </span>
            <span className="key">
              <span
                className="sw"
                style={{ background: 'var(--accent-200)', border: '1px solid var(--accent-500)' }}
              />
              Policy benchmark
            </span>
          </div>
        </Panel>
      </div>

      <div className="grid-panels mt">
        <Panel
          kicker="Changes in fiduciary net position"
          title="Fiscal years ended June 30 · $ millions"
        >
          <div className="table-scroll">
            <table className="table">
              <caption>Changes in fiduciary net position, three fiscal years</caption>
              <thead>
                <tr>
                  <th scope="col"></th>
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
          <SourceLine>2025 PAFR, p. {P ? '4 (Pension)' : '7 (OPEB)'}</SourceLine>
        </Panel>

        <Panel
          kicker="Net investment activities"
          title="Cumulative investment income, FY2016–FY2025"
          sub={`${d.cumUnit} · 10-year cumulative results`}
        >
          <div style={{ position: 'relative', marginTop: 14 }}>
            <svg
              viewBox="0 0 600 180"
              preserveAspectRatio="none"
              style={{ width: '100%', height: 180, display: 'block' }}
              role="img"
              aria-label={`Cumulative investment income rising to ${d.cumEnd} by FY2025`}
            >
              <path d={cumArea} fill="var(--accent-200)" />
              <path
                d={cumLine}
                fill="none"
                stroke="var(--accent-700)"
                strokeWidth={2}
                vectorEffect="non-scaling-stroke"
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
            </svg>
            <div
              style={{
                position: 'absolute',
                top: 6,
                right: 8,
                fontWeight: 600,
                fontSize: 22,
                color: 'var(--accent-800)',
              }}
            >
              {d.cumEnd}
            </div>
            {cumGrid.map((g) => (
              <div key={g.label}>
                <div
                  style={{
                    position: 'absolute',
                    left: 0,
                    right: 0,
                    top: g.top,
                    height: 1,
                    background: 'var(--divider)',
                  }}
                />
                <span
                  style={{
                    position: 'absolute',
                    left: 4,
                    top: g.top - 15,
                    fontSize: 10,
                    color: 'var(--muted-65)',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {g.label}
                </span>
              </div>
            ))}
          </div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: 11,
              color: 'var(--muted-68)',
              marginTop: 5,
            }}
          >
            <span>FY2016</span>
            <span>FY2025</span>
          </div>
          <p className="panel-note">{d.cumNote}</p>
        </Panel>
      </div>
    </>
  );
}
