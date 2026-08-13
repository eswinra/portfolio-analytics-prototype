import { useEffect, useRef, useState } from 'react';
import { HashRouter, Navigate, NavLink, Route, Routes, useLocation } from 'react-router-dom';

import { boardBrief, publishedFor } from './fixtures/published';
import { DatasetProvider, useDataset } from './lib/dataset/useDataset';
import { EntityProvider, useEntity } from './lib/entity';
import { AcfrView } from './views/AcfrView';
import { AllocationView } from './views/AllocationView';
import { ExceptionsView } from './views/ExceptionsView';
import { FundedView } from './views/FundedView';
import { HoldingsView } from './views/HoldingsView';
import { ImportView } from './views/ImportView';
import { PerformanceView } from './views/PerformanceView';
import { PulseView } from './views/PulseView';
import { ReconView } from './views/ReconView';
import { RiskView } from './views/RiskView';

/** LACERA Portfolio Analytics shell (design handoff): notice bar, wordmark header with the
 *  entity segmented control, seven-view nav, title band, and mission footer. Published FY2025
 *  figures only — quoted from the 2025 PAFR/ACFR and the IPS documents. */

const VIEWS: [path: string, label: string, bandTitle: string][] = [
  ['/', 'Overview', 'Total fund overview'],
  ['/performance', 'Performance', 'Performance vs policy benchmark'],
  ['/allocation', 'Allocation', 'Asset allocation vs policy'],
  ['/funded', 'Funded Status', 'Funded status and membership'],
  ['/risk', 'Risk & Compliance', 'Risk & compliance'],
  ['/holdings', 'Holdings & Managers', 'Holdings & managers'],
  ['/acfr', 'ACFR Workflow', 'ACFR reporting workflow'],
];

/** Team workflow demo — the synthetic contract-data views (footer-linked, outside the
 *  seven-tab presentation nav; the published/synthetic wall stays explicit). */
const WORKFLOW_VIEWS: [path: string, label: string, bandTitle: string][] = [
  ['/import', 'Import', 'Import a dataset'],
  ['/recon', 'Reconciliation', 'Reconciliation'],
  ['/exceptions', 'Exceptions', 'Exceptions & data quality'],
];

/** Keeps the synthetic dataset's fund selection in step with the header entity toggle. */
function EntitySync() {
  const { entity } = useEntity();
  const { setEntityTab } = useDataset();
  useEffect(() => {
    setEntityTab(entity);
  }, [entity, setEntityTab]);
  return null;
}

/** On every route change: reset scroll and move focus to the main region. */
function RouteFocusReset({ mainRef }: { mainRef: React.RefObject<HTMLElement> }) {
  const { pathname } = useLocation();
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    window.scrollTo(0, 0);
    mainRef.current?.focus({ preventScroll: true });
  }, [pathname, mainRef]);
  return null;
}

