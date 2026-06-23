# Yanshi Implementation Log

## 2026-06-23 — Workshop Character Mascot Redesign Increments 5/6

Phase: Workshop integration, honest view-model, a11y/i18n, reduced-motion polish, and final gates.

Files changed:
- `apps/desktop/src/features/workshop/AtelierPreview.tsx`
- `apps/desktop/src/features/workshop/AtelierPreview.test.tsx`
- `apps/desktop/src/features/workshop/WorkerRail.tsx`
- `apps/desktop/src/features/workshop/WorkerRail.test.tsx`
- `apps/desktop/src/features/workshop/WorkerInspector.tsx`
- `apps/desktop/src/features/workshop/WorkerInspector.test.tsx`
- `apps/desktop/src/features/workshop/WorkshopWorkspace.tsx`
- `apps/desktop/src/features/workshop/WorkshopWorkspace.test.tsx`
- `apps/desktop/src/features/workshop/mascots/viewModel.ts`
- `apps/desktop/src/features/workshop/mascots/viewModel.test.ts`
- `apps/desktop/src/features/live-office.tsx`
- `apps/desktop/src/i18n/en.ts`
- `apps/desktop/src/i18n/zh.ts`
- `apps/desktop/src/styles.css`
- `docs/YANSHI_ATELIER_WORKER_DESIGN.md`
- `docs/superpowers/specs/2026-06-23-workshop-character-mascot-system-design.md`
- `docs/superpowers/plans/2026-06-23-workshop-character-mascot-system.md`
- `IMPLEMENTATION_PLAN.md`
- `IMPLEMENTATION_LOG.md`
- `CURRENT_STATUS.md`
- `NEXT_STEPS.md`
- `ACCEPTANCE_CHECKLIST.md`

Commands run:
- `pnpm --filter @yanshi/desktop test -- WorkerRail.test.tsx WorkerInspector.test.tsx AtelierPreview.test.tsx`
  - Red: failed to find mascot `role="img"` instances before integration.
  - Green: `24 passed`, `114 tests passed`.
- `pnpm --filter @yanshi/desktop exec vitest run src/features/workshop/mascots/viewModel.test.ts src/i18n/i18n.test.ts`
  -> `2 passed`, `7 tests passed`.
- `pnpm --filter @yanshi/desktop test` -> `25 passed`, `117 tests passed`.
- `pnpm --filter @yanshi/desktop typecheck` -> passed.
- `pnpm --filter @yanshi/desktop build` -> passed with existing Vite dynamic-import/chunk-size warnings.
- `cd runtime/python && .venv/bin/python -m pytest -p no:cacheprovider -p no:warnings` -> `166 passed`.

Results:
- Added a `MascotViewModel` builder that localizes accessible names/status text and derives expression,
  busy/static state from the existing `deriveMascotState` selector.
- Wired Workshop mascot inputs from real store slices: active run id, runs, approvals, events,
  provider health, reduced-motion preference, and document visibility.
- Replaced lucide-only rail/inspector identity art with the shared role-skinned mascot rig.
- Replaced editable preview station circles with mascot markers while preserving existing station marker
  ids and drag handlers.
- Added `AtelierStage.showWorkers`; Workshop preview uses the 3D scene as room/furniture backdrop only,
  avoiding duplicate old standee workers behind the mascot overlay.
- Added zh/en mascot accessible names and status labels, covered by i18n parity and view-model tests.

Next action:
- Commit this final mascot integration increment. Remaining release work is owner-credentialed only.

## 2026-06-23 — Workshop Character Mascot Redesign Increment 4

Phase: six role skins on the signed-off Concept A shared rig.

Files changed:
- `apps/desktop/src/features/workshop/mascots/types.ts`
- `apps/desktop/src/features/workshop/mascots/skins.tsx`
- `apps/desktop/src/features/workshop/mascots/skins.test.tsx`
- `apps/desktop/src/features/workshop/mascots/MascotRig.tsx`
- `apps/desktop/src/styles.css`
- `docs/superpowers/specs/2026-06-23-workshop-character-mascot-system-design.md`
- `docs/superpowers/plans/2026-06-23-workshop-character-mascot-system.md`
- `IMPLEMENTATION_PLAN.md`
- `IMPLEMENTATION_LOG.md`
- `CURRENT_STATUS.md`
- `NEXT_STEPS.md`
- `ACCEPTANCE_CHECKLIST.md`

Commands run:
- `pnpm --filter @yanshi/desktop exec vitest run src/features/workshop/mascots/skins.test.tsx`
  - Red: failed to resolve `./skins` before implementation.
  - Green: `3 passed`.
