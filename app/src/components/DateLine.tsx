/** Explicit date separation (audit finding 4): report date, valuation date, data-through,
 *  and retrieval are different facts and are never collapsed into one "as of". */
export function DateLine({
  report,
  valuation,
  dataThrough,
  retrieved,
}: {
  report?: string;
  valuation?: string;
  dataThrough?: string;
  retrieved?: string;
}) {
  const parts = [
    report ? `Report date ${report}` : null,
    valuation ? `Actuarial valuation ${valuation}` : null,
    dataThrough ? `Data through ${dataThrough}` : null,
    retrieved ? `Quoted from ${retrieved}` : null,
  ].filter(Boolean);
  if (parts.length === 0) return null;
  return <p className="footnote date-line">{parts.join(' · ')}</p>;
}
