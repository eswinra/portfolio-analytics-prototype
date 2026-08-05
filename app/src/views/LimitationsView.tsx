import { Panel } from '../components/ui';

/** Honest boundary: what this demo is, what a real system would need, what should not be built. */

export function LimitationsView() {
  return (
    <>
      <h1>Limitations &amp; future state</h1>

      <Panel title="What this prototype is">
        <ul>
          <li>
            A demonstration of decision-useful portfolio analytics on{' '}
            <strong>synthetic data</strong>: valid return math, contribution that visibly
            reconciles, allocation vs effective-dated targets, explicit data-quality states, and an
            ACFR workflow board.
          </li>
          <li>
            A working Excel→web bridge: the analyst workbook is the system of record; this app
            consumes its normalized export through a documented, validated contract.
          </li>
          <li>
            Static hosting only — no backend, no credentials, no telemetry; imports stay in the
            browser.
          </li>
        </ul>
      </Panel>

      <Panel title="What it deliberately does not show">
        <ul>
          <li>
            No actual LACERA performance, positions, managers, or holdings — the few cited public
            values are labeled <code>reported_public</code> and sit outside every calculation.
          </li>
          <li>
            No daily total-fund return: an actual daily result requires validated holdings, flows,
            prices, FX, derivatives, overlays, fees and reconciliation to the official performance
            process.
          </li>
          <li>
            No Brinson attribution, peer universes, manager scorecards, or risk analytics — excluded
            where synthetic data could not make them reconcile credibly, or where source data is
            licensed.
          </li>
          <li>No predictions, recommendations, or trading affordances.</li>
        </ul>
      </Panel>

      <Panel title="What a future authorized internal version would need">
        <ul>
          <li>
            Authorized feeds: custodian/IBOR positions and beginning weights, cash flows, prices,
            FX, derivatives and overlay data, fee accruals, benchmark licenses, valuation rules.
          </li>
          <li>
            True TWR/MWR calculation reconciled to the official performance book; lagged
            private-market benchmark handling; IBOR↔ABOR reconciliation feeds.
          </li>
          <li>
            Attribution, manager-level views, compliance and exception feeds, entitlements, audit
            logging, scheduled ingestion with lineage.
          </li>
        </ul>
      </Panel>

      <Panel title="Methodology (this demo)">
        <ul>
          <li>
            Total return = Σ(beginning weight × category return), chain-linked monthly — never an
            average of returns.
          </li>
          <li>
            Contribution = beginning-of-month weight × monthly return, summed to QTD; the
            compounding residual is disclosed and must stay within 10 bps.
          </li>
          <li>
            Benchmark = effective-dated policy weights × synthetic category benchmark returns.
          </li>
          <li>
            Stale/missing are derived states with per-frequency thresholds; missing never renders as
            zero.
          </li>
          <li>
            Full details: <code>docs/workbook-methodology.md</code> and{' '}
            <code>docs/data-contract.md</code> in the repository.
          </li>
        </ul>
      </Panel>
    </>
  );
}