- `pnpm --filter @yanshi/desktop test` -> `24 passed`, `111 tests passed`
- `cd runtime/python && .venv/bin/python -m pytest -p no:cacheprovider -p no:warnings` -> `166 passed`
- `pnpm --filter @yanshi/desktop typecheck` -> passed
- `pnpm --filter @yanshi/desktop build` -> passed with existing Vite dynamic-import/chunk-size warnings

Results:
- Added `MascotSkin` and `mascotRoleFromStation`, with the six signed-off roles:
  manager, browser, computer, file, reviewer, terminal.
- Extended `MascotRig` with an optional `skin` prop and role-specific prop/crest layers while preserving
  the shared rig, seven-expression system, accessible SVG semantics, and reduced-motion hooks.
- Added tokenized CSS role accents and prop styling. No hard-coded SVG fill/stroke colors were added.
- Did not integrate mascots into WorkerRail, WorkerInspector, or AtelierPreview.

Next action:
- Move to Workshop integration in Increment 5 after this commit.

## 2026-06-23 — Workshop Character Mascot Redesign Increment 3

Phase: honest mascot state selector and reduced-motion state output.

Files changed:
- `apps/desktop/src/features/workshop/mascots/state.ts`
- `apps/desktop/src/features/workshop/mascots/state.test.ts`
- `docs/superpowers/specs/2026-06-23-workshop-character-mascot-system-design.md`
- `docs/superpowers/plans/2026-06-23-workshop-character-mascot-system.md`
- `IMPLEMENTATION_PLAN.md`
- `IMPLEMENTATION_LOG.md`
- `CURRENT_STATUS.md`
- `NEXT_STEPS.md`
- `ACCEPTANCE_CHECKLIST.md`

Commands run:
- `pnpm --filter @yanshi/desktop exec vitest run src/features/workshop/mascots/state.test.ts`
  - Red: failed to resolve `./state` before implementation.
  - Green: `9 passed`.
- `pnpm --filter @yanshi/desktop test` -> `23 passed`, `108 tests passed`
- `cd runtime/python && .venv/bin/python -m pytest -p no:cacheprovider -p no:warnings` -> `166 passed`
- `pnpm --filter @yanshi/desktop typecheck` -> passed
- `pnpm --filter @yanshi/desktop build` -> passed with existing Vite dynamic-import/chunk-size warnings

Results:
- Treated the owner's "很好" as visual sign-off of the selected Concept A seven-expression rig preview.
- Added `deriveMascotState`, a pure selector that derives mascot state from store-shaped runtime inputs:
  active run, events, approvals, provider health, worker identity, partial answer text, and reduced-motion
  preference.
- Covered Manager thinking at run start and between ReAct act steps without inventing worker activity.
- Covered failed, cancelled, model-not-configured, pending approval, partial answer, provider offline,
  completed, and reduced-motion cases.

Next action:
- Proceed to role skins only after this selector increment is committed.

## 2026-06-23 — Workshop Character Mascot Redesign Direction 2B

Phase: selected Concept A rig reskin and seven-expression preview.

Files changed:
- `apps/desktop/src/features/workshop/mascots/MascotRig.tsx`
- `apps/desktop/src/features/workshop/mascots/MascotRig.test.tsx`
- `apps/desktop/src/styles.css`
- `docs/superpowers/previews/2026-06-23-workshop-character-direction-2-dragon-girl/`
- `docs/superpowers/specs/2026-06-23-workshop-character-mascot-system-design.md`
- `docs/superpowers/plans/2026-06-23-workshop-character-mascot-system.md`
- `IMPLEMENTATION_PLAN.md`
- `IMPLEMENTATION_LOG.md`
- `CURRENT_STATUS.md`
- `NEXT_STEPS.md`
- `ACCEPTANCE_CHECKLIST.md`

Commands run:
- `pnpm --filter @yanshi/desktop exec vitest run src/features/workshop/mascots/MascotRig.test.tsx`
  - Red: failed to find `mascot-layer-dragon-horns` before implementation.
  - Green: `5 passed`.
- Render selected rig preview HTML with a temporary Vitest renderer, then remove the temporary renderer.
- Render `concept-a-selected-rig-seven-expressions.png` with local Chrome headless.
- `pnpm --filter @yanshi/desktop test` -> `22 passed`, `99 tests passed`
- `cd runtime/python && .venv/bin/python -m pytest -p no:cacheprovider -p no:warnings` -> `166 passed`
- `pnpm --filter @yanshi/desktop typecheck` -> passed
- `pnpm --filter @yanshi/desktop build` -> passed with existing Vite dynamic-import/chunk-size warnings

