import { useDataset } from '../lib/dataset/useDataset';

/**
 * Per-view freshness: the newest as-of in the active dataset and who entered that row —
 * stale data is the silent team risk, so every data view states its own age. Actor labels
 * come from the file's provenance columns (synthetic labels in the bundled fixtures).
 */
export function FreshnessLine() {
  const { dataset, source } = useDataset();
  const { freshness, marketDate, meta } = dataset;
  if (!freshness.latestAsOf) return null;
  return (
    <p className="footnote freshness-line">
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
