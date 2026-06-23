# Yanshi Implementation Log

## 2026-06-23 — Workshop Character Mascot Redesign Increment 1

Phase: superpowers brainstorm, sign-off spec, and TDD implementation plan for original Workshop mascots.

Files changed:
- `docs/superpowers/notes/2026-06-23-workshop-character-redesign-brainstorm.md`
- `docs/superpowers/specs/2026-06-23-workshop-character-mascot-system-design.md`
- `docs/superpowers/plans/2026-06-23-workshop-character-mascot-system.md`
- `docs/YANSHI_ATELIER_WORKER_DESIGN.md`
- `IMPLEMENTATION_PLAN.md`
- `IMPLEMENTATION_LOG.md`
- `CURRENT_STATUS.md`
- `NEXT_STEPS.md`
- `ACCEPTANCE_CHECKLIST.md`

Commands run:
- `pnpm --filter @yanshi/desktop test` -> `21 passed`, `94 tests passed`
- `cd runtime/python && .venv/bin/python -m pytest -p no:cacheprovider -p no:warnings` -> `166 passed`
- `pnpm --filter @yanshi/desktop typecheck` -> passed
- `pnpm --filter @yanshi/desktop build` -> passed with existing Vite dynamic-import/chunk-size warnings

Results:
- Captured the IP boundary: the Arknights/陈千语 image is a style reference only; no asset, name,
  likeness, horn silhouette, outfit, or copied palette identity may ship.
- Brainstormed three original Yanshi concepts and recommended Concept A (Seal-Fin Automaton
  Artificers) with Concept C role props and Concept B state accents.
- Wrote the sign-off spec under `docs/superpowers/specs/` and explicitly blocked mass-produced role
  variants until user approval.
- Wrote the post-sign-off TDD plan with task-sized commits for the tokenized SVG rig, honest state
  selector, role skins, Workshop integration, reduced-motion/a11y/i18n, and gates.

Next action:
- Get user sign-off on the spec's key decisions before increment 2.

## 2026-06-23 — Handoff D Non-Credentialed Release Prep

Phase: release workflow, updater/crash config, owner handoff docs.

Files changed:
- `.github/workflows/release.yml`
- `scripts/write-tauri-release-config.mjs`
- `scripts/write-tauri-release-config.test.mjs`
- `apps/desktop/src/api/desktop.test.ts`
- `apps/desktop/src/lib/crash-reporter.test.ts`
- `docs/BUILD_AND_RELEASE.md`
- `PR_DESCRIPTION.md`
- `IMPLEMENTATION_PLAN.md`
- `IMPLEMENTATION_LOG.md`
- `CURRENT_STATUS.md`
- `NEXT_STEPS.md`
- `ACCEPTANCE_CHECKLIST.md`

Commands run:
- `node --test scripts/write-tauri-release-config.test.mjs` -> `4 passed`
- `YANSHI_RELEASE_DRY_RUN=true YANSHI_RELEASE_CONFIG_OUT=/tmp/yanshi-dry-run-tauri.conf.json node scripts/write-tauri-release-config.mjs` + JSON validation -> passed
- `ruby -e 'require "psych"; Psych.load_file(".github/workflows/release.yml"); puts "release.yml yaml ok"'` -> passed
- `cd runtime/python && .venv/bin/python -m pytest -p no:cacheprovider -p no:warnings` -> `166 passed`
- `pnpm --filter @yanshi/desktop test` -> `21 passed`, `94 tests passed`
- `pnpm --filter @yanshi/desktop typecheck` -> passed
- `pnpm --filter @yanshi/desktop build` -> passed with existing Vite dynamic-import/chunk-size warnings
- `cd apps/desktop/src-tauri && cargo check` -> passed
- `cd apps/desktop/src-tauri && cargo test` -> `12 passed`

Results:
- Added a `workflow_dispatch` `dry_run=true` path that builds the sidecar, writes/validates unsigned generated Tauri config, and runs an unsigned Tauri build without Apple secrets or release creation.
- Preserved the signed-release fail-loud guard for tag pushes and manual `dry_run=false` runs.
- Added release config generator tests for dry-run, required signing identity, complete updater env, partial updater failure, and private-key non-persistence.
- Added desktop tests proving update checks and crash reporting are inert while unconfigured.
- Expanded the owner checklist for Apple secrets, `.p12` base64 export, app-specific password creation, updater keypair generation, updater feed/public-key slots, private-key boundary, and crash DSN slot.
- Added `PR_DESCRIPTION.md` for owner push/PR prep.

Next action:
- Commit Handoff D prep on `main` with the required co-author trailer; do not push.

## 2026-06-22 — Task 5 ReAct Loop Test Reconciliation

Phase: runtime graph and tests.

Files changed:
- `runtime/python/yanshi_runtime/graph/runtime_graph.py`
- `runtime/python/tests/test_runtime.py`
- `IMPLEMENTATION_PLAN.md`
- `IMPLEMENTATION_LOG.md`
- `CURRENT_STATUS.md`
- `NEXT_STEPS.md`
- `ACCEPTANCE_CHECKLIST.md`

Commands run:
- `cd runtime/python && .venv/bin/python -m pytest -p no:cacheprovider -p no:warnings` -> initially `32 failed, 122 passed`
- Targeted 32-test migration slice -> `32 passed`
- `runtime/python/.venv/bin/python -m py_compile runtime/python/yanshi_runtime/graph/runtime_graph.py runtime/python/tests/test_runtime.py` -> passed
- `cd runtime/python && .venv/bin/python -m pytest -p no:cacheprovider -p no:warnings` -> `154 passed` before dead-code cleanup
- `cd runtime/python && .venv/bin/python -m pytest -p no:cacheprovider -p no:warnings` -> `152 passed` after dead-code cleanup

Results:
- Reconciled the 32 failing tests to the ReAct loop.
- Implemented hard-gate failure semantics using structured `missing_requirement` values.
- Added conversation history to `_provider_next_action` so follow-up turns keep prior context.
- Removed obsolete linear graph nodes and helper paths.

Issues found:
- Root continuation files required by `AGENTS.md` and `docs/CONTINUATION_PROTOCOL.md` were absent; recreated them with current state.

Next action:
- Commit Task 5 changes on `main` with the required co-author trailer; do not push.
