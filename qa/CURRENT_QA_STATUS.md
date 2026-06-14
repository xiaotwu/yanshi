# Current QA Status

_Updated 2026-06-13 (spec alignment audit pass)._

## Active workflow

- **Claude Code** — design, implementation, cleanup, and bug fixing. Latest reports live in the
  per-pass directories below.
- **Codex** — independent validation / review. **Codex is the active validation agent going
  forward.**
- **User** — final product and release decisions, plus human-only verification.
- **Junie** — historical only, no longer part of the workflow. (Junie evidence directories were
  removed in an earlier cleanup; do not request or wait for Junie reviews.)

## Latest passing validation

- **Claude full validation** (2026-06-13, `claude-full-validation/`) — **PASS** for the v0.1 Local
  Final Candidate, performed independently by Claude (not Codex) at the user's direction. Covered
  automated suites, packaged-app lifecycle (0 orphans), no-mock audit (Provider/Browser/File/ACP/
  MCP — real work or honest blocker), secret audit (key only in the 0600 store), and a real run
  end-to-end. Only remaining items are external/human (Apple Developer ID + host grants). See
  `claude-full-validation/FULL_VALIDATION_REPORT.md`.
- **Codex global review** (2026-06-12) — **Passed** for the v0.1 Local Final Candidate review;
  **no active P0/P1/P2 product bugs**. See `codex-global-review/GLOBAL_REVIEW_REPORT.md` and
  `codex-global-review/BUGS_FOR_CLAUDE.md`.
- **Codex docs-site review** (`codex-docs-site-review/DOCS_SITE_REVIEW.md`) and **README update**
  (`codex-readme-update/README_UPDATE_REPORT.md`) — both completed.
- **Spec alignment audit** (2026-06-13, `claude-spec-alignment/`) — product aligned with all
  latest product decisions across 33 areas; no P0/P1/P2 mismatches; only repair was a dead-i18n-key
  cleanup.
- Full automated suite green: `pnpm lint` / `typecheck` / `test`, `pnpm docs:build` (+ base-path
  build), `pytest`, `cargo check`/`test`.

## Active known issues

No open product bugs. Remaining items are external/human-only blockers and deferred features —
see `CURRENT_STATUS.md` ("Active known blockers") and `NEXT_STEPS.md`.

## Directory map (current)

| Directory | Status | Content |
|---|---|---|
| `claude-spec-alignment/` | current | spec alignment matrix + repair report |
| `claude-repo-cleanup/` | current | repository cleanup report |
| `docs-site-pass/` | current | docs-site build pass report + screenshots |
| `codex-global-review/` | **active validation reference** | latest Codex global review (no active bugs) |
| `codex-docs-site-review/` | current | Codex review of the docs site |
| `codex-readme-update/` | current | Codex README-update report |
| `codex-progress-reconciliation/` | current | Codex progress reconciliation |
| `claude-error-toast-cleanup/` | current | error-toast + display cleanup report |
| `claude-close-station-pass/` | current | close behavior + worker stations report |
| `atelier-worker-redesign-pass/` | current | Yanshi Puppets worker redesign + screenshots |
| `atelier-worker-design-pass/` | historical | worker design system pass |
| `atelier-refinement-pass/` | historical | Atelier reopen fix + naming pass |
| `manual-uiux-acp-pass/` | historical | Settings/ACP pass smoke evidence |
| `ux-refinement-pass/` | historical | earlier Claude UX pass evidence |
| `codex-ux-refinement-review/` | historical | early Codex review + resolved BUGS (archived header) |
| `codex-final-product-audit/` | historical | first Codex audit + resolved BUGS (archived header) |

All `BUGS_FOR_CLAUDE.md` files in the historical directories carry an "Archived / Resolved"
header; the only active bugs file (`codex-global-review/BUGS_FOR_CLAUDE.md`) lists **no active
P0/P1/P2**. QA run debris (local runtime data, secret stores, exported test packs, raw process
logs) is not committed — see `.gitignore`.
