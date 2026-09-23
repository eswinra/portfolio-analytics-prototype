import { useMemo, type ReactNode } from 'react';
import { Link } from 'react-router-dom';

import { AboutFigures, PageMeta } from '../components/page';
import { Panel, Tag, type TagVariant } from '../components/ui';
import { longDate } from '../fixtures/cioMonthly';
import { EXAMPLE_FILE, EXAMPLE_URL, useCioFile, useTemplateOpener } from '../lib/cioFile';
import { centerSummary, exceptionCenter } from '../lib/exceptionCenter';
import { reconcile, type Check, type TieDiff } from '../lib/reconcile';
import { SPREADSHEET_ACCEPT } from '../lib/workbook';

/** Workstation › Monthly run: one month's template file, from the file to the slides, in this
 *  browser. Each stage says what it did and where its output is: the file read, the template's
 *  own checks, reconciliation against the report's arithmetic and the published reports
 *  (lib/reconcile.ts), the dashboard and the Exception Center built from it, and the slides with
 *  their Print / PDF. Nothing is uploaded or kept; the file is the one held by lib/cioFile.tsx,
 *  so the CIO Monthly tab, the Exception Center and the slides all show the same file. */

type Stage = 'waiting' | 'done' | 'check' | 'stopped';
const STATUS: Record<Stage, [label: string, variant: TagVariant]> = {
  waiting: ['waiting', 'neutral'],
  done: ['done', 'accent'],
  check: ['to check', 'outline'],
  stopped: ['stopped', 'blocked'],
};

