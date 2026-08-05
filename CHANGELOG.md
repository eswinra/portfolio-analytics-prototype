# Changelog

## 2026-08-04 — Stage 3: Excel bridge

- Created `outputs/Portfolio_Analytics_Dashboard_Workbook_Prototype.xlsx` (14 sheets, 338-record
  normalized export table, schema 1.0.0) via deterministic generator `tools/build_workbook.py`
  (seed 20260630).
- Added Excel-COM QA harness `tools/qa_excel.py`: full recalculation, comparison against an
  independent Python recomputation, formula-error scan, per-sheet PDF renders
  (`outputs/renders/`).
- QA result: all computed values match Python expectations (≤1e-9); 10 PASS / 2 deliberate
  WARN / 0 FAIL controls; zero formula errors. Evidence in `docs/workbook-qa.md`.
- Fixed during build: bare-table-name `#NAME?` formulas, export-count COUNTA fragility,
  data-validation `=` prefixes, clipped labels, wrapped-row heights.
- Corrected the starter's `Overview!B10` defect class in the derived trackers by using
  structured references (CHK-10/CHK-11).
- Verified `reference/` starter workbook SHA-256 unchanged
  (`120d466ff8fadf73…c793d32`).
- Documentation: `docs/expanded-workbook-spec.md`, `docs/workbook-methodology.md`,
  `docs/workbook-qa.md`.

## 2026-08-04 — Stage 2: Discovery documentation

- Added `docs/discovery/` (source inventory, workbook assessment, concept and scope,
  architecture options, data principles, risks and open items) and `DECISIONS.md` after the
  four-reviewer pressure test. Key scope changes: Brinson attribution deferred, peer-universe
  data excluded, monthly portfolio granularity, no Alpaca price republication.
