# Claude Code Prompt Sequence

Use these prompts in order, one at a time, in the same project task unless a prompt says to start fresh. Review each result before continuing. Do not paste the entire file at once.

This workspace runs with **Bypass permissions** by default. That is safe here because `.claude/settings.json` enforces hard guardrails in every mode, including Bypass: edits to `reference/` and force pushes are denied outright, and any `git push`, `gh` command, `git remote add`, or `npm publish` always stops for your explicit approval. Stage discipline (what each prompt may and may not do) is enforced by the prompt text itself and by `CLAUDE.md`. The mode note beside each prompt is advisory.

---

## Prompt 1 - Independent discovery

**Mode: Bypass is fine — the prompt itself forbids project writes. Switch to Plan if you want a hard read-only guarantee for this stage.**

```text
You are at the root of this project.

Read CLAUDE.md and PROJECT_BRIEF.md first. Confirm the active stage is Discovery. Inspect the complete local reference set under reference/, including every sheet and meaningful structure in the starter workbook and the relevant pages, tables, definitions, dates, and limitations in all four public PDF reports.

Treat reference/ as read-only. This stage is strictly read-only. Do not create or modify any project file, install packages, scaffold an application, or build a workbook. Return the discovery in chat only.

I want your independent judgment. Do not merely convert possible dashboard features into a generic UI. Work backward from the Portfolio Analytics team's decisions, the evidence in the sources, and what can and cannot be supported by public or synthetic data.

Deliver:
1. A source inventory with workbook sheet/range references and PDF page references.
2. A map of what the starter workbook currently does, how its formulas and controls work, and its most important gaps.
3. The source timeline and any mixed-vintage, provider, benchmark, book-of-record, valuation-lag, or definition conflicts.
4. Two or three genuinely different product concepts, with the decision questions each would answer.
5. Your recommended concept, why it is the strongest PA-team demonstration, and what you intentionally exclude.
6. An Excel-first expansion strategy that can become the auditable bridge to a later web dashboard.
7. Realistic web architecture and hosting alternatives. The eventual public demo must be safe to host from GitHub, use no secrets or production backend, and keep uploaded files in the browser.
8. A draft data-classification and provenance model that prevents public, synthetic, proxy, calculated, stale, and missing values from being confused.
9. Major finance, data, security, usability, and presentation risks.
10. A recommended stage-by-stage implementation sequence with clear acceptance criteria.

Distinguish facts from your assumptions and recommendations. Make reasoned choices on minor details. If a material question remains, state your default recommendation and explain what evidence would change it.

Stop after the discovery and recommendation. Do not write code or files.
```

Review Claude's answer before continuing. The point of this first prompt is to see what Claude recommends without forcing a screen list or front-end framework.

---

## Prompt 2 - Pressure-test and document the approved direction

**Mode: Bypass. Documentation writes only — the prompt enforces that boundary.**

```text
The discovery direction is ready for a skeptical review. Switch the active stage to Discovery documentation. You may create or edit Markdown documentation only. Do not create application code, install dependencies, or create/modify any workbook.

Re-evaluate the proposal as four reviewers:

1. a senior public-pension portfolio analytics professional;
2. a performance-measurement and attribution specialist;
3. a data architecture, privacy, and public-release reviewer;
4. an institutional dashboard and conference-room presentation designer.

Challenge:

- metrics that cannot be supported without validated positions, beginning weights, flows, prices, FX, derivatives, fees, benchmark data, and valuation rules;
- return, contribution, attribution, allocation, and risk calculations that may not reconcile;
- mixing of annual, quarterly, monthly, and daily vintages;
- confusion between Investment Book, Accounting Book, fiduciary net position, AUM, exposure, and notional values;
- confusion between TWR, MWR/IRR, market-value change, gross, and net results;
- lagged private-market values, benchmark components, proxy exposures, estimated fees, and overlays;
- duplicated provider sections or reports that could be ingested twice;
- source lineage, ownership, freshness, validation, effective-date, and exception controls that are missing;
- confidentiality, licensing, branding, endorsement, and public-repository risks;
- features that look impressive but provide little operational value.

Revise the recommendation where the critique changes it. Then create:

- docs/discovery/source-inventory.md
- docs/discovery/workbook-assessment.md
- docs/discovery/concept-and-scope.md
- docs/discovery/architecture-options.md
- docs/discovery/data-principles.md
- docs/discovery/risks-and-open-items.md
- DECISIONS.md

Every source claim should be auditable through a sheet/range, PDF page, or public URL. Separate the approved public prototype, a future authorized internal version, and features that should not be built.

End with a concise Excel-stage acceptance checklist. Stop before creating the expanded workbook or any application code.
```