Results:
- Reskinned the existing `MascotRig` to Concept A Paper-Lantern Dragon Apprentice while keeping the same
  public props, seven expressions, accessible SVG semantics, reduced-motion hooks, and token-driven CSS.
- Retired the seal-fin visual layer from the component and replaced it with original dragon horns, a
  short bob silhouette, workshop apron tab, talisman seal, and small paper prop.
- Exported the selected rig's seven-expression preview for owner visual sign-off.

Next action:
- Commit and stop for owner visual sign-off before role skins.

## 2026-06-23 — Workshop Character Mascot Redesign Direction 2A

Phase: fresh original dragon-horn chibi concept previews for owner pixel selection.

Files changed:
- `docs/superpowers/notes/2026-06-23-workshop-character-direction-2-dragon-girl-brainstorm.md`
- `docs/superpowers/previews/2026-06-23-workshop-character-direction-2-dragon-girl/`
- `docs/superpowers/specs/2026-06-23-workshop-character-mascot-system-design.md`
- `docs/superpowers/plans/2026-06-23-workshop-character-mascot-system.md`
- `IMPLEMENTATION_PLAN.md`
- `IMPLEMENTATION_LOG.md`
- `CURRENT_STATUS.md`
- `NEXT_STEPS.md`
- `ACCEPTANCE_CHECKLIST.md`

Commands run:
- Render previews with local Chrome headless:
  - `concept-a-paper-lantern-dragon-apprentice.png`
  - `concept-b-jade-button-dragon-page.png`
  - `concept-c-cloud-knot-dragon-tinkerer.png`
  - `direction-2a-dragon-girl-contact-sheet.png`
- `pnpm --filter @yanshi/desktop test` -> `22 passed`, `98 tests passed`
- `cd runtime/python && .venv/bin/python -m pytest -p no:cacheprovider -p no:warnings` -> `166 passed`
- `pnpm --filter @yanshi/desktop typecheck` -> passed
- `pnpm --filter @yanshi/desktop build` -> passed with existing Vite dynamic-import/chunk-size warnings

Results:
- Captured the owner revision: use the final supplied chibi image only for Q-version proportions,
  thick outline, blank-cute expression, happy face, and simplified standing pose.
- Allowed dragon horns only as an original Yanshi dragon-girl premise; copied reference horn silhouette,
  long-hair waterfall, tactical outfit, copied palette, floating marks, name, lore, and assets remain
  forbidden.
- Rendered three preview concepts for owner pixel selection before any product rig reskin.

Next action:
- Commit and stop for owner concept choice.

## 2026-06-23 — Workshop Character Mascot Redesign Increment 2

Phase: base layered-SVG rig, expression set, theme tokens, and visual sign-off checkpoint.

Files changed:
- `apps/desktop/src/features/workshop/mascots/types.ts`
- `apps/desktop/src/features/workshop/mascots/MascotRig.tsx`
- `apps/desktop/src/features/workshop/mascots/MascotRig.test.tsx`
- `apps/desktop/src/styles.css`
- `docs/superpowers/specs/2026-06-23-workshop-character-mascot-system-design.md`
- `docs/superpowers/plans/2026-06-23-workshop-character-mascot-system.md`
- `IMPLEMENTATION_PLAN.md`
- `IMPLEMENTATION_LOG.md`
- `CURRENT_STATUS.md`
- `NEXT_STEPS.md`
- `ACCEPTANCE_CHECKLIST.md`

Commands run:
- `pnpm --filter @yanshi/desktop exec vitest run src/features/workshop/mascots/MascotRig.test.tsx`
  - Red: failed to resolve `./MascotRig` before implementation.
  - Green: `4 passed`.
- `pnpm --filter @yanshi/desktop test` -> `22 passed`, `98 tests passed`
- `pnpm --filter @yanshi/desktop typecheck` -> passed
- `cd runtime/python && .venv/bin/python -m pytest -p no:cacheprovider -p no:warnings` -> `166 passed`
- `pnpm --filter @yanshi/desktop build` -> passed with existing Vite dynamic-import/chunk-size warnings

Results:
- Updated the signed-off spec with the two user amendments: Manager thinking covers every ReAct decide
  phase, and work stops after increment 2 for visual sign-off.
- Added `MascotRig`, a reusable base Seal-Fin Automaton inline SVG component with accessible name/status
  text, seven expression layers, a prop slot, state accents, and size variants.
- Added token bindings in `styles.css` using `--ym-*` variables derived from theme/workshop tokens.
- Added reduced-motion-safe class/data hooks; no role skins or Workshop integration were started.

Next action:
- Visual sign-off on the base rig. Do not build role skins until approved.

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
