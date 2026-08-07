import { useEffect, useRef } from 'react';
import { HashRouter, Navigate, NavLink, Route, Routes, useLocation } from 'react-router-dom';

import { DatasetProvider, useDataset } from './lib/dataset/useDataset';
import { AcfrView } from './views/AcfrView';
import { AllocationView } from './views/AllocationView';
import { ExceptionsView } from './views/ExceptionsView';
import { ImportView } from './views/ImportView';
import { LimitationsView } from './views/LimitationsView';
import { PerformanceView } from './views/PerformanceView';
import { PolicyView } from './views/PolicyView';
import { PulseView } from './views/PulseView';

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

function MoreMenu() {
  const ref = useRef<HTMLDetailsElement>(null);
  const close = () => {
    if (ref.current) ref.current.open = false;
  };
  return (
    <details className="more-menu" ref={ref}>
      <summary>More ▾</summary>
      <div className="more-menu-list" role="list">
        <NavLink to="/policy" onClick={close}>
          Policy &amp; benchmarks
        </NavLink>
        <NavLink to="/acfr" onClick={close}>
          ACFR reporting workflow
        </NavLink>
        <NavLink to="/import" onClick={close}>
          Import data
        </NavLink>
        <NavLink to="/methodology" onClick={close}>
          Methodology &amp; disclosures
        </NavLink>
      </div>
    </details>
  );
}

function Shell() {
  const { dataset, source, entityTab, setEntityTab } = useDataset();
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
      <div className="disclaimer-band" role="note">
        <strong>Prototype.</strong> Synthetic and cited public data only — not an official LACERA
        system, performance report, or statement of endorsement.
      </div>
      <header className="masthead">
        <h1>Fund Pulse</h1>
        <div className="entity-tabs" role="group" aria-label="Select fund">
          <button
            type="button"
            className={entityTab === 'PENSION' && source === 'fixture' ? 'active' : ''}
            aria-pressed={entityTab === 'PENSION' && source === 'fixture'}
            onClick={() => setEntityTab('PENSION')}
          >
            Pension
          </button>
          <button
            type="button"
            className={entityTab === 'OPEB' && source === 'fixture' ? 'active' : ''}
            aria-pressed={entityTab === 'OPEB' && source === 'fixture'}
            onClick={() => setEntityTab('OPEB')}
          >
            OPEB
          </button>
          {source === 'import' ? <span className="pill warn">imported dataset</span> : null}
        </div>
        <div className="asof">
          As of <strong>{dataset.meta.asOf || 'n/a'}</strong> · synthetic proxy view
        </div>
      </header>
      <nav className="mainnav" aria-label="Primary">
        <NavLink to="/" end>
          Pulse
        </NavLink>
        <NavLink to="/performance">Performance</NavLink>
        <NavLink to="/allocation">Allocation</NavLink>
        <NavLink to="/exceptions">Exceptions</NavLink>
        <MoreMenu />
      </nav>
      <main id="main" ref={mainRef} tabIndex={-1}>
        <Routes>
          <Route path="/" element={<PulseView />} />
          <Route path="/performance" element={<PerformanceView />} />
          <Route path="/allocation" element={<AllocationView />} />
          <Route path="/exceptions" element={<ExceptionsView />} />
          <Route path="/policy" element={<PolicyView />} />
          <Route path="/acfr" element={<AcfrView />} />
          <Route path="/import" element={<ImportView />} />
          <Route path="/methodology" element={<LimitationsView />} />
          {/* legacy routes from revisions 1–4 */}
          <Route path="/contribution" element={<Navigate to="/performance" replace />} />
          <Route path="/data-quality" element={<Navigate to="/exceptions" replace />} />
          <Route path="/limitations" element={<Navigate to="/methodology" replace />} />
          <Route
            path="*"
            element={
              <>
                <h1>Not found</h1>
                <p>
                  That view does not exist. <NavLink to="/">Back to the pulse.</NavLink>
                </p>
              </>
            }
          />
        </Routes>
      </main>
      <footer>
        Exploratory prototype for discussion with a Portfolio Analytics team. All portfolio values
        are synthetic; cited public values (IPS tables, report figures) are labeled and excluded
        from calculations. Imports stay in your browser. Operational estimates are not official
        performance; the custodian remains the book of record.
      </footer>
    </>
  );
}

export default function App() {
  return (
    <DatasetProvider>
      <HashRouter>
        <Shell />
      </HashRouter>
    </DatasetProvider>
  );
}
