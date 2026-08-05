# Public Release Audit — stage 7

Audited 2026-08-04 against the actual git index, ignore rules, history, and a clean clone.
**No remote was created and nothing was pushed; every command below marked "proposed" is
unexecuted and awaits explicit approval.**

## Verdict: **PASS** (with 3 manual-review warnings listed at the end)

## Evidence

### 1. Tracked-file inventory (78 files)

`git ls-files` summary: `.claude/settings.json` (1), `.gitattributes`, `.github/workflows/pages.yml`,
`.gitignore`, top-level docs (`CHANGELOG.md`, `CLAUDE.md`, `DECISIONS.md`, `PROJECT_BRIEF.md`,
`PROMPTS.md`, `README.md`), `app/` (35: configs + src + package-lock), `data/` (11: sample fixture,
8 invalid fixtures, sample README), `docs/` (16), `reference/` (**only** `.gitkeep` and
`README.md`), `tools/` (4 generator/QA/audit/fixture scripts).

- **No reference source files tracked**: `git ls-files | grep -iE '\.(pdf|xlsx?|xlsm|docx?)$'`
  returns nothing; `git check-ignore` confirms `reference/*.pdf`, `reference/*.xlsx`,
  `outputs/**` (workbook + renders), `app/dist/**`, `app/node_modules/**` are all ignored.
- **No local setup note**: `/README_SETUP.md` and `/.local-reference-sha256.txt` ignored and
  absent from the index.
- Working tree clean at audit time.

### 2. Confidentiality and data

- No non-public portfolio/holdings/manager/employee/account/system information: the only
  real-world values in the repository are the 8 cited `public_reference` rows in
  `data/sample/demofund_export_v1.csv` (each quoting a public LACERA document with page-level
  citation). All other data is deterministic synthetic output of `tools/build_workbook.py`
  (seed 20260630) and visibly classified.
- No local Windows paths in any tracked file (`git grep` for `C:\Users|/c/Users|AppData`: no
  matches).
- No internal URLs; the only external URL in tracked content is the public
  `lacera.gov/...ACFR-2025.pdf` citation inside `tools/build_workbook.py`.

### 3. Secrets

- Pattern scan (`api key|secret|token|password|private key|sk-ant|ghp_`) over tracked files:
  only policy text (deny rules, documentation) — zero credentials.
- Full-history scan (`git log --all -p`) for key/token patterns: **zero matches** — nothing to
  scrub from history.
- No `.env*` files tracked; `.gitignore` blocks them.

### 4. Licensing, quotation, attribution

- Public-data quotations are limited to 8 individually cited values (facts, minimal extent);
  no report text republished; index/product names appear nominatively only; the starter's
  Alpaca-sourced market values were replaced by synthetic series everywhere.
- Dependencies: standard MIT/ISC-ecosystem packages (React, Vite, Zod, PapaParse, Recharts,
  Vitest, ESLint, Prettier); `app/package-lock.json` tracked for reproducibility.

### 5. Branding / endorsement

- App title "Portfolio Analytics Prototype — synthetic demo"; persistent disclaimer band,
  footer, README block and Limitations page all state it is **not** an official LACERA system
  or performance report. No LACERA logo or branding assets anywhere. Repository name proposal
  is neutral (below).

### 6. Client-side boundary / telemetry

- `git grep` for `fetch(|XMLHttpRequest|WebSocket|sendBeacon|axios` in `app/src`: **no
  matches** — the app makes zero network requests; imports are FileReader-only; no analytics.
- No external fonts/CDNs; everything bundled.

### 7. CI / Pages workflow

- `.github/workflows/pages.yml`: permissions limited to `contents: read`, `pages: write`,
  `id-token: write`; no secrets consumed; no Anthropic key or Claude action; runs
  `npm ci && npm test && npm run build` then standard `upload-pages-artifact`/`deploy-pages`.
  Workflow logs would expose only test/build output of tracked code (safe for a public repo).

### 8. Built artifact

- Relative base + hash routing verified under a simulated project subpath in stages 5–6
  (deep links `…/#/contribution` refresh correctly; assets load; zero console errors).
- No source maps emitted (`dist/assets/*.map` absent in clean-clone build).
- Disclaimer visible in the built app (browser-verified).

### 9. Clean-install pipeline (from a clone containing only tracked files)

```
git clone --local . <tmp> && cd <tmp>/app
npm ci            → OK
npm test          → 49/49 passed
npm run lint      → OK
npm run build     → OK (tsc -b + vite build)
```

This also proves the bundled fixture path (`data/sample/…?raw`) resolves from tracked files.

## Manual-review warnings (decisions for the owner, not blockers)

1. **No LICENSE file.** A public repo without a license is "all rights reserved."
   Recommendation: add MIT for the code before or immediately after publication (I can add it
   on approval).
2. **Process-meta files would be public**: `CLAUDE.md`, `PROMPTS.md`, `PROJECT_BRIEF.md`,
   `.claude/settings.json` document how the prototype was built (no secrets, verified).
   Default recommendation: keep them — they honestly document methodology and guardrails; say
   the word if you'd rather exclude them first.
3. **Repository owner/visibility**: Pages on a personal account requires a **public**
   repository (private-repo Pages needs a paid plan). Confirm owner and public visibility in
   the 8A preview.

## Proposed publication (NOT executed)

- **Repository name:** `portfolio-analytics-prototype`
- **Visibility:** public (required for Pages on a free personal account); resulting Pages site
  will be public.
- **Branch:** `main` (current local history, 9 commits, no force-push ever).
- **Files pushed:** exactly the 78 tracked files inventoried above.
- **Expected Pages URL pattern:** `https://<github-owner>.github.io/portfolio-analytics-prototype/`
- **Exact proposed commands (awaiting approval; placeholders resolved in the 8A preview):**

```bash
gh auth status                                    # confirm authenticated account = intended owner
gh repo create <owner>/portfolio-analytics-prototype --public --source . --remote origin --push
gh api -X POST repos/<owner>/portfolio-analytics-prototype/pages -f build_type=workflow
gh run watch                                      # observe the Pages workflow
```

**Stop point:** per the stage protocol, execution requires the explicit 8A preview approval.