const pct2 = (v: number) => `${v < 0 ? '−' : ''}${Math.abs(v).toFixed(2)}%`;
const pp2 = (v: number) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v).toFixed(2)} pp`;
const kb = (bytes: number) => `${Math.max(1, Math.round(bytes / 1024)).toLocaleString('en-US')} KB`;

function Step({
  n,
  id,
  title,
  stage,
  count,
  children,
}: {
  n: number;
  id: string;
  title: string;
  stage: Stage;
  count?: number;
  children: ReactNode;
}) {
  const [label, variant] = STATUS[stage];
  return (
    <Panel
      id={id}
      className="mt run-step"
      kicker={`Step ${n} of 5`}
      title={title}
      sub={
        <Tag variant={variant}>
          {label}
          {count ? ` (${count})` : ''}
        </Tag>
      }
    >
      {children}
    </Panel>
  );
}

function ChecksTable({ label, checks }: { label: string; checks: Check[] }) {
  return (
    <div className="table-scroll run-wrap" role="region" aria-label={label} tabIndex={0}>
      <table className="table cardable" role="table">
        <caption>{label}</caption>
        <thead role="rowgroup">
          <tr role="row">
            <th scope="col" role="columnheader">
              Figure
            </th>
            <th scope="col" role="columnheader">
              Rule
            </th>
            <th scope="col" role="columnheader" className="num">
              Expected
            </th>
            <th scope="col" role="columnheader" className="num">
              In the file
            </th>
            <th scope="col" role="columnheader" className="num">
              Difference
            </th>
          </tr>
        </thead>
        <tbody role="rowgroup">
          {checks.map((c) => (
            <tr role="row" key={c.id} data-check={c.id}>
              <td role="cell" data-label="Figure">
                {c.fund === 'pension' ? 'Pension Fund' : 'OPEB Master Trust'} · {c.line} ·{' '}
                {c.series}
              </td>
              <td role="cell" data-label="Rule" className="issue-impact">
                {c.rule}: {c.inputs}
              </td>
              <td role="cell" className="num" data-label="Expected">
                {pct2(c.expected)}
              </td>
              <td role="cell" className="num" data-label="In the file">
                {pct2(c.actual)}
              </td>
              <td role="cell" className="num" data-label="Difference">
                {pp2(c.diff)} <span className="run-tol">(allowed ±{c.tolerance.toFixed(2)})</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const showTie = (v: number | null, unit: TieDiff['unit']) =>
  v === null
    ? 'not given'
    : unit === '%'
      ? `${v < 0 ? '−' : ''}${Math.abs(v).toFixed(1)}%`
      : unit === '$M'
        ? `$${v.toLocaleString('en-US')}M`
        : unit === '$B'
          ? `$${v.toFixed(1)}B`
          : `${v} ${unit}`.trim();

export function MonthlyRunView() {
  const { pkg, from, close } = useCioFile();
  const opener = useTemplateOpener();
  const v = pkg?.vintage ?? null;
  const rec = useMemo(() => (v ? reconcile(v) : null), [v]);
  const center = useMemo(() => (v ? exceptionCenter(v) : null), [v]);
  const toCheck = rec
    ? rec.within.failed.length + rec.chained.failed.length + rec.tieOut.differences.length
    : 0;
  // a file that was not opened; one opened earlier stays open
  const failed = opener.errors;
  const refused = failed !== null && !pkg;

  const pick = async (ev: React.ChangeEvent<HTMLInputElement>) => {
    const f = ev.target.files?.[0];
    ev.target.value = '';
    if (f) await opener.openFile(f);
  };

  return (
    <PageMeta classification="calculated">
      <AboutFigures
        summary={
          v
            ? `${pkg!.fileName}, data through ${longDate(v.dataThrough)} — read in this browser, not uploaded or kept`
            : 'No file open — a template file is read in this browser, never uploaded or kept'
        }
        classification="calculated"
      >
        <p>
          <strong>What this shows.</strong> One month&apos;s CIO template file taken straight
          through: read, checked, reconciled, shown on the dashboard, and turned into the slides and
          their PDF — all on this computer. The public example is the template filled with a
          published report, so every step can be tried without a confidential file; step 3 ties it
          out to that report.
        </p>
        <p>
          <strong>Before a report is published its figures are confidential.</strong> A real
          month&apos;s file stays on the team&apos;s systems: this page never uploads it or stores
          it, and closing or reloading the page forgets it. Using real internal figures here, even
          locally, is for the organization to approve.
        </p>
      </AboutFigures>

      <Step
        n={1}
        id="run-file"
        title={
          pkg
            ? `Read ${pkg.fileName}`
            : refused
              ? `${failed!.name} was not opened`
              : 'Choose the month’s template file'
        }
        stage={pkg ? 'done' : refused ? 'stopped' : 'waiting'}
      >
        {pkg && from ? (
          <dl className="run-facts">
            <div>
              <dt>File</dt>
              <dd>
                {pkg.fileName} · {kb(from.bytes)}
                {from.example ? ' · the public example, filled from a published report' : ''}
              </dd>
            </div>
            <div>
              <dt>Read from</dt>
              <dd>
                {from.sheet ? `the “${from.sheet}” tab` : 'a CSV of the Export tab'},{' '}
                {pkg.rowCount.toLocaleString('en-US')} rows
              </dd>
            </div>
            <div>
              <dt>Report</dt>
              <dd>
                {v!.reportLabel}, data through {longDate(v!.dataThrough)}
              </dd>
            </div>
            <div>
              <dt>Time</dt>
              <dd>read and checked in {Math.max(1, Math.round(from.ms))} ms, in this browser</dd>
            </div>
          </dl>
        ) : null}
        {failed ? (
          <div className="file-errors" role="alert">
            {pkg ? (
              <p>
                <strong>{failed.name} was not opened</strong> — {pkg.fileName} is still the file in
                use.
              </p>
            ) : null}
            <p>
              Nothing from it is shown. Fix these in the workbook (its Checks tab helps), save it
              and open it again:
            </p>
            <ul>
              {failed.errors.slice(0, 12).map((m) => (
                <li key={m}>{m}</li>
              ))}
            </ul>
            {failed.errors.length > 12 ? <p>…and {failed.errors.length - 12} more.</p> : null}
          </div>
        ) : null}
        <div className="run-actions">
          <button type="button" className="btn-outline" onClick={() => void opener.openExample()}>
            {pkg?.fileName === EXAMPLE_FILE
              ? 'Open the public example again'
              : 'Use the public example'}
          </button>
          <label className="btn-outline vs-file">
            {pkg ? 'Open another file…' : 'Open a template file…'}
            <input
              type="file"
              accept={SPREADSHEET_ACCEPT}
              className="visually-hidden"
              aria-describedby="run-file-help"
              onChange={(ev) => void pick(ev)}
            />
          </label>
          {pkg ? (
            <button type="button" className="btn-outline" onClick={close}>
              Close file
            </button>
          ) : null}
        </div>
        <p id="run-file-help" className="footnote">
          The filled <a href="templates/CIO_Monthly_Template.xlsx">CIO template</a> workbook, or its
          Export tab saved as CSV. The <a href={EXAMPLE_URL}>public example</a> can be downloaded
          too.
        </p>
      </Step>

      <Step
        n={2}
        id="run-checked"
        title={pkg ? 'The template’s own checks pass' : refused ? 'Checks not passed' : 'Checks'}
        stage={pkg ? 'done' : refused ? 'stopped' : 'waiting'}
      >
        <p className="run-lede">
          {pkg
            ? 'Every row was read, and the figures agree with each other as the report requires:'
            : 'A file is opened only if every row reads and the figures agree with each other:'}
        </p>
        <ul className="run-list">
          <li>
            composite weights add to 100% (within 0.3), and composite values to the fund total
          </li>
          <li>the 14 return bins add to 120 months</li>
          <li>developed and emerging markets add to 100%</li>
          <li>every return has a benchmark for the same period, and no figure appears twice</li>
          <li>dates are real month ends, and every value is a plain number</li>
        </ul>
      </Step>

      <Step
        n={3}
        id="run-reconciled"
        title={
          !rec
            ? 'Reconciliation'
            : toCheck === 0
              ? 'Reconciled against the report’s arithmetic and the published reports'
              : `${toCheck} figure${toCheck === 1 ? '' : 's'} to check before the file is used`
        }
        stage={!rec ? 'waiting' : toCheck === 0 ? 'done' : 'check'}
        {...(rec && toCheck ? { count: toCheck } : {})}
      >
        {!rec ? (
          <p className="run-lede">
            Once a file is open, its returns are checked against the arithmetic of returns and the
            published reports — not against a threshold chosen by eye.
          </p>
        ) : (
          <>
            <section className="run-sub">
              <h3>Within the report</h3>
              <p>
                {rec.within.checked === 0
                  ? 'No two periods coincide this month (they do in June, July and January), so there is nothing to compare within the file.'
                  : `${rec.within.checked} pairs of periods that are the same period${rec.within.failed.length ? `; ${rec.within.failed.length} differ` : ', all equal'}.`}
              </p>
              {rec.within.failed.length ? (
                <ChecksTable
                  label="Periods that should be equal and are not"
                  checks={rec.within.failed}
                />
              ) : null}
            </section>
            <section className="run-sub">
              <h3>Against the reports before it</h3>
              <p>
                {rec.chained.prior
                  ? `${rec.chained.checked} returns and benchmarks compounded from the ${rec.chained.prior.reportLabel} report${rec.chained.failed.length ? `; ${rec.chained.failed.length} outside their rounding` : ', every one within its rounding'}.`
                  : ''}{' '}
                {rec.chained.note ?? ''}
              </p>
              {rec.chained.failed.length ? (
                <ChecksTable
                  label="Figures that do not compound from the earlier reports"
                  checks={rec.chained.failed}
                />
              ) : null}
            </section>
            <section className="run-sub">
              <h3>Against the published report</h3>
              <p>
                {rec.tieOut.published
                  ? `${rec.tieOut.compared} figures compared with the ${rec.tieOut.published.reportLabel} report${rec.tieOut.differences.length ? `; ${rec.tieOut.differences.length} differ` : ': every one agrees'}.`
                  : rec.tieOut.note}
              </p>
              {rec.tieOut.differences.length ? (
                <div
                  className="table-scroll run-wrap"
                  role="region"
                  aria-label="Figures that differ from the published report"
                  tabIndex={0}
                >
                  <table className="table cardable" role="table">
                    <caption>Figures that differ from the published report</caption>
                    <thead role="rowgroup">
                      <tr role="row">
                        <th scope="col" role="columnheader">
                          Figure
                        </th>
                        <th scope="col" role="columnheader" className="num">
                          In the file
                        </th>
                        <th scope="col" role="columnheader" className="num">
                          Published
                        </th>
                      </tr>
                    </thead>
                    <tbody role="rowgroup">
                      {rec.tieOut.differences.map((d) => (
                        <tr role="row" key={d.id} data-diff={d.id}>
                          <td role="cell" data-label="Figure">
                            {d.label}
                          </td>
                          <td role="cell" className="num" data-label="In the file">
                            {showTie(d.file, d.unit)}
                          </td>
                          <td role="cell" className="num" data-label="Published">
                            {showTie(d.published, d.unit)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}
            </section>
            {toCheck ? (
              <p className="run-note">
                A figure outside its rounding is most often a keying error; it can also be a
                restatement of earlier months, which the report would footnote. Nothing is corrected
                here: fix the workbook and open it again.
              </p>
            ) : null}
          </>
        )}
      </Step>

      <Step
        n={4}
        id="run-dashboard"
        title={pkg ? 'On the dashboard' : 'Dashboard'}
        stage={pkg ? (toCheck ? 'check' : 'done') : 'waiting'}
      >
        {pkg && center ? (
          <>
            <p className="run-lede">
              {centerSummary(center)}, across both funds. The dashboard shows the file as
              &ldquo;Template file {pkg.fileName}, not published&rdquo; until it is closed; the
              published reports are untouched.
            </p>
            <ul className="run-links">
              <li>
                <Link to="/cio?tab=summary&v=file">CIO Monthly summary</Link> — select any figure to
                see where it came from
              </li>
              <li>
                <Link to="/exceptions?v=file">Exception Center</Link> — what needs attention in this
                month
              </li>
              <li>
                <Link to="/cio?tab=compare&v=file">Compare</Link> — against the same month a year
                earlier
              </li>
            </ul>
            {toCheck ? (
              <p className="run-note">
                The figures to check in step 3 are shown as they are in the file.
              </p>
            ) : null}
          </>
        ) : (
          <p className="run-lede">
            The CIO Monthly tab, the Exception Center and the comparison are built from the file
            once it is open.
          </p>
        )}
      </Step>

      <Step
        n={5}
        id="run-slides"
        title={pkg ? 'Slides and PDF' : 'Slides and PDF'}
        stage={pkg ? (toCheck ? 'check' : 'done') : 'waiting'}
      >
        {pkg ? (
          <>
            <p className="run-lede">
              The report&apos;s slides are built from the file.{' '}
              <Link to="/cio?tab=slides&v=file">Open the slides</Link>, then use{' '}
              <strong>Print / PDF</strong> on the slides&apos; toolbar and choose &ldquo;Save as
              PDF&rdquo;: the PDF is made by the browser, on this computer.
            </p>
          </>
        ) : (
          <p className="run-lede">
            The slides and their PDF are built from the file once it is open.
          </p>
        )}
      </Step>
    </PageMeta>
  );
}
