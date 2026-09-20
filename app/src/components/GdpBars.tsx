import { gdpCaption, gdpFor, quarterLabel } from '../lib/cioGdp';

/** The report's Quarterly Real GDP Growth chart.
 *
 *  The figures are the report's own, rebuilt from FRED's real-time archive rather than typed. The
 *  vintage is the part worth showing: this chart is not redrawn every month, so seven of the
 *  sixteen reports print it older than the rest of their macro page — four consecutive reports in
 *  late 2025 all carry FRED as it stood on July 31, 2025. Where that is so the caption says how far
 *  behind it is, because a reader comparing two reports would otherwise read a revision as a change
 *  in the economy. */
export function GdpBars({ reportDate }: { reportDate: string }) {
  const g = gdpFor(reportDate);
  if (!g || !g.quarters.length) return null;
  const cap = gdpCaption(g);

  const H = 132;
  // the value labels live inside the plot, so the bars are scaled into the band between them:
  // without this the label under the negative quarter lands on the axis row beneath it
  const PAD = 15;
  const plot = H - PAD * 2;
  const vs = g.quarters.map((q) => q.v);
  const hi = Math.max(0, ...vs);
  const lo = Math.min(0, ...vs);
  const span = hi - lo || 1;
  const zero = PAD + (hi / span) * plot;
  const w = 100 / g.quarters.length;

  const alt =
    `Real GDP growth, quarterly at an annual rate, ${cap.range.replace(/^[^—]+— /, '')}: ` +
    g.quarters.map((q) => `${quarterLabel(q.q)} ${q.v.toFixed(1)}%`).join(', ') +
    `. ${cap.asOf}.`;

  return (
    <figure className="gdpf">
      <div className="gdpf-plot" style={{ height: `${H}px` }} role="img" aria-label={alt}>
        <div className="gdpf-zero" style={{ top: `${zero}px` }} />
        {g.quarters.map((q, i) => {
          const h = Math.max((Math.abs(q.v) / span) * plot, 1);
          const up = q.v >= 0;
          const last = i === g.quarters.length - 1;
          return (
            <div
              className="gdpf-col"
              key={q.q}
              style={{ left: `${i * w}%`, width: `${w}%` }}
              title={`${quarterLabel(q.q)}: ${q.v.toFixed(1)}%`}
            >
              <div
                className={`gdpf-bar${up ? '' : ' neg'}${last ? ' last' : ''}`}
                style={{ top: `${up ? zero - h : zero}px`, height: `${h}px` }}
              />
              <div
                className="gdpf-v"
                style={up ? { bottom: `${H - zero + h + 2}px` } : { top: `${zero + h + 2}px` }}
              >
                {q.v.toFixed(1)}
              </div>
            </div>
          );
        })}
      </div>
      <div className="gdpf-axis">
        {g.quarters.map((q, i) => (
          <span key={q.q} style={{ left: `${i * w}%`, width: `${w}%` }}>
            {i % 2 === 0 || i === g.quarters.length - 1 ? quarterLabel(q.q) : ''}
          </span>
        ))}
      </div>
      <figcaption>
        {cap.range}, percent. {cap.asOf}.
        {cap.stale ? <span className="gdpf-stale"> {cap.stale}</span> : null}
      </figcaption>
    </figure>
  );
}
