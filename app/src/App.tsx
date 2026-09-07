import { Suspense, lazy, useEffect, useRef, useState } from 'react';
import { HashRouter, Navigate, NavLink, Route, Routes, useLocation } from 'react-router-dom';

import { ErrorBoundary } from './components/ErrorBoundary';
import { cioFor, longDate } from './fixtures/cioMonthly';
import { boardBrief, publishedFor } from './fixtures/published';
import { useCioVintage } from './lib/cioVintage';
import { DatasetProvider, useDataset } from './lib/dataset/useDataset';
import { EntityProvider, useEntity } from './lib/entity';
import { AllocationView } from './views/AllocationView';
import { FundedView } from './views/FundedView';
import { HoldingsView } from './views/HoldingsView';
import { PerformanceView } from './views/PerformanceView';
import { PulseView } from './views/PulseView';
import { RiskView } from './views/RiskView';

/** Workstation views load on demand: the presentation-mode bundle no longer carries the
 *  import surface, reconciliation, exceptions triage, and tracker code that only the
 *  pipeline demo needs. Dashboard views stay eager so the first paint is complete. */
const AcfrView = lazy(() => import('./views/AcfrView').then((m) => ({ default: m.AcfrView })));
const ExceptionsView = lazy(() =>
  import('./views/ExceptionsView').then((m) => ({ default: m.ExceptionsView })),
);
const ImportView = lazy(() =>
  import('./views/ImportView').then((m) => ({ default: m.ImportView })),
);
const ReconView = lazy(() => import('./views/ReconView').then((m) => ({ default: m.ReconView })));
// the monthly vintage is its own section; loaded when the tab is opened
const CioMonthlyView = lazy(() =>
  import('./views/CioMonthlyView').then((m) => ({ default: m.CioMonthlyView })),
);

function ViewLoading() {
  return (
    <p className="view-loading" role="status">
      Loading view…
    </p>
  );
}

/** LACERA Portfolio Analytics shell (design handoff): notice bar, wordmark header with the
 *  entity segmented control, seven-view nav, title band, and mission footer. Published FY2025
 *  figures only — quoted from the 2025 PAFR/ACFR and the IPS documents. */

/** Dashboard mode — the published-figures presentation layer (2025 PAFR/ACFR, IPS). */
const DASHBOARD_VIEWS: [path: string, label: string, bandTitle: string][] = [
  ['/', 'Overview', 'Total fund overview'],
  ['/performance', 'Performance', 'Performance vs policy benchmark'],
  ['/allocation', 'Allocation', 'Asset allocation vs policy'],
  ['/funded', 'Funded Status', 'Funded status and membership'],
  ['/risk', 'Policy Monitoring', 'Policy monitoring'],
  ['/holdings', 'Holdings & Fees', 'Holdings & fees'],
  ['/cio', 'CIO Monthly', 'CIO Monthly Report'],
];

/** Workstation mode — where the work is populated: the synthetic contract-data pipeline
 *  (Data/Import, Reconciliation, Exceptions) and the ACFR production tracker. In the internal
 *  version the dashboard consumes what the workstation publishes; on this public prototype the
 *  dashboard quotes published documents while the workstation demonstrates the pipeline. */
const WORKSTATION_VIEWS: [path: string, label: string, bandTitle: string][] = [
  ['/import', 'Data', 'Import a dataset'],
  ['/recon', 'Reconciliation', 'Reconciliation'],
  ['/exceptions', 'Exceptions', 'Exceptions & data quality'],
  ['/acfr', 'ACFR Workflow', 'ACFR reporting workflow'],
];

const isWorkstationPath = (pathname: string): boolean =>
  WORKSTATION_VIEWS.some(([p]) => p === pathname);

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
    // announce the new view: focus its title band heading, falling back to main
    const title = document.getElementById('view-title');
    if (title) title.focus({ preventScroll: true });
    else mainRef.current?.focus({ preventScroll: true });
  }, [pathname, mainRef]);
  return null;
}

