import { useRef, useState, type DragEvent } from 'react';

import invalidSampleCsv from '../../../data/sample/invalid/bad_schema_version.csv?raw';
import templateCsv from '../../../data/sample/market_pulse_template.csv?raw';
import { Panel, Pill } from '../components/ui';
import { COLUMN_DOCS, DICTIONARY_COLUMNS } from '../lib/contract/dictionary';
import { ENTITY_REGISTRY, WORKSPACE_ENTITY } from '../fixtures/entityRegistry';
import { useDataset } from '../lib/dataset/useDataset';
import type { ImportError } from '../lib/contract/parse';

/** Import (team workflow demo): client-side contract-CSV import with preflight, the data
 *  dictionary rendered from the validator's own constants, and the template guide. Files
 *  never leave the browser. Synthetic/shareable data only on this public site. */

function downloadText(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/csv' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

export function ImportView() {
  const { stageCsvText, applyStaged, discardStaged, resetToFixture, source, preflight, entityTab } =
    useDataset();
  const workspace = ENTITY_REGISTRY[WORKSPACE_ENTITY[entityTab]]!;
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [applied, setApplied] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleFile(file: File) {
    setBusy(true);
    setApplied(false);
    const reader = new FileReader();
    reader.onload = () => {
      stageCsvText(String(reader.result ?? ''), file.name);
      setBusy(false);
    };
    reader.onerror = () => setBusy(false);
    reader.readAsText(file);
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  }

  return (
    <>
      <Panel kicker="Confidentiality" title="Do not upload confidential or non-public data">
        <p className="footnote" style={{ margin: 0 }}>
          Files never leave your browser, but this public site is for synthetic/shareable data only.
          Browser-local processing is a privacy property, not an authorization or security control —
          confidential or non-public data belongs only in an approved private environment. Licensed
          market data (e.g., Bloomberg exports) is for internal use: run the app locally or on an
          internal host for that workflow, and never commit exports to the repository.
        </p>
      </Panel>

      <Panel
        className="mt"
        kicker="Contract CSV import — schema 1.x, V01–V23"
        title="Drop a file to preflight it"
        sub="Validated and summarized first — nothing changes until you apply it."
      >
        <p className="footnote" style={{ margin: '0 0 10px' }}>
          Active workspace: <strong>{workspace.entityId}</strong> — {workspace.fundLabel}. A staged
          file must name this entity; a file describing any other entity is rejected before staging
          (E-ENTITY). Switch workspaces with the Pension Plan / OPEB Trust toggle above.
        </p>
        <div
          className={`dropzone${dragging ? ' dragging' : ''}`}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
        >
          {busy ? (
            <p>Validating…</p>
          ) : (
            <>
              <p>Drop a contract CSV here, or</p>
              <button
                type="button"
                className="btn-primary"
                onClick={() => inputRef.current?.click()}
              >
                Choose file…
              </button>
              <input
                ref={inputRef}
                type="file"
                accept=".csv,text/csv"
                style={{ display: 'none' }}
                aria-label="Choose a contract CSV file"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFile(f);
                  e.target.value = '';
                }}
              />
            </>
          )}
        </div>

        <div aria-live="polite">
          {preflight ? (
            <div style={{ marginTop: 16 }}>
              <div className="kicker">Preflight — {preflight.fileName}</div>
              <div className="table-scroll" style={{ marginTop: 8 }}>
                <table className="table">
                  <caption>Preflight summary — nothing has been applied yet</caption>
                  <tbody>
                    <tr>
                      <td>Rows scanned</td>
                      <td className="num">{preflight.rowsScanned}</td>
                    </tr>
                    <tr>
                      <td>Portfolio entity</td>
                      <td className="num">{preflight.entityId}</td>
                    </tr>
                    <tr>
                      <td>Blocking errors</td>
                      <td className="num">
                        <Pill tone={preflight.errors.length ? 'bad' : 'good'}>
                          {preflight.errors.length}
                        </Pill>
                      </td>
                    </tr>
                    <tr>
                      <td>Warnings</td>
                      <td className="num">
                        <Pill tone={preflight.warnings.length ? 'warn' : 'good'}>
                          {preflight.warnings.length}
                        </Pill>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
              {preflight.errors.length > 0 ? <ErrorList errors={preflight.errors} /> : null}
              {preflight.warnings.length > 0 ? (
                <ul className="footnote">
                  {preflight.warnings.map((w, i) => (
                    <li key={i}>
                      [{w.ruleId}] {w.message}
                    </li>
                  ))}
                </ul>
              ) : null}
              <p style={{ marginTop: 12 }}>
                {preflight.ok ? (
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={() => setApplied(applyStaged())}
                  >
                    Apply this dataset
                  </button>
                ) : (
                  <button
                    className="linklike"
                    onClick={() =>
                      downloadText(
                        'import-errors.csv',
                        ['ruleId,severity,row,column,message']
                          .concat(
                            preflight.errors.map(
                              (e) =>
                                `${e.ruleId},${e.severity},${e.row},"${e.column}","${e.message.replaceAll('"', '""')}"`,
                            ),
                          )
                          .join('\n'),
                      )
                    }
                  >
                    Download error report (CSV)
                  </button>
                )}{' '}
                <button className="linklike" onClick={discardStaged}>
                  Discard
                </button>
              </p>
            </div>
          ) : null}
          {applied ? (
            <p className="panel-note">
              <strong>Import applied.</strong> The workflow views now show the imported dataset
              (browser memory only).{' '}
              <button className="linklike" onClick={resetToFixture}>
                Restore the bundled demo dataset
              </button>
            </p>
          ) : null}
        </div>
        {source === 'import' && !applied ? (
          <p className="footnote" style={{ marginTop: 12 }}>
            Currently showing a previously imported dataset.{' '}
            <button className="linklike" onClick={resetToFixture}>
              Restore the bundled demo dataset
            </button>
          </p>
        ) : null}
      </Panel>

      <Panel
        className="mt"
        kicker="Templates and test files"
        title="Daily workflow starters"
        note="The market-pulse template is a one-day skeleton for a Bloomberg BDH export: refresh your terminal workbook, lay the closes out in these columns, save as CSV, and import. Internal use only for licensed data."
      >
        <ul style={{ margin: 0, paddingLeft: 18 }}>
          <li>
            <button
              className="linklike"
              onClick={() => downloadText('market_pulse_template.csv', templateCsv)}
            >
              Download market-pulse CSV template
            </button>
          </li>
          <li>
            <button
              className="linklike"
              onClick={() => downloadText('invalid_sample.csv', invalidSampleCsv)}
            >
              Download an invalid sample (bad schema version)
            </button>{' '}
            — try importing it to see a rejection.
          </li>
          <li>
            <a
              href="https://github.com/eswinra/portfolio-analytics-prototype/blob/main/docs/import-validation-rules.md"
              target="_blank"
              rel="noreferrer"
            >
              View the full validation rules (V01–V23)
            </a>
          </li>
        </ul>
      </Panel>

      <details className="panel" style={{ marginTop: 22 }}>
        <summary>How to fill the template — first-timer guide</summary>
        <ol style={{ marginTop: 10 }}>
          <li>
            Download the market-pulse template above (or start from yesterday's file — the daily
            workflow appends one day per close, and history deepens every window).
          </li>
          <li>
            Paste the day's closes into the value column. Returns and weights are{' '}
            <strong>decimals</strong>: 4.17% is <code>0.0417</code>, never <code>4.17</code>.
          </li>
          <li>One fund per file — Pension and OPEB are separate imports.</li>
          <li>
            If a value is genuinely unavailable, leave it blank AND set{' '}
            <code>quality_status=missing</code>; the app shows an honest gap, never a zero.
          </li>
          <li>
            Save as CSV and drop it above. The preflight shows exactly what would change — nothing
            applies until you confirm.
          </li>
        </ol>
        <p className="footnote">The three Monday-morning mistakes, and what the validator says:</p>
        <ul className="footnote">
          <li>
            <strong>Whole-number percents</strong> (4.17 for 4.17%) → rejected by V10 with the
            decimal expected. Fix: divide by 100.
          </li>
          <li>
            <strong>Two funds in one file</strong> → rejected by V17. Fix: split into one file per
            entity.
          </li>
          <li>
            <strong>Blank value without the missing flag</strong> → rejected by V08. Fix: set{' '}
            <code>quality_status=missing</code> on that row.
          </li>
        </ul>
      </details>

      <details className="panel" style={{ marginTop: 22 }}>
        <summary>Data dictionary — every column and enum token (schema 1.3)</summary>
        <p className="footnote" style={{ marginTop: 10 }}>
          Rendered directly from the validator's own constants — this table cannot drift from the
          import rules. Schema 1.0/1.1 files (29 columns, without the last three) remain valid.
        </p>
        <div className="table-scroll">
          <table className="table">
            <caption>Contract columns in file order</caption>
            <thead>
              <tr>
                <th scope="col">Column</th>
                <th scope="col">Description</th>
                <th scope="col">Allowed tokens</th>
                <th scope="col">Rule</th>
              </tr>
            </thead>
            <tbody>
              {DICTIONARY_COLUMNS.map((col) => {
                const doc = COLUMN_DOCS[col];
                return (
                  <tr key={col}>
                    <td>
                      <code>{col}</code>
                    </td>
                    <td className="footnote">
                      {doc.desc}
                      {doc.example ? (
                        <>
                          {' '}
                          e.g. <code>{doc.example}</code>
                        </>
                      ) : null}
                    </td>
                    <td className="footnote">
                      {doc.enumTokens ? doc.enumTokens.join(' · ') : 'free'}
                    </td>
                    <td className="footnote">{doc.rule ?? '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </details>
    </>
  );
}

function ErrorList({ errors }: { errors: ImportError[] }) {
  return (
    <div className="error-list" role="alert">
      {errors.slice(0, 50).map((e, i) => (
        <div key={i}>
          [{e.ruleId}] row {e.row} · {e.column}: {e.message}
          {e.value !== undefined ? ` (value: ${JSON.stringify(e.value)})` : ''}
        </div>
      ))}
      {errors.length > 50 ? <div>… {errors.length - 50} more</div> : null}
    </div>
  );
}
