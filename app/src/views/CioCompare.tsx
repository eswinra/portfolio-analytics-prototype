import { useMemo } from 'react';

import { Fig } from '../components/Provenance';
import { ClassBadge, Panel, SourceLine } from '../components/ui';
import { CIO_VINTAGES, longDate, monthYear, type CioVintage } from '../fixtures/cioMonthly';
import type { EntityId } from '../fixtures/published';
import {
  allLines,
  compareReports,
  defaultPartner,
  type CompareLine,
  type Comparison,
} from '../lib/compare';
import { entityPages } from '../lib/cioSource';
import { compareFigId, figId, type FundKey } from '../lib/provenance';
import { useUrlParam } from '../lib/urlState';

/** Two reports side by side.
 *
 *  The report on screen is one side; the reader picks the other, which defaults to the same month
 *  a year earlier. Every rule about what is comparable lives in lib/compare.ts — this view formats
 *  what that returns and adds nothing of its own. Columns always run earlier then later, and every
 *  change is later minus earlier, whichever report was on screen first. */
export function CioCompare({
  entity,
  vintage,
  source,
}: {
  entity: EntityId;
  vintage: CioVintage;
  /** what is on screen when it is not a published report */
  source: 'published' | 'template file' | 'workstation dataset';
}) {
  const [vsRaw, setVs] = useUrlParam('vs', '');
  const [onlyRaw, setOnly] = useUrlParam('material', '');
  const only = onlyRaw === '1';
  const key = entity === 'OPEB' ? 'opeb' : 'pension';

  const published = useMemo(() => CIO_VINTAGES.filter((v) => v.origin !== 'file'), []);
  const partner = useMemo(() => {
    const picked = published.find(
      (v) => v.dataThrough === vsRaw && v.dataThrough !== vintage.dataThrough,
    );
    return picked ?? defaultPartner(vintage);
  }, [published, vsRaw, vintage]);

  if (source !== 'published') {
    return (
      <Panel
        id="cio-compare"
        className="mt"
        kicker="Compare two reports"
        title="Published reports only"
      >
        <p className="muted-note">
          A {source} is not part of the published series, so there is nothing honest to set it
          against. Choose a published report from the Report menu to compare two of them.
        </p>
      </Panel>
    );
  }
  if (!partner) {
    return (
      <Panel
        id="cio-compare"
        className="mt"
        kicker="Compare two reports"
        title="Nothing to compare with"
      >
        <p className="muted-note">There is no other published report on the site.</p>
      </Panel>
    );
  }

  const c = compareReports(vintage, partner, key);
  const lines = allLines(c);
  const material = lines.filter((l) => l.material).length;
  const notCompared = lines.filter((l) => !l.comparable).length;
  const cols = { earlier: monthYear(c.earlier.dataThrough), later: monthYear(c.later.dataThrough) };

  return (
    <>
      <Panel
        id="cio-compare"
        className="mt"
        kicker="Compare two reports"
        title={`${monthYear(c.earlier.dataThrough)} against ${monthYear(c.later.dataThrough)}`}
        sub={gapSentence(c)}
        method={
          <>
            <p>
              Columns always run earlier then later, and every change is the later figure minus the
              earlier one — whichever report was on screen first, so the sign of a change never
              depends on the order the two were chosen.
            </p>
            <p>
              Three things would make a side-by-side quietly wrong, and each is handled on the row
              it affects. <b>Period-to-date figures reset</b>: FYTD runs from July and YTD from
              January, so across a reset they measure different things and are not compared.{' '}
              <b>Trailing windows overlap</b>: three-year returns a year apart share 24 of their 36
              months, so the change is how the trailing figure moved, not a year of new performance.{' '}
              <b>A change in market value is not a return</b>: it includes contributions and benefit
              payments.
            </p>
            <p>
              A row is marked when it crosses the same threshold &ldquo;What changed&rdquo; uses on
              the Summary tab: a tenth of a point in the fiscal-year-to-date or one-year return,
              half a point of weight, $0.05 billion of market value, an excess that changes sign, or
              any move in a policy target. Other periods, cash and geography are shown with their
              change but never marked — a marker on nearly every row would tell the reader nothing.
            </p>
          </>
        }
      >
        <div className="cmp-controls">
          <label className="cmp-pick">
            <span>Compare with</span>
            <select
              value={partner.dataThrough}
              onChange={(ev) => setVs(ev.target.value)}
              aria-label="Report to compare with"
            >
              {published
                .filter((v) => v.dataThrough !== vintage.dataThrough)
                .slice()
                .reverse()
                .map((v) => (
                  <option key={v.dataThrough} value={v.dataThrough}>
                    {monthYear(v.dataThrough)} — {v.reportLabel} report
                  </option>
                ))}
            </select>
          </label>
          <label className="cmp-only">
            <input
              type="checkbox"
              checked={only}
              onChange={(ev) => setOnly(ev.target.checked ? '1' : '')}
            />
            <span>Only rows that crossed a threshold ({material})</span>
          </label>
        </div>
        <p className="cmp-lead">
          <b>{material}</b> {material === 1 ? 'row crossed' : 'rows crossed'} a threshold
          {notCompared > 0 ? (
            <>
              ; <b>{notCompared}</b> {notCompared === 1 ? 'row is' : 'rows are'} shown but not
              compared, and say why
            </>
          ) : null}
          .
          <span className="cmp-legend">
            <span className="cmp-mark" aria-hidden="true" />
            marks a row that crossed one
          </span>
        </p>
        <SourceLine records={[entityPages(c.earlier, key).main, entityPages(c.later, key).main]} />
      </Panel>

      <CompareTable
        id="cio-cmp-fund"
        title="The fund"
        lines={c.fund}
        cols={cols}
        only={only}
        fund={key}
        c={c}
      />
      <CompareTable
        id="cio-cmp-returns"
        title="Returns, net of fees"
        lines={c.returns}
        cols={cols}
        only={only}
        rowHead="Period"
        fund={key}
        c={c}
      />
      <CompareTable
        id="cio-cmp-excess"
        title="Excess over the policy benchmark"
        lines={c.excess}
        cols={cols}
        only={only}
        rowHead="Period"
        calculated
        fund={key}
        c={c}
      />
      <CompareTable
        id="cio-cmp-alloc"
        title="Weight in each functional category"
        lines={c.allocation}
        cols={cols}
        only={only}
        rowHead="Category"
        fund={key}
        c={c}
      />
      <CompareTable
        id="cio-cmp-geo"
        title="Geographic exposure"
        lines={c.geography}
        cols={cols}
        only={only}
        fund={key}
        c={c}
      />
    </>
  );
}