---

## Prompt 3 - Expand the Excel workbook first

**Mode: Bypass, after you approve Prompt 2.**

```text
The active stage is Excel bridge. Implement the approved Excel-first expansion.

Treat reference/Portfolio_Analytics_Market_Pulse_ACFR_Starter.xlsx as immutable. Before work, record its SHA-256 hash. Never save over, rename, move, or convert the original in place.

Create one new presentation-ready and analyst-auditable workbook at:

outputs/Portfolio_Analytics_Dashboard_Workbook_Prototype.xlsx

Also create:

- docs/expanded-workbook-spec.md
- docs/workbook-methodology.md
- docs/workbook-qa.md
- CHANGELOG.md if it does not exist

Use the approved concept, but make your own reasoned workbook-design choices. Before implementing, write a concise checklist and proposed sheet/data flow in your response; then complete the build in this turn.

The workbook must provide a coherent bridge from source/input data to calculations, controls, analyst outputs, and a future normalized dashboard export. At minimum it must support the approved subset of:

- clearly classified public and synthetic sample inputs;
- market-context inputs with source and as-of fields;
- synthetic portfolio, benchmark, policy-weight, cash-flow, and valuation inputs sufficient to demonstrate valid calculations;
- daily and cumulative period calculations using explicit period definitions;
- weighted contribution and visible reconciliation to the displayed illustrative total;
- allocation versus effective-dated policy targets;
- risk/history calculations only where the sample inputs support them;
- data-quality, completeness, freshness, tolerance, and status checks;
- an ACFR/reporting crosswalk or workflow tied to owners, status, evidence, and exceptions;
- a compact executive/analyst view that makes classifications and limitations unmistakable;
- a documented export/interface table for the later web dashboard.

Finance rules:

- Do not average component returns to produce a total-fund return.
- Use valid beginning-period weights for contribution and reconcile within a documented tolerance.
- Match portfolio and benchmark periods exactly.
- Separate market-value change, TWR, MWR/IRR, gross, and net fields.
- Keep Investment Book, Accounting Book, exposure, notional, and fiduciary values distinct.
- Treat overlays, private-market lags, estimated fees, FX, derivatives, and missing inputs explicitly.
- Carry provider, source, page/table, as-of date, period start/end, unit, currency, frequency, book of record, return method, valuation status, benchmark version/effective date, and estimate/classification fields where relevant.
- Never reproduce a current LACERA daily result. Synthetic figures must be conspicuously labeled and must not be designed to mimic undisclosed LACERA values.

Workbook quality rules:

- preserve useful conventions from the starter workbook while improving clarity;
- separate editable inputs, imported values, formulas, checks, and outputs visually;
- keep assumptions and mappings in visible cells rather than magic numbers inside formulas;
- use formulas for derived values, comments or source notes for important inputs, data validation for controlled fields, and conditional formatting for exceptions;
- include instructions, units, as-of context, a classification legend, and a clear update workflow;
- scan for formula errors, trace representative high-impact calculations, and reconcile all key totals;
- render and visually inspect every user-facing sheet; fix clipping, unreadable formats, broken charts, and confusing layouts;
- document any library or calculation limitation rather than claiming a check you could not perform.

After export, verify the original reference hash is unchanged. Report the output file, sheet map, representative formulas, reconciliation results, validation/error scan, visual-QA result, and remaining limitations.

Do not create web application code in this stage.
```

---

## Prompt 4 - Audit the workbook and lock the web data contract

**Mode: Bypass.**

