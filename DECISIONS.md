# Decision Log

Format: date — decision — rationale — status.

| # | Date | Decision | Rationale | Status |
|---|---|---|---|---|
| 1 | 2026-08-04 | Product concept: performance & data-trust cockpit as the spine; ACFR workflow as a supporting drill-down; market context as a separated strip | Works backward from the brief's primary decision question; every widget traces to an observed public-report pattern (see `docs/discovery/concept-and-scope.md`) | Approved (discovery) |
| 2 | 2026-08-04 | Brinson attribution excluded from public v1; weighted contribution with visible reconciliation instead | Synthetic data cannot make allocation/selection/interaction reconcile credibly; contribution can be made airtight and testable | Approved (discovery) |
| 3 | 2026-08-04 | Peer-universe (InvMetrics) content excluded | Licensed data | Approved (discovery) |
| 4 | 2026-08-04 | Synthetic portfolio series are monthly; daily series only in the market-context strip; contribution compounds monthly BOP-weight contributions with a disclosed residual and tolerance | Matches observed reporting cadences; avoids implying daily official performance | Approved (discovery) |
| 5 | 2026-08-04 | No republication of Alpaca-sourced prices or any licensed index series; `reported_public` restricted to individually cited values from LACERA's own public documents | Licensing and provenance discipline | Approved (discovery) |
| 6 | 2026-08-04 | Web stack: Vite + React 18 + TypeScript strict + Zod + Vitest + PapaParse + Recharts; GitHub Pages project site; no backend/secrets/telemetry | See `docs/discovery/architecture-options.md` | Approved (discovery) |
| 7 | 2026-08-04 | Excel bridge is the system of record for demo data; web consumes a normalized export table, never presentation cells | Keeps the analyst-auditable artifact authoritative | Approved (discovery) |
| 8 | 2026-08-04 | Classification model: origin enum (`reported_public`/`synthetic`/`proxy_estimate`/`calculated`) + state overlays (`stale`/`missing`) carried as separate fields | A value can be synthetic *and* stale; conflating origin with state loses information | Approved (discovery) |
| 9 | 2026-08-04 | Starter-workbook defect `Overview!B10` (COUNTA counts table header; completion % caps at 95.8%) fixed only in the derived workbook via structured references | `reference/` is immutable | Confirmed; fix scheduled for Excel stage |
| 10 | 2026-08-04 | Demo dataset: one synthetic entity `DEMOFUND` (+ entity dimension reserved), demo fiscal year Jul 2025–Jun 2026, one daily market-strip month | Smallest history that makes FYTD/QTD/1Y meaningful | Approved (discovery) |
