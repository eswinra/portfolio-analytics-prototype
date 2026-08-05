# Portfolio Analytics Prototype

## Mission

Help design and build a presentation-ready portfolio analytics prototype for discussion with a public-pension Portfolio Analytics team. The work should demonstrate possibilities while remaining analytically honest, secure, and easy for an analyst to audit.

This is an exploratory prototype. It is not an official LACERA system, official performance report, audit product, or statement of endorsement.

## Required stage order

1. Discovery: inspect the local public references and make an independent recommendation. Do not build.
2. Excel bridge: expand the starter-workbook concept into a new, auditable workbook. Never overwrite the original.
3. Data contract: validate the workbook and define the normalized interface between Excel and the web prototype.
4. Dashboard: build only after the workbook and product direction have been reviewed.
5. Release: audit the repository before any remote creation, push, or deployment.

At the start of a task, state which stage is active. Do not silently skip a stage.

## Independent judgment

- Own the product recommendation. Do not merely turn a list of possible widgets into a UI.
- Begin with the audience's decisions, the available evidence, and the data limitations.
- Compare realistic alternatives and recommend one with explicit tradeoffs.
- Ask only questions that would materially change scope, safety, or the result. Make reasoned choices on minor details.

## Source and confidentiality boundaries

- Treat everything under `reference/` as read-only. Never move, rename, edit, delete, convert in place, or overwrite those files.
- Create derived work only outside `reference/`, using clearly named versioned outputs.
- The listed references are intended to be public material. Do not add or inspect non-public holdings, employee data, account identifiers, credentials, internal URLs, meeting notes, manager-level confidential data, or internal reports without explicit organizational authorization.
- A browser upload feature in the deployed prototype must process files locally and must not transmit them. This does not mean Claude Code is an approved channel for confidential files; content Claude reads during development is processed through Anthropic's service.
- Do not place API keys or secrets in the project. Do not require a backend or paid data service for the public prototype.
- Cite public inputs with source, page or table when relevant, provider, and as-of date. Do not assume that a public source may be republished wholesale.

## Financial integrity

- Classify every displayed metric as one of: `reported_public`, `synthetic`, `proxy_estimate`, `calculated`, `stale`, or `missing`.
- Use `reported_public` only for a value reproduced from a cited public source for the exact stated period. Never label a proxy or synthetic result as official performance.
- Keep market context separate from portfolio performance. Public index moves do not equal total-fund performance.
- Distinguish return from market-value change, time-weighted from money-weighted return, gross from net, and Investment Book from Accounting Book values.
- Do not calculate a total return by averaging component returns. Contribution requires valid beginning-period weights and must reconcile to the displayed total within a documented tolerance.
- Benchmark comparisons must match dates, currency, methodology, and effective policy version.
- Preserve different reporting vintages. Never silently combine annual, quarterly, monthly, and daily values as though they share one as-of date.
- Disclose valuation lags, estimated fees, proxy exposures, overlays, cash flows, FX, derivatives, and missing data wherever they affect interpretation.
- Use explicit units, currency, time zone, period start/end, frequency, source, provider, valuation status, and calculation method.
- Avoid unsupported precision, predictions, recommendations, or audit assurance.

## Product and visual standards

- Design for institutional investment-office use, not retail trading.
- Each page and chart must answer a decision question. Prefer a compact table when it is clearer than a chart.
- Optimize the main view for a conference-room screen and a two-minute executive read, while retaining drill-down detail for analysts.
- Use restrained color, readable typography, clear units, visible as-of dates, and accessible controls.
- Include useful loading, empty, missing, stale, validation, and error states.
- Clearly separate current demo capability, a future authorized internal system, and features that should not be built.

## Engineering standards

- The first public prototype must be deployable as a static GitHub Pages project without a production backend or secrets.
- Let discovery determine the exact front-end stack; document why it is appropriate.
- Keep schemas and financial calculations separate from presentation components.
- Use strict types, validation at import boundaries, deterministic synthetic fixtures, and pure tested calculation functions.
- Workbook or CSV imports must remain in the browser. Malformed input must fail clearly without partial or misleading results.
- Document the data dictionary, methodology, architecture, limitations, local setup, and deployment path.
- Run formatting, linting, unit tests, and a production build before declaring the web prototype complete.
- Use a normal static Pages workflow. Do not add Claude Code Action or an Anthropic API key merely to deploy the site.

## Working conventions

- Use relative project paths in committed files; do not publish local Windows paths.
- Put synthetic, reviewable sample inputs under `data/sample/` or the application's public sample-data directory.
- Put local generated workbooks, exports, renders, and screenshots under `outputs/`; this directory is ignored.
- Maintain `DECISIONS.md` once implementation decisions begin and `CHANGELOG.md` once artifacts change.
- Inspect existing files before editing. Preserve user work and make incremental, testable changes.
- Do not create a remote repository, push, publish, or change repository visibility without explicit user approval at that step.
- Never force-push.

## Completion report

For each implementation stage, report:

- the outcome and important decisions;
- files created or changed;
- commands and checks run;
- test, build, formula, and visual-QA results as applicable;
- facts, assumptions, estimates, limitations, and open items.
