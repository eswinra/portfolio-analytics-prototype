import { Panel, SourceLine, Tag, type TagVariant } from '../components/ui';
import { CONFIG } from '../config';
import { publishedFor, type Major } from '../fixtures/published';
import { useEntity } from '../lib/entity';

/** Allocation — full-width policy-range bullets (band = IPS range, solid tick = long-term
 *  target, dashed tick = ½-step, diamond = published actual) plus IPS Tables 1 and 2. */

interface BulletGeom {
  name: string;
  detail: string;
  bandLeft: string;
  bandW: string;
  tLeft: string;
  hLeft: string;
  aLeft: string;
  hasActual: boolean;
  actualLbl: string;
  minL: string;
  maxL: string;
  status: string;
  variant: TagVariant;
  dist: string;
}

function bulletGeom([name, t, r, half, act]: Major, nearBoundPp: number): BulletGeom {
  const lo = t - r;
  const hi = t + r;
  const pad = (hi - lo) * 0.2;
  const lo2 = lo - pad;
  const hi2 = hi + pad;
  const pc = (v: number) => `${(((v - lo2) / (hi2 - lo2)) * 100).toFixed(2)}%`;
  const hasActual = act !== null;
  let status = 'Targets shown';
  let variant: TagVariant = 'neutral';
  let dist = 'actual mix not reproduced — see PAFR p. 7';
  if (hasActual) {
    const dLo = act - lo;
    const dHi = hi - act;
    const dm = Math.min(dLo, dHi);
    const side = dHi <= dLo ? 'upper' : 'lower';
    if (dm < 0) {
      status = 'Out of range';
      variant = 'outline';
      dist = `${Math.abs(dm).toFixed(1)} pp outside the band`;
    } else if (dm <= nearBoundPp) {
      status = 'Near bound';
      variant = 'outline';
      dist = `${dm.toFixed(1)} pp to ${side} boundary`;
    } else {
      status = 'Within range';
      variant = 'accent';
      dist = `${dm.toFixed(1)} pp to ${side} boundary`;
    }
  }
  return {
    name,
    detail: hasActual
      ? `actual ${act.toFixed(1)}% · target ${t.toFixed(1)}% · ½-step ${half}%`
      : `target ${t.toFixed(1)}% · ½-step ${half}%`,
    bandLeft: pc(lo),
    bandW: `${(((hi - lo) / (hi2 - lo2)) * 100).toFixed(2)}%`,
    tLeft: pc(t),
    hLeft: pc(half),
    aLeft: hasActual ? pc(act) : '0%',
    hasActual,
    actualLbl: hasActual ? `${act.toFixed(1)}%` : '',
    minL: `${lo}%`,
    maxL: `${hi}%`,
    status,
    variant,
    dist,
  };
}

export function AllocationView() {
  const { entity } = useEntity();
  const d = publishedFor(entity);
  const P = entity === 'PENSION';
  const bullets = d.majors.map((m) => bulletGeom(m, CONFIG.nearBoundPp));

  return (
    <>
      <Panel
        kicker="Strategic asset allocation — functional categories"
        title={`Policy target and range${P ? ' vs actual mix' : 's — OPEB Master Trust'}`}
        sub="Band = IPS range · solid tick = long-term target · dashed tick = ½-step target (7/1/2024) · each track is scaled around its own band"
      >
        <div>
          {bullets.map((b) => (
            <div className="bullet-row" key={b.name}>
              <div className="bullet-head">
                <div className="name">{b.name}</div>
                <div className="detail">{b.detail}</div>
              </div>
              <div className="bullet-track">
                <div className="rail" />
                <div className="band-range" style={{ left: b.bandLeft, width: b.bandW }} />
                <div className="tick-target" style={{ left: b.tLeft }} />
                <div className="tick-half" style={{ left: b.hLeft }} />
                {b.hasActual ? (
                  <>
                    <div className="diamond" style={{ left: b.aLeft }} />
                    <span className="actual-lbl" style={{ left: b.aLeft }}>
                      {b.actualLbl}
                    </span>
                  </>
                ) : null}
                <span className="min-lbl">{b.minL}</span>
                <span className="max-lbl">{b.maxL}</span>
              </div>
              <div className="bullet-status">
                <Tag variant={b.variant}>{b.status}</Tag>
                <span className="dist">{b.dist}</span>
              </div>
            </div>
          ))}
        </div>
        <div className="chart-legend" style={{ marginTop: 14 }}>
          <span className="key">
            <span
              className="sw"
              style={{
                width: 14,
                background: 'var(--accent-600)',
                border: '1px solid var(--accent-800)',
              }}
            />
            IPS range
          </span>
          <span className="key">
            <span
              className="sw"
              style={{
                width: 14,
                height: 12,
                background: 'var(--accent-600)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <span style={{ width: 2, height: 12, background: '#fff', display: 'inline-block' }} />
            </span>
            Long-term target
          </span>
          <span className="key">
            <span
              className="sw"
              style={{
                width: 14,
                height: 12,
                background: 'var(--accent-600)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <span style={{ width: 0, height: 12, borderLeft: '2px dashed var(--accent-200)' }} />
            </span>
            ½-step target
          </span>
          {P ? (
            <span className="key">
              <span
                className="sw"
                style={{
                  width: 9,
                  height: 9,
                  background: 'var(--accent-200)',
                  border: '1px solid var(--accent-900)',
                  transform: 'rotate(45deg)',
                }}
              />
              Actual (6/30/2025)
            </span>
          ) : null}
        </div>
        <p className="panel-note">{d.allocViewNote}</p>
        <SourceLine>IPS Table 1, restated June 12, 2024 · actual mix per 2025 PAFR</SourceLine>
      </Panel>

      <Panel
        className="mt"
        kicker="Approved asset allocation and benchmarks"
        title={`IPS Tables 1 and 2 — ${d.label}`}
      >
        <div className="table-scroll">
          <table className="table">
            <caption>IPS Tables 1 and 2: targets, ranges, ½-step targets, benchmarks</caption>
            <thead>
              <tr>
                <th scope="col">Asset class</th>
                <th scope="col" className="num">
                  Target %
                </th>
                <th scope="col" className="num">
                  Range ±
                </th>
                <th scope="col" className="num">
                  ½-step target
                </th>
                <th scope="col">Benchmark</th>
              </tr>
            </thead>
            <tbody>
              {d.pol.map(([name, t, r, half, bench, level]) => (
                <tr
                  key={name}
                  style={{ background: level === 2 ? 'var(--accent-200)' : 'transparent' }}
                >
                  <td
                    style={{
                      fontWeight: level === 1 ? 400 : 600,
                      paddingLeft: level === 1 ? 26 : undefined,
                    }}
                  >
                    {name}
                  </td>
                  <td className="num" style={{ fontWeight: level === 1 ? 400 : 600 }}>
                    {t}
                  </td>
                  <td className="num">{r}</td>
                  <td className="num">{half}</td>
                  <td style={{ fontSize: 12, color: 'var(--muted-86)' }}>{bench}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="panel-note">
          Private-market benchmarks are lagged one to three months per IPS Table 2. Confirm the
          governing policy version (long-term vs ½-step) before any compliance statement.
        </p>
      </Panel>
    </>
  );
}
