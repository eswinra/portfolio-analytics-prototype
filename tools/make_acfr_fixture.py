"""Generate data/sample/demo_acfr_status_v1.csv — the ACFR section-readiness board fixture.

Contract records (schema 1.3), one entity DEMO-ACFR per V17:
  - acfr_section_status: one row PER STATUS CHANGE (history-in-the-file gives the change log
    the team asked for); value = status token, page_table = draft version, period_end = due
    date, entered_by = synthetic actor label.
  - acfr_artifact_link: one row per tracked artifact; value 1 + ok = received, blank +
    missing = outstanding; note carries a SYNTHETIC link placeholder, never a real URL.

Statuses, dates, owners and links are illustrative demo values.
"""
import csv
import io
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "data", "sample", "demo_acfr_status_v1.csv")

HDR = ["record_id", "record_type", "entity_id", "metric_id", "category_id", "value", "unit",
       "currency", "scale", "as_of_date", "period_start", "period_end", "period_type",
       "frequency", "classification", "source_type", "source_name", "page_table", "provider",
       "retrieved_date", "book_of_record", "return_method", "gross_net", "valuation_status",
       "benchmark_id", "method_id", "quality_status", "note", "schema_version",
       "entered_by", "reviewed_by", "review_status"]

rows = []
_n = [0]

def row(record_type, metric_id, section, value, asof, due="", version="", qs="ok", note="",
        entered="PA-LEAD-1", source="ACFR tracker"):
    _n[0] += 1
    rows.append([
        f"ACF-{_n[0]:04d}", record_type, "DEMO-ACFR", metric_id, section, value, "1", "USD",
        "1", asof, "", due, "", "Ad Hoc", "synthetic", "synthetic_generator",
        source, version, "synthetic generator", "2026-08-13", "n/a", "n/a", "n/a",
        "final", "", "", qs, note, "1.3.0", entered, "PA-LEAD-1", "published",
    ])

# (section, due date, status history [(date, status, version, actor)])
SECTIONS = [
    ("INTRO", "2026-09-29", [("2026-07-06", "in_progress", "v1", "PA-ANALYST-1"),
                             ("2026-07-27", "in_review", "v1", "PA-LEAD-1"),
                             ("2026-08-05", "complete", "v1", "PA-LEAD-1")]),
    ("FIN", "2026-10-27", [("2026-07-13", "not_started", "", "PA-ANALYST-1"),
                           ("2026-08-03", "in_progress", "v1", "PA-ANALYST-1")]),
    ("INV", "2026-10-13", [("2026-07-06", "in_progress", "v1", "PA-ANALYST-2"),
                           ("2026-07-20", "in_review", "v1", "PA-LEAD-1"),
                           ("2026-08-10", "in_review", "v2", "PA-LEAD-1")]),
    ("ACT", "2026-11-03", [("2026-07-13", "not_started", "", "PA-ANALYST-1")]),
    ("STAT", "2026-10-20", [("2026-07-06", "in_progress", "v1", "PA-ANALYST-2"),
                            ("2026-08-07", "ready_signoff", "v3", "PA-LEAD-1")]),
]
for section, due, history in SECTIONS:
    for asof, status, version, actor in history:
        row("acfr_section_status", "section_status", section, status, asof, due=due,
            version=version, entered=actor)

# (section, artifact title, received?, version)
ARTIFACTS = [
    ("INTRO", "Letter of transmittal draft", True, "v1"),
    ("INTRO", "GFOA certificate page", True, "v1"),
    ("FIN", "Statement of fiduciary net position", True, "v1"),
    ("FIN", "Statement of changes in fiduciary net position", False, ""),
    ("FIN", "Notes to financial statements", False, ""),
    ("INV", "Investment results by asset class", True, "v2"),
    ("INV", "Largest holdings schedules", True, "v1"),
    ("INV", "Fee and commission schedules", False, ""),
    ("INV", "Investment summary tie-out", True, "v2"),
    ("ACT", "Actuarial certification letter", False, ""),
    ("ACT", "Schedule of funding progress", False, ""),
    ("STAT", "Ten-year trend schedules", True, "v3"),
    ("STAT", "Membership statistics", True, "v3"),
]
for section, title, received, version in ARTIFACTS:
    # metric_id is a per-artifact slug so each artifact carries its own V05 natural key;
    # the human title travels in source_name.
    slug = "artifact:" + title.lower().replace(" ", "-")
    row("acfr_artifact_link", slug, section, "1" if received else "", "2026-08-10",
        version=version, qs="ok" if received else "missing", source=title,
        note=(f"link: sharepoint://demo-placeholder/{section.lower()}/"
              f"{title.lower().replace(' ', '-')} (synthetic)"),
        entered="PA-ANALYST-2" if not received else "PA-ANALYST-1")

with io.open(OUT, "w", encoding="utf-8", newline="") as f:
    w = csv.writer(f, lineterminator="\n")
    w.writerow(HDR)
    w.writerows(rows)
print(f"wrote {OUT} ({len(rows)} records)")
