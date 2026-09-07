import { CLASS_DEFINITIONS } from './ui';

/** Terms used across the site, in one place reachable from every page (the footer). Plain
 *  `<details>` so it works without script and prints open when expanded. Definitions describe
 *  how the term is used HERE — they are not a substitute for the documents' own definitions. */

const TERMS: [term: string, definition: string][] = [
  [
    'TWR — time-weighted return',
    'Return that removes the effect of money moving in and out, so it measures the portfolio, not the timing of contributions. All returns shown are TWR net of investment-management fees unless stated.',
  ],
  [
    'MWR — money-weighted return',
    'Return that includes the effect of cash-flow timing (an internal rate of return). The ACFR reports it alongside TWR; the two are not comparable and are never mixed here.',
  ],
  [
    'Policy benchmark',
    'The blend of market indices the Board adopted for the fund or a composite. Excess = fund − benchmark, in percentage points, and is calculated on this site from the quoted figures.',
  ],
  [
    'Actuarial hurdle / assumed rate of return',
    'The investment return the actuary assumes when valuing liabilities. Clearing it over long periods matters for funding; it is not a benchmark of manager skill.',
  ],
  [
    'FYTD — fiscal year to date',
    "LACERA's fiscal year ends June 30, so FYTD runs from July 1. At June 30 the FYTD and one-year columns cover the same span but remain separate printed columns.",
  ],
  [
    'SAA — strategic asset allocation, target and ½-step target',
    'The long-term policy mix and its ranges (IPS Table 1). The ½-step target is the interim allocation in force while the fund transitions toward the long-term target; a compliance statement must name which version it uses.',
  ],
  [
    'Drift, range and “near bound”',
    'Drift is the actual weight minus the target. The IPS range is the band around the target; “near bound” flags a weight within one percentage point of a boundary. Range status is a factual report — the IPS defines no mechanical trade trigger.',
  ],
  [
    'IBOR / ABOR',
    'Investment Book of Record (positions as the investment team sees them, including pending activity) and Accounting Book of Record (the accounting basis behind the financial statements). Values differ; the custodian remains the official book of record.',
  ],
  [
    'Fiduciary net position',
    'The plan’s assets less its liabilities as reported in the financial statements — the figure the annual reports track. It is not the same as the investment portfolio’s market value on a monthly report.',
  ],
  [
    'Funded ratio and UAAL',
    'The share of the actuarial liability covered by valuation assets, and the unfunded actuarial accrued liability. Both come from the actuarial valuation, which is dated separately from the financial statements.',
  ],
  [
    'Basis point (bp) and percentage point (pp)',
    'A percentage point is the difference between two percentages; a basis point is one hundredth of a percentage point.',
  ],
  [
    'Lagged benchmark',
    'Private-market benchmarks are reported one to three months behind (IPS Table 2), so a same-period comparison mixes vintages by design.',
  ],
];

export function Glossary() {
  return (
    <details className="glossary" id="glossary">
      <summary>Definitions — terms and classifications used on this site</summary>
      <div className="glossary-body">
        <dl>
          {TERMS.map(([t, d]) => (
            <div key={t}>
              <dt>{t}</dt>
              <dd>{d}</dd>
            </div>
          ))}
          {Object.entries(CLASS_DEFINITIONS).map(([c, d]) => (
            <div key={c}>
              <dt>{c.replace('_', ' ')} (classification)</dt>
              <dd>{d}</dd>
            </div>
          ))}
        </dl>
        <p className="footnote">
          These describe how each term is used on this prototype. The governing definitions are
          those in the cited documents.
        </p>
      </div>
    </details>
  );
}

/** Opens the footer glossary and scrolls to it — usable from any view. */
export function GlossaryLink({ children = 'Definitions' }: { children?: string }) {
  return (
    <button
      type="button"
      className="linklike"
      onClick={() => {
        const el = document.getElementById('glossary');
        if (el instanceof HTMLDetailsElement) el.open = true;
        el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }}
    >
      {children}
    </button>
  );
}