```text
The active stage is Data contract. Independently audit the expanded workbook before using it as the basis for a web application.

Review it as a skeptical performance analyst and spreadsheet auditor. Verify formulas, weights, signs, units, period rollups, benchmark alignment, contribution reconciliation, risk calculations, status logic, source fields, data validation, and visible synthetic/proxy labels. Inspect every user-facing sheet visually. Confirm the original workbook under reference/ is unchanged.

Correct material issues in the derived workbook only and record each correction in CHANGELOG.md and docs/workbook-qa.md. Do not weaken or delete a failed check merely to make the workbook pass.

Then create:

- docs/data-contract.md
- docs/data-dictionary.md
- docs/import-validation-rules.md
- versioned, clearly synthetic fixtures under data/sample/

The web contract must not depend on scraping presentation cells. Define stable records or tables with, where applicable:

- entity/fund and portfolio identifiers that are explicitly synthetic;
- metric and category identifiers;
- value, unit, currency, and scale;
- observation/as-of date, period start/end, period type, and time zone;
- source type, source name/file, page/table, provider, and retrieval date;
- data classification and calculation method;
- book of record, valuation status, return method, and fee basis;
- benchmark identifier, methodology/version, and effective date;
- estimate/proxy/stale/missing flags;
- validation status, exception reason, tolerance, and lineage to inputs.

Define schema versioning, required versus optional fields, safe null behavior, duplicate detection, period compatibility, and rejection rules. Make the fixtures deterministic and obviously synthetic.

Stop after the corrected workbook, compact QA evidence, and approved data contract. Do not scaffold the web application yet.
```

---

## Prompt 5 - Build the dashboard from the approved contract

**Mode: Bypass, after you approve Prompt 4.**

```text
The active stage is Dashboard. Implement the approved product concept and data contract as the smallest maintainable, polished public prototype.

Use the technology stack recommended in discovery, or document a material reason for changing it. Requirements:

- deployable as a static GitHub Pages project with the correct project-site base path;
- no production backend, credentials, paid/licensed feed, or secret;
- synthetic fixtures and approved public citations only;
- no network transmission of user-imported workbook or CSV content;
- client-side import mapped through the documented contract, with explicit validation and useful rejection messages;
- all finance calculations in typed, pure, tested modules separate from UI components;
- visible data classification, source/as-of date, period, units, and methodology for every decision-critical metric;
- no unsupported daily official-performance claim;
- responsive, accessible, keyboard-usable design suitable for a conference-room presentation;
- restrained institutional visual language, with each chart tied to a decision question;
- deliberate loading, empty, stale, missing, malformed-import, and calculation-error states;
- a prominent statement that this is a prototype using synthetic/public data and is not an official LACERA system or performance report.

Implement the most valuable approved views; do not add modules simply because they appeared in an earlier brainstorm. The first experience should make it fast to understand what happened, what drove the illustrative result, and whether the data can be trusted.

Tests must cover every financial calculation actually shown, including applicable return compounding, active return, weighted contribution and reconciliation, allocation variance, volatility, drawdown, tracking error, period alignment, and missing/stale input behavior. Use tolerances and edge cases deliberately.

Create or update:

- a professional README.md;
- architecture and methodology documentation;
- the data dictionary and import guide;
- a visible limitations/future-state page;
- a GitHub Pages workflow, but do not run it remotely;
- local demo instructions.

Run formatting, linting, unit tests, accessibility/static checks available in the project, and the production build. Fix failures. Test the built app with the repository base path rather than only the development server.

Do not create a GitHub repository, push, or deploy. Stop with what was built, files changed, commands run, test/build results, how to launch it, and remaining limitations.
```

---

## Prompt 6 - PA-team product review and presentation mode

**Mode: Bypass.**

```text
Run the production-like application locally and review it as though you are presenting it to a public-pension Portfolio Analytics team on a conference-room screen.

Audit:

- whether the first view answers its decision question within two minutes;
- whether reported public, synthetic, proxy, calculated, stale, and missing data are impossible to confuse;
- whether every date, period, benchmark, unit, source, and valuation lag is legible;
- whether contribution and other displayed calculations reconcile to the approved workbook/fixtures;
- whether visuals add analytical meaning and remain readable at common desktop and presentation sizes;
- whether drill-downs, tables, import errors, empty states, keyboard use, focus order, contrast, and responsive layouts work;
- whether ACFR/reporting workflow content is operationally useful rather than decorative;
- whether any copy implies official status, endorsement, current actual performance, or audit assurance.

Create docs/product-review.md with severity-ranked evidence. Fix all high- and medium-severity issues and record them in CHANGELOG.md. Re-run the full test and production build pipeline.

Add a five-to-seven-minute guided demo route or clearly documented sequence only if it improves the approved concept. Create docs/demo-script.md with exact talking points, transitions, limitations, and the authorized internal data needed for a production version.

Do not push or deploy.
```

---

## Prompt 7 - Public-release audit and GitHub preparation

**Mode: Bypass. No remote changes — push and `gh` are ask-gated, so nothing remote can happen without your approval.**

