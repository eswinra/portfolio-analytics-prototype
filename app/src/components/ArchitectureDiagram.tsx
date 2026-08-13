/**
 * PA workflow architecture (v2, contract-aligned) as a NATIVE inline SVG — recreated from the
 * team's workflow-tree diagram so it scales without raster blur and its vocabulary matches the
 * code exactly (record_type tokens, review_status states, V-rule numbers). No external asset,
 * no network request, no real names or internal URLs.
 */

const INK = '#1c2733';
const SOFT = '#5d6b76';
const STEEL = '#3a6ea5';
const AMBER = '#c78f2e';
const RUST = '#b4562a';
const NAVY = '#14324f';
const BOX = '#ffffff';
const BAND = '#eef2f6';
const LINE = '#c9d2da';
const GREEN = '#2e7d5b';

const STAGES: { title: string; accent: string; lines: string[] }[] = [
  {
    title: '1 INTAKE',
    accent: GREEN,
    lines: ['Watch email, portals,', 'SharePoint feeds', 'One entity per file (V17)'],
  },
  {
    title: '2 STRUCTURE',
    accent: AMBER,
    lines: ['Classify + name docs', 'Tag metadata + period', 'Stamp entered_by (V19)'],
  },
  {
    title: '3 EXTRACT',
    accent: NAVY,
    lines: ['Read PDF / Excel', 'Returns as decimals (V10)', 'Keep page + cell evidence'],
  },
  {
    title: '4 RECONCILE',
    accent: RUST,
    lines: ['recon_value pairs (V23)', 'Variance computed,', 'never imported'],
  },
  {
    title: '5 DELIVER',
    accent: GREEN,
    lines: ['Emit ONE validated CSV', 'draft → reviewed → published', 'Analyst approves'],
  },
];

const SINKS: { title: string; sub: string; accent: string }[] = [
  { title: 'Workbook of record', sub: 'authoring + controls', accent: NAVY },
  { title: 'Allocation / Performance', sub: 'bands · QTD / FYTD / ITD', accent: STEEL },
  { title: 'Reconciliation', sub: 'tolerance_definition = data', accent: AMBER },
  { title: 'Exceptions', sub: 'tiers + aging, in-file', accent: RUST },
  { title: 'ACFR board', sub: 'acfr_section_status history', accent: GREEN },
];

const GOV: string[] = [
  'Source-of-truth matrix',
  'draft → reviewed → published gate (V20/V21)',
  'Exception log + tolerance-as-data',
  'Provenance: entered_by / reviewed_by',
  'Synthetic-vs-real data wall',
  'Feedback → rule + template tuning',
];

const W = 1160;
const STAGE_W = 216;
const STAGE_GAP = 20;
const STAGE_X0 = 8;

