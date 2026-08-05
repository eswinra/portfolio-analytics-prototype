# Portfolio Analytics Prototype

An exploratory, presentation-ready portfolio analytics prototype built for discussion with a
public-pension Portfolio Analytics team. It demonstrates how an analyst-auditable Excel workbook
and a static web dashboard can share one validated data contract — on **wholly synthetic data**.

> **This is not an official LACERA system, performance report, audit product, or statement of
> endorsement.** Every portfolio figure belongs to the synthetic demonstration fund `DEMOFUND`.
> The only real-world values are a handful of individually cited quotations from public LACERA
> documents, labeled `reported_public` and excluded from every calculation.

## What it shows

- **Overview** — illustrative net performance vs a synthetic policy benchmark and hurdle, a
  growth-of-$1 chart, a data-trust strip, and a clearly separated market-context table.
- **Contribution** — beginning-weight × return contribution with the compounding residual
  disclosed and tested against a 10 bp tolerance (it reconciles on screen, not by assertion).
- **Allocation** — actual vs effective-dated policy targets with ranges.
- **Data quality** — the workbook's control results travel with the data; classification census;
  cited public reference values.
- **ACFR workflow** — the investment-data crosswalk and QA checklist as a filterable readiness
  board (structure from the public ACFR table of contents; statuses illustrative).
- **Import** — client-side CSV import through the documented contract with row-level rejection
  reports. Files never leave the browser.

## Architecture in one paragraph

An Excel workbook (`tools/build_workbook.py`, deterministic seed) is the system of record for
the demo dataset: inputs, calculations, controls, and a normalized 338-record export table
(schema 1.0.0). `tools/make_fixtures.py` exports that table to `data/sample/`, and the web app
(Vite + React + TypeScript strict, in `app/`) consumes it through a Zod-validated parser that
implements `docs/import-validation-rules.md`. All finance math lives in pure, unit-tested
modules (`app/src/lib/finance/`). The built site is fully static (relative base + hash routing)
and makes zero network requests.

## Local demo

```bash
cd app
npm ci
npm run dev        # development server
npm test           # 49 unit tests (finance + contract)
npm run build      # production build (tsc + vite)
npm run preview    # serve the production build
```

Regenerating the dataset end-to-end (requires desktop Excel for the QA step):
`python tools/build_workbook.py && python tools/qa_excel.py && python tools/make_fixtures.py`.

## Documentation

| Topic | Where |
|---|---|
| Discovery, concept, scope | `docs/discovery/` |
| Workbook spec / methodology / QA evidence | `docs/expanded-workbook-spec.md`, `docs/workbook-methodology.md`, `docs/workbook-qa.md` |
| Data contract, dictionary, import rules | `docs/data-contract.md`, `docs/data-dictionary.md`, `docs/import-validation-rules.md` |
| Web architecture | `docs/architecture.md` |
| Decisions / changes | `DECISIONS.md`, `CHANGELOG.md` |

## Deployment

A standard GitHub Pages workflow (`.github/workflows/pages.yml`) builds `app/` and publishes
`app/dist`. No backend, secrets, analytics, or API keys — the workflow needs only the default
Pages permissions. The app uses a relative asset base and hash routing, so it works at any
site path without configuration.

## License and data notes

Source documents referenced during discovery are public LACERA/consultant publications; they are
**not** included in this repository. Synthetic data is generated locally with a fixed seed and
may be freely regenerated. Index and product names appear nominatively for context only.
