import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

import { AboutFigures, PageMeta, PageSources } from '../components/page';
import { ChangeChip, Panel, Tag } from '../components/ui';
import { CONFIG } from '../config';
import { CIO_VINTAGES, longDate } from '../fixtures/cioMonthly';
import { entityPages } from '../lib/cioSource';
import { FEED_KEY, FILE_KEY, useCioVintage } from '../lib/cioVintage';
import { useEntity } from '../lib/entity';
import {
  centerLink,
  centerSummary,
  exceptionCenter,
  type CenterItem,
} from '../lib/exceptionCenter';
import type { FundKey } from '../lib/provenance';

/** Exception Center — what in the CIO Monthly Report on screen needs attention before its figures
 *  are presented: policy ranges, data conditions particular to this report, and the changes since
 *  the prior report that someone will be asked to explain. Both funds, one page; every item opens
 *  the panel it comes from with the figure's provenance record on top. The rules live in
 *  lib/exceptionCenter.ts. */

export function ExceptionCenterView() {
  const { entity } = useEntity();
  const { vintage, prior, feed, pkg, feedAvailable, fileAvailable, select } = useCioVintage();
  const [params] = useSearchParams();
  const report = params.get('v');
  const c = useMemo(() => exceptionCenter(vintage), [vintage]);

  const fundName = (f: FundKey | null) => (f === null ? 'Both funds' : vintage.ENT[f].short);
  const policy = c.items.filter((i) => i.kind === 'outside' || i.kind === 'near');
  const data = c.items.filter((i) => i.kind === 'data');
  const explain = c.items.filter((i) => i.kind === 'explain');
  const link = (i: CenterItem) => centerLink(i, { report, entity });
  const reportName = feed
    ? 'the imported workstation dataset'
    : pkg
      ? `template file ${pkg.fileName}`
      : `the ${vintage.reportLabel} CIO Monthly Report`;

  return (
    <PageMeta classification="calculated">
      <AboutFigures
        summary={`Computed from ${reportName}, data through ${longDate(vintage.dataThrough)} — both funds`}
        classification="calculated"
      >
        <p>
          <strong>What is listed.</strong> Composites outside or within{' '}
          {CONFIG.nearBoundPp.toFixed(1)} pp of an IPS bound; data conditions particular to this
          report — a month missing from the series, a table that could not be read, a chart the
          report did not redraw, a figure it did not print; and every change since the prior report
          past the thresholds the CIO Monthly &ldquo;What changed&rdquo; panel applies, so the two
          lists are always the same.
        </p>
        <p>
          <strong>What is not.</strong> Caveats true of every report — real estate and private
          markets carried at lagged values, the market table a month ahead of the fund figures — are
          stated once in the freshness matrix rather than repeated here every month. Standing
          performance (below the benchmark, below the hurdle) is on the CIO Monthly Summary; this
          page lists what changed, not what has always been so.
        </p>
      </AboutFigures>

      <div className="vintage-bar xc-bar">
        <label htmlFor="xc-report">Report</label>
        <select
          id="xc-report"
          className="vs-select"
          value={pkg ? FILE_KEY : feed ? FEED_KEY : vintage.dataThrough}
          onChange={(ev) => select(ev.target.value)}
        >
          {fileAvailable ? (
            <option value={FILE_KEY}>Template file {fileAvailable.fileName} (not published)</option>
          ) : null}
          {feedAvailable ? (
            <option value={FEED_KEY}>Workstation dataset ({feedAvailable.entityId})</option>
          ) : null}
          {[...CIO_VINTAGES].reverse().map((v) => (
            <option key={v.dataThrough} value={v.dataThrough}>
              {v.reportLabel} — data through {longDate(v.dataThrough)}
            </option>
          ))}
        </select>
      </div>

      <p className="xc-lead" role="status">
        {centerSummary(c)}, across both funds.
      </p>

      <Panel
        id="x-policy"
        kicker="Policy ranges"
        title={
          policy.length === 0
            ? `No composite is within ${CONFIG.nearBoundPp.toFixed(1)} pp of an IPS bound`
            : `${policy.length} composite${policy.length === 1 ? '' : 's'} at or near an IPS bound`
        }
        method={
          <p>
            Each composite&apos;s month-end weight, as printed, against the range in force: IPS
            Table 1 (restated June 12, 2024), target ± the allowable range. &ldquo;Near&rdquo; is
            within {CONFIG.nearBoundPp.toFixed(1)} pp of either bound. The IPS sets no mechanical
            trade trigger, so this is a factual comparison, not a compliance finding.
            &ldquo;Running&rdquo; counts consecutive published reports in which the condition held.
          </p>
        }
      >
        {policy.length === 0 ? (
          <p className="muted-note">
            {c.closest
              ? `The nearest is ${c.closest.name} in the ${fundName(c.closest.fund)}, ${c.closest.dist.toFixed(1)} pp from its ${c.closest.bound} bound.`
              : 'No composite in this report has an IPS range to compare against.'}
          </p>
        ) : (
          <ItemTable
            label="Composites at or near an IPS bound"
            items={policy}
            fundName={fundName}
            link={link}
            status
            running
          />
        )}
      </Panel>

      <Panel
        id="x-data"
        className="mt"
        kicker="Data"
        title={
          data.length === 0
            ? "Nothing unusual about this report's data"
            : `Data conditions in this report (${data.length})`
        }
        method={
          <p>
            A condition is listed when it is true of this report and not of every report. A figure
            the report does not print is shown as missing, never as zero, and nothing is calculated
            from it.
          </p>
        }
      >
        {data.length === 0 ? (
          <p className="muted-note">
            The caveats that hold for every report are in the{' '}
            <Link to={`/cio?tab=summary&p=cio-freshness${report ? `&v=${report}` : ''}`}>
              freshness matrix
            </Link>
            .
          </p>
        ) : (
          <ItemTable
            label="Data conditions in this report"
            items={data}
            fundName={fundName}
            link={link}
            running
          />
        )}
      </Panel>

      <Panel
        id="x-explain"
        className="mt"
        kicker={prior ? `Against the ${prior.reportLabel} report` : 'Against the prior report'}
        title={
          !prior
            ? 'No prior report in the series'
            : explain.length === 0
              ? 'Nothing moved past the reporting thresholds'
              : `Changes to explain (${explain.length})`
        }
        method={
          <p>
            Listed: weights that moved half a point or more, fiscal-year-to-date and one-year
            returns that moved a tenth or more, market value that moved $0.05 billion or more, an
            excess over the benchmark that changed sign, any policy-target change, and a monthly
            return of 2% or more either way. Calculated from the two reports&apos; printed
            one-decimal values. A new fiscal year restarts FYTD and is not a change.
          </p>
        }
      >
        {!prior ? (
          <p className="muted-note">
            This is the earliest report on the site, so there is nothing to compare it with.
          </p>
        ) : explain.length === 0 ? (
          <p className="muted-note">Every figure moved by less than the thresholds.</p>
        ) : (
          <ItemTable
            label="Changes since the prior report"
            items={explain}
            fundName={fundName}
            link={link}
            change
          />
        )}
      </Panel>

      <p className="footnote xc-pipeline">
        In the internal version the pipeline&apos;s own validation — files that failed their checks,
        series that went stale, controls — would feed this page too. That queue is demonstrated on
        synthetic data under <Link to="/data-quality">Workstation › Data quality</Link>.
      </p>

      {feed || pkg ? null : (
        <PageSources
          sources={[entityPages(vintage, 'pension').main, entityPages(vintage, 'opeb').main]}
        />
      )}
    </PageMeta>
  );
}

