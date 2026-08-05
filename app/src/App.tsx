import { HashRouter, NavLink, Route, Routes } from 'react-router-dom';

import { DatasetProvider, useDataset } from './lib/dataset/useDataset';
import { AcfrView } from './views/AcfrView';
import { AllocationView } from './views/AllocationView';
import { ContributionView } from './views/ContributionView';
import { DataQualityView } from './views/DataQualityView';
import { ImportView } from './views/ImportView';
import { LimitationsView } from './views/LimitationsView';
import { OverviewView } from './views/OverviewView';

function Shell() {
  const { dataset, source } = useDataset();
  return (
    <>
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <div className="disclaimer-band" role="note">
        <strong>Prototype.</strong> Synthetic and cited public data only — not an official LACERA
        system, performance report, or statement of endorsement.
      </div>
      <header className="masthead">
        <span className="kicker">Portfolio Analytics — exploratory prototype</span>
        <h1>Fund Pulse (synthetic demo)</h1>
        <div className="asof">
          Entity <strong>{dataset.meta.entityId}</strong> · as of{' '}
          <strong>{dataset.meta.asOf}</strong>
          <br />
          {source === 'fixture' ? 'bundled synthetic fixture' : 'user-imported dataset'} · schema{' '}
          {dataset.meta.schemaVersion}
        </div>
      </header>
      <nav className="mainnav" aria-label="Primary">
        <NavLink to="/" end>
          Overview
        </NavLink>
        <NavLink to="/contribution">Contribution</NavLink>
        <NavLink to="/allocation">Allocation</NavLink>
        <NavLink to="/data-quality">Data quality</NavLink>
        <NavLink to="/acfr">ACFR workflow</NavLink>
        <NavLink to="/import">Import</NavLink>
        <NavLink to="/limitations">Limitations</NavLink>
      </nav>
      <main id="main">
        <Routes>
          <Route path="/" element={<OverviewView />} />
          <Route path="/contribution" element={<ContributionView />} />
          <Route path="/allocation" element={<AllocationView />} />
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
        are synthetic; cited public values are labeled and excluded from calculations. Imports are
        processed locally in your browser and never transmitted.
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
