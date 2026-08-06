# Sample data (synthetic)

`demofund_export_v1.csv` is the normalized export of the synthetic demonstration fund
`DEMOFUND` produced by the analyst workbook (`tools/build_workbook.py`, deterministic seed
20260630; exported by `tools/make_fixtures.py`). It contains **no actual portfolio data**;
the only `reported_public` rows are individually cited quotations from public LACERA
documents. Schema: 1.0.0 — see `docs/data-contract.md` and `docs/data-dictionary.md`.

`invalid/` contains deliberately malformed variants used to test the import validator
(`docs/import-validation-rules.md`). Each file name states its defect.

`demo_opeb_export_v1.csv` is the OPEB-entity equivalent (`DEMO-OPEB`), produced by the same
generator with `--entity OPEB` from its own Excel workbook. Both fixtures carry 16
`policy_target` and 4 `benchmark_definition` records (contract schema 1.1) quoting the public
IPS band structure.

Regenerate (QA steps require desktop Excel):
`python tools/build_workbook.py && python tools/qa_excel.py && python tools/make_fixtures.py`
then the same three commands with `--entity OPEB`.