export function ArchitectureDiagram() {
  return (
    <div className="table-scroll">
      <svg
        viewBox="0 0 1160 560"
        role="img"
        aria-label="Pipeline: intake, structure, extract, reconcile, deliver — one validated CSV feeding the workbook of record and five dashboard tabs, governed by a human-in-the-loop control spine with a feedback loop."
        style={{ minWidth: 900, width: '100%', height: 'auto', display: 'block' }}
      >
        <style>{`text { font-family: inherit; fill: ${INK}; } .t-title { font-size: 13px; font-weight: 700; } .t-line { font-size: 11px; fill: ${SOFT}; } .t-band { font-size: 13px; font-weight: 700; fill: #fff; } .t-cap { font-size: 11px; fill: ${SOFT}; } .t-chip { font-size: 9px; font-weight: 700; }`}</style>

        {/* engine */}
        <rect x={430} y={8} width={300} height={34} rx={17} fill={NAVY} />
        <text x={580} y={30} textAnchor="middle" className="t-band">
          AI PROCESS AUTOMATION ENGINE
        </text>
        <rect x={508} y={0} width={148} height={0} fill="none" />
        <text x={580} y={58} textAnchor="middle" className="t-cap">
          governed agent: retrieval · extraction · drafting — never final; the analyst approves
        </text>
        <rect x={470} y={8} width={64} height={16} rx={8} fill={AMBER} />
        <text x={502} y={19} textAnchor="middle" className="t-chip" fill="#fff">
          TARGET
        </text>
        <line
          x1={580}
          y1={64}
          x2={580}
          y2={80}
          stroke={SOFT}
          strokeWidth={1.4}
          markerEnd="url(#arr)"
        />

        <defs>
          <marker
            id="arr"
            viewBox="0 0 8 8"
            refX={7}
            refY={4}
            markerWidth={7}
            markerHeight={7}
            orient="auto"
          >
            <path d="M0 0 L8 4 L0 8 z" fill={SOFT} />
          </marker>
          <marker
            id="arrg"
            viewBox="0 0 8 8"
            refX={7}
            refY={4}
            markerWidth={7}
            markerHeight={7}
            orient="auto"
          >
            <path d="M0 0 L8 4 L0 8 z" fill={GREEN} />
          </marker>
        </defs>

        {/* stages */}
        {STAGES.map((s, i) => {
          const x = STAGE_X0 + i * (STAGE_W + STAGE_GAP);
          return (
            <g key={s.title}>
              <rect x={x} y={86} width={STAGE_W} height={92} rx={6} fill={BOX} stroke={LINE} />
              <rect x={x} y={86} width={5} height={92} rx={2} fill={s.accent} />
              <text x={x + 16} y={108} className="t-title">
                {s.title}
              </text>
              {s.lines.map((l, k) => (
                <text key={k} x={x + 16} y={128 + k * 16} className="t-line">
                  {l}
                </text>
              ))}
              {i < STAGES.length - 1 ? (
                <line
                  x1={x + STAGE_W}
                  y1={132}
                  x2={x + STAGE_W + STAGE_GAP - 2}
                  y2={132}
                  stroke={SOFT}
                  strokeWidth={1.6}
                  markerEnd="url(#arr)"
                />
              ) : null}
              {(i === 0 || i === 1 || i === 2) && (
                <>
                  <rect x={x + STAGE_W - 58} y={92} width={50} height={15} rx={7} fill={AMBER} />
                  <text
                    x={x + STAGE_W - 33}
                    y={103}
                    textAnchor="middle"
                    className="t-chip"
                    fill="#fff"
                  >
                    TARGET
                  </text>
                </>
              )}
              {(i === 3 || i === 4) && (
                <>
                  <rect x={x + STAGE_W - 50} y={92} width={42} height={15} rx={7} fill={GREEN} />
                  <text
                    x={x + STAGE_W - 29}
                    y={103}
                    textAnchor="middle"
                    className="t-chip"
                    fill="#fff"
                  >
                    LIVE
                  </text>
                </>
              )}
              <line
                x1={x + STAGE_W / 2}
                y1={178}
                x2={x + STAGE_W / 2}
                y2={208}
                stroke={SOFT}
                strokeWidth={1.2}
                markerEnd="url(#arr)"
              />
            </g>
          );
        })}

        {/* contract band */}
        <rect x={8} y={212} width={W - 16} height={36} rx={8} fill={NAVY} />
        <text x={W / 2} y={235} textAnchor="middle" className="t-band">
          ONE VALIDATED CSV CONTRACT — schema 1.x · record_type routes every row · V01–V23 · no side
          channels
        </text>

        {/* sinks */}
        {SINKS.map((s, i) => {
          const x = STAGE_X0 + i * (STAGE_W + STAGE_GAP);
          return (
            <g key={s.title}>
              <line
                x1={x + STAGE_W / 2}
                y1={248}
                x2={x + STAGE_W / 2}
                y2={272}
                stroke={SOFT}
                strokeWidth={1.2}
                markerEnd="url(#arr)"
              />
              <rect x={x} y={276} width={STAGE_W} height={64} rx={6} fill={BOX} stroke={LINE} />
              <rect x={x} y={276} width={5} height={64} rx={2} fill={s.accent} />
              <text x={x + 16} y={298} className="t-title" style={{ fontSize: 12 }}>
                {s.title}
              </text>
              <text x={x + 16} y={316} className="t-line">
                {s.sub}
              </text>
              <rect x={x + STAGE_W - 50} y={282} width={42} height={15} rx={7} fill={GREEN} />
              <text x={x + STAGE_W - 29} y={293} textAnchor="middle" className="t-chip" fill="#fff">
                LIVE
              </text>
            </g>
          );
        })}
        <text x={STAGE_X0} y={266} className="t-cap">
          Consumption layer — the only intended data sinks
        </text>

        {/* feedback loop */}
        <path
          d={`M ${STAGE_X0 + 4 * (STAGE_W + STAGE_GAP) + STAGE_W} 320 L ${W - 6} 320 L ${W - 6} 356 L ${STAGE_X0 + 40} 356 L ${STAGE_X0 + 40} 186`}
          fill="none"
          stroke={GREEN}
          strokeWidth={1.4}
          strokeDasharray="5 4"
          markerEnd="url(#arrg)"
        />
        <text x={W - 12} y={350} textAnchor="end" className="t-cap" fill={GREEN}>
          feedback loop: corrections improve rules &amp; extraction
        </text>

        {/* governance band */}
        <rect x={8} y={372} width={W - 16} height={128} rx={8} fill={BAND} stroke={GREEN} />
        <text x={24} y={396} className="t-title" style={{ fontSize: 12.5 }}>
          Governance &amp; human-in-the-loop control — applies across every branch
        </text>
        {GOV.map((g, i) => {
          const col = i % 3;
          const row = Math.floor(i / 3);
          const x = 24 + col * 376;
          const y = 410 + row * 42;
          return (
            <g key={g}>
              <rect x={x} y={y} width={358} height={32} rx={5} fill={BOX} stroke={LINE} />
              <rect x={x} y={y} width={4} height={32} rx={2} fill={STEEL} />
              <text x={x + 14} y={y + 20} className="t-line" style={{ fill: INK }}>
                {g}
              </text>
            </g>
          );
        })}

        {/* legend */}
        <text x={8} y={536} className="t-cap">
          Solid = automated flow · dashed = feedback · LIVE = built in this prototype · TARGET = the
          AI intake/structure/extract engine and identity-enforced approvals (internal, authorized
          version)
        </text>
        <text x={8} y={552} className="t-cap">
          Public dashboard = synthetic or cited-public data only; real data stays internal and local
          (browser-only import).
        </text>
      </svg>
    </div>
  );
}