function ItemTable({
  label,
  items,
  fundName,
  link,
  status,
  running,
  change,
}: {
  label: string;
  items: CenterItem[];
  fundName: (f: FundKey | null) => string;
  link: (i: CenterItem) => string;
  status?: boolean;
  running?: boolean;
  change?: boolean;
}) {
  return (
    <div className="table-scroll" role="region" aria-label={label} tabIndex={0}>
      <table className="table cardable xc-table" role="table">
        <caption>{label}</caption>
        <thead role="rowgroup">
          <tr role="row">
            {status ? (
              <th scope="col" role="columnheader">
                Status
              </th>
            ) : null}
            <th scope="col" role="columnheader">
              Fund
            </th>
            <th scope="col" role="columnheader">
              {change ? 'Change' : 'Condition'}
            </th>
            {change ? (
              <th scope="col" role="columnheader" className="num">
                Size
              </th>
            ) : null}
            <th scope="col" role="columnheader">
              Detail
            </th>
            {running ? (
              <th scope="col" role="columnheader">
                Running
              </th>
            ) : null}
            <th scope="col" role="columnheader">
              Where
            </th>
          </tr>
        </thead>
        <tbody role="rowgroup">
          {items.map((i) => (
            <tr role="row" key={i.id} data-item={i.id}>
              {status ? (
                <td role="cell" data-label="Status">
                  {i.kind === 'outside' ? (
                    <Tag variant="blocked">outside range</Tag>
                  ) : (
                    <Tag variant="outline">near bound</Tag>
                  )}
                </td>
              ) : null}
              <td role="cell" data-label="Fund">
                {fundName(i.fund)}
              </td>
              <td role="cell" data-label={change ? 'Change' : 'Condition'} className="xc-what">
                {i.title}
              </td>
              {change ? (
                <td role="cell" className="num" data-label="Size">
                  {i.change ? (
                    <ChangeChip
                      delta={i.change.delta}
                      unit={i.change.unit}
                      dp={i.change.unit === '$B' ? 2 : 1}
                    />
                  ) : null}
                </td>
              ) : null}
              <td role="cell" className="issue-impact" data-label="Detail">
                {i.detail}
              </td>
              {running ? (
                <td role="cell" data-label="Running">
                  {i.running === undefined
                    ? '—'
                    : i.running.count === 1
                      ? 'New in this report'
                      : `${i.running.count} reports, since ${i.running.since}`}
                </td>
              ) : null}
              <td role="cell" data-label="Where">
                <Link to={link(i)} aria-label={`Open in CIO Monthly: ${i.title}`}>
                  Open →
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