function gapSentence(c: Comparison): string {
  const n = c.gapMonths;
  const apart = `${n} ${n === 1 ? 'month' : 'months'} apart`;
  const resets = [
    c.fyReset ? 'different fiscal years, so FYTD is not compared' : null,
    c.yearReset ? 'different calendar years, so YTD is not compared' : null,
  ].filter(Boolean);
  return `Fund figures through ${longDate(c.earlier.dataThrough)} and ${longDate(c.later.dataThrough)} — ${apart}${
    resets.length ? `; ${resets.join('; ')}` : ''
  }.`;
}

function CompareTable({
  id,
  title,
  lines,
  cols,
  only,
  rowHead = '',
  calculated = false,
  fund,
  c,
}: {
  id: string;
  title: string;
  lines: CompareLine[];
  cols: { earlier: string; later: string };
  only: boolean;
  rowHead?: string;
  calculated?: boolean;
  fund: FundKey;
  c: Comparison;
}) {
  const shown = only ? lines.filter((l) => l.material) : lines;
  // each side opens the figure in its own report; the change opens its calculation
  const side = (l: CompareLine, v: CioVintage, value: number | null) => {
    const base = compareFigId(fund, l.key);
    const text = fmt(value, l.unit);
    return base ? <Fig id={figId.at(base, v)}>{text}</Fig> : text;
  };
  return (
    <Panel id={id} className="mt" title={title}>
      {shown.length === 0 ? (
        <p className="muted-note">Nothing in this section crossed a threshold.</p>
      ) : (
        <div className="table-scroll cmp-wrap" role="region" aria-label={title} tabIndex={0}>
          <table className="table cmp">
            <thead>
              <tr>
                <th scope="col">{rowHead}</th>
                <th scope="col" className="num">
                  {cols.earlier}
                </th>
                <th scope="col" className="num">
                  {cols.later}
                </th>
                <th scope="col" className="num">
                  Change {calculated ? <ClassBadge c="calculated" always /> : null}
                </th>
                <th scope="col">Note</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((l) => (
                <tr key={l.key} className={l.material ? 'cmp-mat' : l.comparable ? '' : 'cmp-off'}>
                  <th scope="row">{l.label}</th>
                  <td className="num">{side(l, c.earlier, l.earlier)}</td>
                  <td className="num">{side(l, c.later, l.later)}</td>
                  <td className="num cmp-chg">
                    {l.material ? <span className="cmp-mark" aria-hidden="true" /> : null}
                    <Fig id={figId.chg(fund, l.key, c.earlier, c.later)}>
                      {l.comparable ? fmtChange(l.change, l.unit) : 'not compared'}
                    </Fig>
                    {l.material ? (
                      <span className="visually-hidden"> (crossed a threshold)</span>
                    ) : null}
                  </td>
                  <td className="cmp-note">{l.note ?? ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}

function fmt(v: number | null, unit: CompareLine['unit']): string {
  if (v === null) return 'not supplied';
  switch (unit) {
    case 'bn':
      return `$${v.toFixed(1)}B`;
    case 'mm':
      return `$${Math.round(v).toLocaleString('en-US')}M`;
    case 'usd':
      return `$${v.toFixed(2)}`;
    case 'pct':
      return `${v < 0 ? '−' : ''}${Math.abs(v).toFixed(1)}%`;
  }
}

function fmtChange(v: number | null, unit: CompareLine['unit']): string {
  if (v === null) return '—';
  const sign = v > 0 ? '+' : v < 0 ? '−' : '';
  const a = Math.abs(v);
  switch (unit) {
    case 'bn':
      return `${sign}$${a.toFixed(1)}B`;
    case 'mm':
      return `${sign}$${Math.round(a).toLocaleString('en-US')}M`;
    case 'usd':
      return `${sign}$${a.toFixed(2)}`;
    case 'pct':
      // a difference of two percentages is percentage points, never a percent
      return `${sign}${a.toFixed(1)} pp`;
  }
}
