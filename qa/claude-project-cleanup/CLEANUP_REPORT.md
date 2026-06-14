# Project Cleanup Pass Report (2026-06-11)

## 1. Verdict

**PASS** — docs-and-QA-only cleanup; no source-code behavior changed; suite green.

## 2. What was cleaned

- QA tree reorganized around the new workflow (Claude Code implements, Codex validates, Junie
  archived) with a single index: `qa/CURRENT_QA_STATUS.md`.
- Stale "active bugs" surfaces neutralized: every `BUGS_FOR_CLAUDE.md` (Junie global acceptance,
  Codex final-product audit, Codex UX review) now opens with an **"Archived / Resolved"** header
  pointing to its CLAUDE_FIX_RESULTS and to the current QA index.
- Status docs de-duplicated: `CURRENT_STATUS.md` had 8 stacked historical banners — now one
  clean **v0.1 Final Product Candidate** snapshot (history stays in IMPLEMENTATION_LOG.md).
- `ACCEPTANCE_CHECKLIST.md` restructured into: Passed · Needs human verification · Blocked by
  external requirements · Deferred to later version · Archived historical (all nine pass logs
  preserved under the archive section; no fixed issue is listed as active).
- `NEXT_STEPS.md` rewritten to the new sequence: cleanup → Claude fixes (none open) → Codex
  focused validation → freeze v0.1 → user packaged pass → signing/notarization.
- Stale wording: `IMPLEMENTATION_PLAN.md` marked historical (superseded by
  CURRENT_STATUS/NEXT_STEPS); `docs/RELEASE_NOTES_RC.md` marked "RC → Final Product Candidate"
  (no public-release claim — signing still pending); README "Live Office" → "Yanshi Atelier
  (偃师工坊; internal package name `live-office`)"; AGENTS.md gained the workflow + terminology
  section (Chat / Files / Yanshi Atelier / 偃师·偃师工坊) and a note that the shipped IA
  superseded the original New Task/Runs/Artifacts nav.

## 3. What was archived (moved, nothing lost)

- `qa/junie-global-acceptance/` → `qa/junie-archive/junie-global-acceptance/` (kept as the
  historical external acceptance reference, incl. its CLAUDE_FIX_RESULTS).
- `qa/junie-atelier-worker-review/` → `qa/junie-archive/junie-atelier-worker-review/`
  (evidence-only Junie session: logs + screenshots).
- All references in CURRENT_STATUS / NEXT_STEPS / ACCEPTANCE_CHECKLIST / IMPLEMENTATION_LOG
  updated to the new paths.

## 4. What was deleted (gitignored generated/temp only)

- `.DS_Store` × 9 (repo-wide, outside node_modules/target).
- `runtime/python` `__pycache__/` directories + `.pytest_cache/`.
- `.playwright-mcp/` scratch — 81 Playwright session snapshots/console logs from agent smoke
  runs; every screenshot referenced by a report was already copied into `qa/*/SCREENSHOTS`.
- Nothing else: node_modules, lockfiles, test fixtures (`qa/codex-ux-refinement-review/
  runtime-data/`), packaged `.app`/`.dmg` (in gitignored `target/`), and all current reports
  untouched.

## 5. Docs updated

`CURRENT_STATUS.md`, `NEXT_STEPS.md`, `ACCEPTANCE_CHECKLIST.md`, `IMPLEMENTATION_LOG.md`
(+cleanup entry), `IMPLEMENTATION_PLAN.md`, `AGENTS.md`, `README.md`,
`docs/RELEASE_NOTES_RC.md`, new `qa/CURRENT_QA_STATUS.md`, this report.
(`docs/BUILD_AND_RELEASE.md`, `docs/UI_INTERACTION_MODEL.md`, `docs/FINAL_PRODUCT_GAPS.md`
checked — no Junie references or stale RC wording found; unchanged.)

## 6. Current active workflow

- **Claude Code** — design / implementation / bug fixing.
- **Codex** — independent validation / regression QA (next validation comes from Codex).
- **User** — final product decisions + human-only verification.
- **Junie** — historical only (`qa/junie-archive/`).

## 7. Current active known issues

No open product bugs. Blockers (external/human-only): codesign/notarization + Gatekeeper
second-machine check; packaged Chromium provisioning; Accessibility/Screen Recording grants;
human glances (titlebar baseline, reduced motion, dark-scene brightness); live-provider chat
test. Deferred features tracked in NEXT_STEPS.md.

## 8. Commands run

`pnpm lint` PASS · `pnpm typecheck` PASS · `pnpm test` PASS (34/34) · `pnpm build` PASS.
(pytest/cargo/desktop:release not run — no runtime, Rust, or package-affecting files changed;
only docs, QA files, and gitignored temp deletions.)

## 9. Source code behavior changed?

**No.** Zero changes under `apps/`, `packages/`, or `runtime/` source.

## 10. Ready for the next Claude implementation pass?

**Yes.** Clean status docs, single QA index, no stale active-bug files, archived Junie material,
and a green suite. Recommended next step: Codex focused validation of the recently changed areas
(see NEXT_STEPS.md step 3), then freeze v0.1.