function TitleBand() {
  const { pathname } = useLocation();
  const { entity } = useEntity();
  const { dataset, discardNotice, dismissNotice } = useDataset();
  const d = publishedFor(entity);
  const workstation = WORKSTATION_VIEWS.find(([p]) => p === pathname);
  const view = workstation ?? DASHBOARD_VIEWS.find(([p]) => p === pathname) ?? DASHBOARD_VIEWS[0]!;
  const isOverview = !workstation && view[0] === '/';
  const isAcfr = pathname === '/acfr';
  const isCio = pathname === '/cio';
  const { vintage } = useCioVintage();
  const bandTitle = isCio
    ? `CIO Monthly Report — data through ${longDate(vintage.dataThrough)}`
    : pathname === '/funded' && entity === 'OPEB'
      ? 'Benefits & prefunding'
      : view[2];
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle');

  async function copyBrief() {
    try {
      await navigator.clipboard.writeText(boardBrief(entity));
      setCopyState('copied');
    } catch {
      setCopyState('failed');
    }
    setTimeout(() => setCopyState('idle'), 2600);
  }
  const copyLabel =
    copyState === 'copied'
      ? 'Copied ✓'
      : copyState === 'failed'
        ? 'Copy failed'
        : 'Copy board brief';
  // announced to assistive technology; the button label alone is not read out on change
  const copyAnnouncement =
    copyState === 'copied'
      ? 'Board brief copied to the clipboard.'
      : copyState === 'failed'
        ? 'Copy failed: the browser blocked clipboard access. Select the figures and copy them manually.'
        : '';

  return (
    <>
      <div className="band-spacer" />
      <div className="band">
        <div className="band-inner">
          <h1 id="view-title" tabIndex={-1}>
            {bandTitle}
          </h1>
          <span className="entity">
            {workstation
              ? isAcfr
                ? 'Workstation · ACFR tracker — illustrative demo values'
                : `Workstation · synthetic ${dataset.meta.entityId} data`
              : isCio
                ? cioFor(entity, vintage).name
                : d.label}
          </span>
          {isOverview ? (
            <span className="actions">
              <button type="button" className="btn-band" onClick={copyBrief}>
                {copyLabel}
              </button>
              <span className="visually-hidden" role="status" aria-live="polite">
                {copyAnnouncement}
              </span>
            </span>
          ) : isCio ? (
            <span className="actions">
              <a className="btn-band" href="deck/">
                Open as slides
              </a>
            </span>
          ) : null}
        </div>
      </div>
      <div className="band-strip" />
      {discardNotice ? (
        <div className="draft-banner" role="status">
          <strong>Import discarded:</strong> {discardNotice}{' '}
          <button type="button" className="linklike" onClick={dismissNotice}>
            Dismiss
          </button>
        </div>
      ) : null}
      {workstation ? (
        <>
          <div className="workflow-banner" role="note">
            <div className="workflow-banner-inner">
              <strong>Workstation</strong>
              <span>
                Where the work is populated — synthetic contract data (schema 1.3, V01–V23), not the
                published FY2025 figures on the Dashboard. In the internal version the dashboard
                consumes what the workstation publishes; here the pipeline is demonstrated. Files
                never leave your browser.
              </span>
            </div>
          </div>
          {!isAcfr ? (
            <div
              className={`publish-banner ${dataset.publishEligible ? 'ok' : 'blocked'}`}
              role="status"
            >
              {dataset.publishEligible ? (
                <>
                  <strong>Publication gate (demonstrated):</strong> ELIGIBLE — no blocking
                  conditions in the active dataset.
                </>
              ) : (
                <>
                  <strong>Publication gate (demonstrated):</strong> INELIGIBLE —{' '}
                  {dataset.publishBlockers.length} blocking condition
                  {dataset.publishBlockers.length === 1 ? '' : 's'}:{' '}
                  {dataset.publishBlockers.join(' · ')}
                </>
              )}
            </div>
          ) : null}
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
  const { dataset } = useDataset();
  const { pathname } = useLocation();
  const workstation = isWorkstationPath(pathname);
  const cio = pathname === '/cio';
  const { vintage, feed } = useCioVintage();
  const modeViews = workstation ? WORKSTATION_VIEWS : DASHBOARD_VIEWS;
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
        <span>
          {cio
            ? feed
              ? 'Prototype — imported workstation feed (schema 1.4 cio_monthly rows), not a published report'
              : `Prototype — published monthly figures (CIO Monthly Report, ${vintage.reportLabel})`
            : 'Prototype — published FY2025 figures (PAFR · ACFR · IPS)'}
        </span>
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
            {workstation ? (
              <>
                Data through <strong>{dataset.freshness.latestAsOf ?? 'n/a'}</strong> · synthetic
                workstation dataset
              </>
            ) : cio ? (
              <>
                Data through <strong>{longDate(vintage.dataThrough)}</strong> ·{' '}
                {feed
                  ? 'workstation feed (imported dataset)'
                  : `CIO Monthly Report, ${vintage.reportLabel}`}
              </>
            ) : (
              <>
                As of <strong>June 30, 2025</strong> · fiscal year end
              </>
            )}
          </div>
        </div>
      </header>

      <nav className="mainnav" aria-label="Views">
        <div className="mainnav-inner">
          <div className="mainnav-links">
            {modeViews.map(([path, label]) => (
              <NavLink key={path} to={path} end={path === '/'}>
                {label}
              </NavLink>
            ))}
          </div>
          <div className="mode-switch" role="group" aria-label="Mode">
            <NavLink to="/" end className={!workstation ? 'mode-active' : ''}>
              Dashboard
            </NavLink>
            <NavLink to="/import" className={workstation ? 'mode-active' : ''}>
              Workstation
            </NavLink>
          </div>
        </div>
      </nav>

      <TitleBand />

      <main id="main" ref={mainRef} tabIndex={-1} className="shell-main">
        <ErrorBoundary key={pathname}>
          <Suspense fallback={<ViewLoading />}>
            <Routes>
              <Route path="/" element={<PulseView />} />
              <Route path="/performance" element={<PerformanceView />} />
              <Route path="/allocation" element={<AllocationView />} />
              <Route path="/funded" element={<FundedView />} />
              <Route path="/risk" element={<RiskView />} />
              <Route path="/holdings" element={<HoldingsView />} />
              <Route path="/cio" element={<CioMonthlyView />} />
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
          </Suspense>
        </ErrorBoundary>
      </main>

      <footer className="site-footer">
        <div className="site-footer-inner">
          <div className="mission">
            We produce, protect, and provide the promised benefits to our members.
          </div>
          <div className="meta">
            Sources: 2025 Popular Annual Financial Report · 2025 Annual Comprehensive Financial
            Report · Investment Policy Statement (restated June 12, 2024) · OPEB Investment Policy
            Statement · Chief Investment Officer Monthly Reports (April 2025 – August 2026)
          </div>
          <div className="meta">
            Workstation (synthetic contract data):{' '}
            {WORKSTATION_VIEWS.map(([path, label], i) => (
              <span key={path}>
                {i > 0 ? ' · ' : ''}
                <NavLink to={path} style={{ color: '#fff' }}>
                  {label}
                </NavLink>
              </span>
            ))}{' '}
            — in the internal version the dashboard consumes what the workstation publishes; here
            the dashboard quotes published documents while the workstation demonstrates the
            pipeline.
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
