import { longDate, type CioVintage } from '../fixtures/cioMonthly';
import { freshnessFor, freshnessSpan, offsetLabel, type FreshnessRow } from '../lib/freshness';

import { ClassBadge } from './ui';

/** When each figure on this tab was true.
 *
 *  One report is not one date. The reader's working assumption is that everything on screen shares
 *  the month the fund figures cover; on this tab it does not. Two figures are AHEAD of that month
 *  and several are behind it, for reasons the report gives in footnotes nobody reads. The rows are
 *  ordered newest first, so the ones ahead of the anchor — the subtler mistake — come first. */
export function FreshnessMatrix({ vintage }: { vintage: CioVintage }) {
  const f = freshnessFor(vintage);
  const span = freshnessSpan(f);
  const rows = f.rows.slice().sort((a, b) => {
    if (a.months === null) return 1;
    if (b.months === null) return -1;
    return b.months - a.months;
  });

  return (
    <>
      <p className="fresh-lead">
        The fund figures cover <b>{longDate(f.anchor)}</b>. Everything below is placed against that
        month
        {span && span.months !== 0 ? (
          <>
            ; the tab as a whole spans <b>{longDate(span.from)}</b> to <b>{longDate(span.to)}</b>
          </>
        ) : null}
        .
      </p>
      <div
        className="table-scroll"
        role="region"
        aria-label="When each figure was true"
        tabIndex={0}
      >
        <table className="table fresh">
          <caption>
            Every dated figure on this tab, newest first, against the month the fund figures cover
          </caption>
          <thead>
            <tr>
              <th scope="col">Figure</th>
              <th scope="col">As of</th>
              <th scope="col">Against the fund month</th>
              <th scope="col">Cadence</th>
              <th scope="col">Source</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <Row key={r.key} r={r} />
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function Row({ r }: { r: FreshnessRow }) {
  return (
    <tr className={`fresh-${r.direction}`}>
      <td>
        {r.what}
        {r.why ? <div className="footnote">{r.why}</div> : null}
      </td>
      <td className="fresh-as">
        {r.asOf ? longDate(r.asOf) : <span className="fresh-undated">{r.asOfNote}</span>}
        {r.cls === 'stale' || r.cls === 'missing' ? (
          <>
            {' '}
            <ClassBadge c={r.cls} always />
          </>
        ) : null}
      </td>
      <td className="fresh-off">
        <span className="fresh-mark" aria-hidden="true" />
        {offsetLabel(r.months)}
      </td>
      <td className="fresh-cad">{r.cadence}</td>
      <td className="fresh-src">{r.source}</td>
    </tr>
  );
}