function TitleBand() {
  const { pathname } = useLocation();
  const { entity } = useEntity();
  const { dataset } = useDataset();
  const d = publishedFor(entity);
  const workflow = WORKFLOW_VIEWS.find(([p]) => p === pathname);
  const view = workflow ?? VIEWS.find(([p]) => p === pathname) ?? VIEWS[0]!;
  const isOverview = !workflow && view[0] === '/';
  const [copied, setCopied] = useState(false);

  async function copyBrief() {
    try {
      await navigator.clipboard.writeText(boardBrief(entity));
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch {
      setCopied(false);
    }
  }

  return (
    <>
      <div className="band-spacer" />
      <div className="band">
        <div className="band-inner">
          <h1>{view[2]}</h1>
          <span className="entity">
            {workflow ? `Team workflow demo · synthetic ${dataset.meta.entityId} data` : d.label}
          </span>
          {isOverview ? (
            <span className="actions">
              <button type="button" className="btn-band" onClick={copyBrief}>
                {copied ? 'Copied ✓' : 'Copy board brief'}
              </button>
            </span>
          ) : null}
        </div>
      </div>
      <div className="band-strip" />
      {workflow ? (
        <>
          <div className="workflow-banner" role="note">
            <div className="workflow-banner-inner">
              <strong>Team workflow demo</strong>
              <span>
                Synthetic contract data (schema 1.3, V01–V23) — not the published FY2025 figures
                shown on the presentation views. Files never leave your browser.
              </span>
              <nav aria-label="Workflow views">
                {WORKFLOW_VIEWS.map(([path, label]) => (
                  <NavLink key={path} to={path}>
                    {label}
                  </NavLink>
                ))}
              </nav>
            </div>
          </div>
          {dataset.draftRecordCount > 0 ? (
            <div className="draft-banner" role="status">
              <strong>Draft data:</strong> {dataset.draftRecordCount} record
              {dataset.draftRecordCount === 1 ? '' : 's'} in the active dataset{' '}
              {dataset.draftRecordCount === 1 ? 'is' : 'are'} still review_status=draft — figures
              may change on review.
            </div>
          ) : null}
        </>
      ) : null}
    </>
  );
}

function Shell() {
  const { entity, setEntity } = useEntity();
  const mainRef = useRef<HTMLElement>(null);

  function skipToMain(e: React.MouseEvent) {
    e.preventDefault();
    mainRef.current?.focus();
  }

  return (
    <>
      <a href="#main" className="skip-link" onClick={skipToMain}>
        Skip to content
      </a>
      <RouteFocusReset mainRef={mainRef} />

      <div className="notice-bar" role="note">
        <span>Prototype — published FY2025 figures (PAFR · ACFR · IPS)</span>
        <span className="right">Not an official LACERA system or performance report</span>
      </div>

      <header className="masthead">
        <div className="brand">
          <div className="wordmark">LACERA</div>
          <div className="brand-rule" />
          <div>
            <div className="brand-app">Portfolio Analytics</div>
            <div className="brand-sub">
              Pension and OPEB Trust Funds of the County of Los Angeles
            </div>
          </div>
        </div>
        <div className="masthead-right">
          <div className="seg" role="group" aria-label="Select fund">
            <button
              type="button"
              className={entity === 'PENSION' ? 'active' : ''}
              aria-pressed={entity === 'PENSION'}
              onClick={() => setEntity('PENSION')}
            >
              Pension Plan
            </button>
            <button
              type="button"
              className={entity === 'OPEB' ? 'active' : ''}
              aria-pressed={entity === 'OPEB'}
              onClick={() => setEntity('OPEB')}
            >
              OPEB Trust
            </button>
          </div>
          <div className="asof">
            As of <strong>June 30, 2025</strong> · fiscal year end
          </div>
        </div>
      </header>

      <nav className="mainnav" aria-label="Views">
        <div className="mainnav-inner">
          {VIEWS.map(([path, label]) => (
            <NavLink key={path} to={path} end={path === '/'}>
              {label}
            </NavLink>
          ))}
        </div>
      </nav>

      <TitleBand />

      <main id="main" ref={mainRef} tabIndex={-1} className="shell-main">
        <Routes>
          <Route path="/" element={<PulseView />} />
          <Route path="/performance" element={<PerformanceView />} />
          <Route path="/allocation" element={<AllocationView />} />
          <Route path="/funded" element={<FundedView />} />
          <Route path="/risk" element={<RiskView />} />
          <Route path="/holdings" element={<HoldingsView />} />
          <Route path="/acfr" element={<AcfrView />} />
          {/* team workflow demo — synthetic contract data */}
          <Route path="/import" element={<ImportView />} />
          <Route path="/recon" element={<ReconView />} />
          <Route path="/exceptions" element={<ExceptionsView />} />
          {/* legacy routes from revisions 1–7 */}
          <Route path="/trends" element={<Navigate to="/performance" replace />} />
          <Route path="/contribution" element={<Navigate to="/performance" replace />} />
          <Route path="/data-quality" element={<Navigate to="/exceptions" replace />} />
          <Route path="/policy" element={<Navigate to="/allocation" replace />} />
          <Route path="/methodology" element={<Navigate to="/" replace />} />
          <Route path="/limitations" element={<Navigate to="/" replace />} />
          <Route
            path="*"
            element={
              <>
                <h2>Not found</h2>
                <p>
                  That view does not exist. <NavLink to="/">Back to the overview.</NavLink>
                </p>
              </>
            }
          />
        </Routes>
      </main>

      <footer className="site-footer">
        <div className="site-footer-inner">
          <div className="mission">
            We produce, protect, and provide the promised benefits to our members.
          </div>
          <div className="meta">
            Sources: 2025 Popular Annual Financial Report · 2025 Annual Comprehensive Financial
            Report · Investment Policy Statement (restated June 12, 2024) · OPEB Investment Policy
            Statement
          </div>
          <div className="meta">
            Team workflow demo (synthetic contract data):{' '}
            {WORKFLOW_VIEWS.map(([path, label], i) => (
              <span key={path}>
                {i > 0 ? ' · ' : ''}
                <NavLink to={path} style={{ color: '#fff' }}>
                  {label}
                </NavLink>
              </span>
            ))}
          </div>
          <div className="meta">
            Exploratory prototype for the Portfolio Analytics team. All figures are quoted from
            published LACERA documents as of the dates shown; this is not an official LACERA system,
            performance report, or statement of endorsement.
          </div>
        </div>
      </footer>
    </>
  );
}

export default function App() {
  return (
    <EntityProvider>
      <DatasetProvider>
        <HashRouter>
          <EntitySync />
          <Shell />
        </HashRouter>
      </DatasetProvider>
    </EntityProvider>
  );
}