```text
The active stage is Release audit. Prepare the current project for a possible public GitHub repository and GitHub Pages deployment, but do not create a remote, push, publish, or change visibility.

Inspect the actual tracked and untracked files, ignore rules, generated build, package lock, workflow, and local git history. Create docs/public-release-audit.md with evidence for:

- no files from reference/, no source PDFs/workbooks, and no local setup note are tracked;
- no non-public portfolio, holdings, manager, employee, account, credential, internal path/URL, meeting, or system information is present;
- all committed sample data is deterministic, synthetic, and visibly classified;
- no API keys, secrets, environment files, source maps, unsafe build artifacts, or confidential metadata are exposed;
- public-data quotations, citations, licenses, dependencies, and attributions are appropriate;
- branding and copy do not imply LACERA endorsement or official-system status;
- the disclaimer and methodology are visible in the built app;
- imports remain client-side and no analytics/telemetry sends imported data;
- GitHub Actions permissions are minimal and the Pages workflow needs no Anthropic key;
- project-site base-path, assets, refresh/deep-link behavior, and the built artifact work correctly;
- tests, linting, and production build pass from a clean install.

Use git check-ignore and git ls-files evidence rather than assuming .gitignore worked. Treat GitHub Actions logs and artifacts as public for a public repository.

Remove or correct unsafe material within the approved project scope, then repeat the audit. End with PASS or FAIL, any manual-review warnings, the exact proposed repository name and visibility, the exact files that would be pushed, the expected Pages URL pattern, and the exact commands you would propose.

Do not execute any remote command. Stop for my explicit approval.
```

---

## Prompt 8A - Final publish preview

**Mode: Bypass. Still no remote changes.**

Replace the placeholders before pasting.

```text
Prepare a final publication preview for GitHub owner <github-owner> and repository <repository-name>.

Do not create or modify any remote yet. Re-run the release gate and show:

1. the authenticated GitHub account and intended owner;
2. repository visibility and whether the resulting Pages site will be public;
3. current branch, final commit plan, and exact tracked file list;
4. the exact commands/actions you would execute;
5. the expected Pages URL;
6. final tests and build result;
7. explicit confirmation that reference files, office/PDF files, secrets, internal information, and real portfolio data are absent.

Stop and wait for one more explicit approval of this exact preview.
```

## Prompt 8B - Execute the approved publication

Paste only after you have reviewed Prompt 8A's exact destination, visibility, tracked files, and commands.

```text
I approve the exact publication preview you just showed. Execute only those approved commands and no broader changes.

Create the repository, commit the audited project intentionally, push the approved branch, enable the approved GitHub Pages workflow, and verify the deployed URL. Never force-push.

If the destination, account, visibility, tracked files, workflow, or build differs from the approved preview, stop before the differing action and ask me.

After deployment, report the commit SHA, repository URL, Pages URL, workflow result, and a final public-file verification.
```

---

## Correction prompts

### If Claude starts coding during discovery

```text
Stop. The active stage is read-only discovery. Do not create or modify files, and complete the evidence-based recommendation in chat.
```

### If Claude skips the Excel-first sequence

```text
Stop the web scaffold. The approved order is discovery, expanded workbook, workbook audit/data contract, then dashboard. Restore the stage boundary and finish the Excel bridge first.
```

### If Claude makes the prototype look like a retail trading terminal

```text
Rework this for an institutional public-pension investment office. Remove buy/sell language, unsupported predictions, technical-analysis widgets, neon styling, excessive animation, and decorative density. Restore decision-useful performance, contribution, allocation, risk, data-quality, reporting-control, source, and methodology hierarchy.
```

### If Claude invents or overstates portfolio performance

```text
Remove every unsupported result. A public index or weighted proxy is not official portfolio performance. Label valid figures as reported public, synthetic, proxy estimate, calculated, stale, or missing; show the exact period/source; and hide any metric whose minimum inputs are not satisfied.
```

### If Claude modifies a reference file

```text
Stop. Do not attempt another modification. Compare the reference file to its recorded SHA-256 hash, report whether it changed, and restore it only from the known original backup with my approval. Put all derived work under outputs/.
```

### If the architecture becomes too large

```text
Reduce the implementation to the smallest static, maintainable prototype that proves the approved concept. Defer authentication, production databases, scheduled ingestion, enterprise integrations, and licensed feeds to the future-state roadmap.
```
