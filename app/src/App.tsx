import { useEffect, useRef } from 'react';
import { HashRouter, NavLink, Route, Routes, useLocation } from 'react-router-dom';

import { DatasetProvider, useDataset } from './lib/dataset/useDataset';
import { AcfrView } from './views/AcfrView';
import { AllocationView } from './views/AllocationView';
import { ContributionView } from './views/ContributionView';
import { DataQualityView } from './views/DataQualityView';
import { ImportView } from './views/ImportView';
import { LimitationsView } from './views/LimitationsView';
import { OverviewView } from './views/OverviewView';
import { PolicyView } from './views/PolicyView';

/** On every route change: reset scroll and move focus to the main region (screen-reader and
 *  keyboard users land on the new content, not under the sticky nav). */
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

function Shell() {
  const { dataset, source, entityTab, setEntityTab } = useDataset();
  const mainRef = useRef<HTMLElement>(null);

  // The skip link must not touch the URL hash (HashRouter owns it) — focus directly.
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
        <span className="kicker">Portfolio Analytics — exploratory prototype</span>
        <h1>Fund Pulse (synthetic demo)</h1>
        <div className="entity-tabs" role="group" aria-label="Select fund">
          <button
            type="button"
            className={entityTab === 'PENSION' && source === 'fixture' ? 'active' : ''}
            aria-pressed={entityTab === 'PENSION' && source === 'fixture'}
            onClick={() => setEntityTab('PENSION')}
          >
            Pension fund
          </button>
          <button
            type="button"
            className={entityTab === 'OPEB' && source === 'fixture' ? 'active' : ''}
            aria-pressed={entityTab === 'OPEB' && source === 'fixture'}
            onClick={() => setEntityTab('OPEB')}
          >
            OPEB fund
          </button>
          {source === 'import' ? <span className="pill warn">imported dataset</span> : null}
        </div>
        <div className="asof">
          Entity <strong>{dataset.meta.entityId}</strong> · as of{' '}
          <strong>{dataset.meta.asOf || 'n/a'}</strong>
          <br />
          {source === 'fixture' ? 'bundled synthetic fixture' : 'user-imported dataset'} ·{' '}
          {dataset.meta.policyEntity} IPS policy pack · schema {dataset.meta.schemaVersion}
        </div>
      </header>
      <nav className="mainnav" aria-label="Primary">
        <NavLink to="/" end>
          Overview
        </NavLink>
        <NavLink to="/contribution">Contribution</NavLink>
        <NavLink to="/allocation">Allocation</NavLink>
        <NavLink to="/policy">Policy</NavLink>
        <NavLink to="/data-quality">Data quality</NavLink>
        <NavLink to="/acfr">ACFR workflow</NavLink>
        <NavLink to="/import">Import</NavLink>
        <NavLink to="/limitations">Limitations</NavLink>
      </nav>
      <main id="main" ref={mainRef} tabIndex={-1}>
        <Routes>
          <Route path="/" element={<OverviewView />} />
          <Route path="/contribution" element={<ContributionView />} />
          <Route path="/allocation" element={<AllocationView />} />
          <Route path="/policy" element={<PolicyView />} />
          <Route path="/data-quality" element={<DataQualityView />} />
          <Route path="/acfr" element={<AcfrView />} />
          <Route path="/import" element={<ImportView />} />
          <Route path="/limitations" element={<LimitationsView />} />
          <Route
            path="*"
            element={
              <>
                <h1>Not found</h1>
                <p>
                  That view does not exist. <NavLink to="/">Back to the overview.</NavLink>
                </p>
              </>
            }
          />
        </Routes>
      </main>
      <footer>
        Exploratory prototype for discussion with a Portfolio Analytics team. All DEMOFUND values
        are synthetic; cited public values (IPS tables, report figures) are labeled and excluded
        from calculations. Imports are processed locally in your browser and never transmitted.
        Operational estimates are not official performance; the custodian remains the book of
        record.
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
