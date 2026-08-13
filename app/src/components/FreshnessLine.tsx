import { useDataset } from '../lib/dataset/useDataset';

/** Workflow-demo freshness: the newest as-of in the active synthetic dataset and who entered
 *  that row (actor labels come from the file's provenance columns). */
export function FreshnessLine() {
  const { dataset, source } = useDataset();
  const { freshness, marketDate, meta } = dataset;
  if (!freshness.latestAsOf) return null;
  return (
    <p className="footnote" style={{ marginTop: 0 }}>
      Data through <strong>{freshness.latestAsOf}</strong>
      {marketDate && marketDate !== freshness.latestAsOf ? ` (market ${marketDate})` : ''}
      {freshness.latestActor ? (
        <>
          {' '}
          · newest row entered by <code>{freshness.latestActor}</code>
        </>
      ) : null}{' '}
      · {source === 'fixture' ? `bundled ${meta.entityId} fixture` : 'imported dataset'}
    </p>
  );
}
