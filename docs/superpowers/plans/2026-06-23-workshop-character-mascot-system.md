# Workshop Character Mascot System Implementation Plan

> **For agentic workers:** REQUIRED FLOW: brainstorming → spec → plan → TDD in task-sized commits.
> Increment 1 sign-off is complete, but Direction 2A supersedes the visual art direction. The owner picked
> Concept A and visually signed off the seven-expression rig preview; Increment 3 is the active TDD step.

**Goal:** Replace Workshop placeholder/circle character markers with original tokenized chibi 偃师
mascots whose expressions and animations are driven only by real runtime/agent state.

**Spec:** `docs/superpowers/specs/2026-06-23-workshop-character-mascot-system-design.md`

**Brainstorm:** `docs/superpowers/notes/2026-06-23-workshop-character-redesign-brainstorm.md`

**Commit trailer on every commit:**
`Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`

## Global constraints

- No Arknights / 陈千语 asset, name, likeness, reference horn silhouette, outfit, or copied palette
  identity. Direction 2A allows an original dragon-horn Yanshi girl premise only when the horn shape,
  hair, outfit, palette, marks, and thumbnail are clearly original.
- All mascot colors come from CSS custom properties bound to existing theme/workshop tokens or explicit
  user profile accent values. No hard-coded brand colors in mascot components.
- All visible copy and accessible labels go through `i18n/en.ts` and `i18n/zh.ts`.
- Reduced motion must preserve state readability without continuous motion.
- Animations must map to real `liveAgents`, `events`, `runs`, `approvals`, provider health, and partial
  answer state. Never fake a worker as busy.
- Manager thinking covers every real ReAct decide phase, including between act/tool steps; worker/tool
  activity still waits for real assignment/action/tool events.
- Keep drag/edit behavior in `AtelierPreview` intact.
- Keep gates green:
  - `pnpm --filter @yanshi/desktop test`
  - `pnpm --filter @yanshi/desktop typecheck`
  - `pnpm --filter @yanshi/desktop build`
  - `cd runtime/python && .venv/bin/python -m pytest -p no:cacheprovider -p no:warnings`

## Increment 1 — Spec + silhouette/style concepts

- [x] Read the brief and existing Workshop/Atelier implementation.
- [x] Write the brainstorm note with 2-3 original silhouette concepts.
- [x] Write the sign-off spec under `docs/superpowers/specs/`.
- [x] Write this implementation plan.
- [x] Get user sign-off for:
  - Concept A Seal-Fin Automaton Artificers as base silhouette.
  - Concept C role props/crests as skin details.
  - Concept B thread/halo motif as state accent only.
  - Inline SVG + DOM/SVG Workshop overlay rendering.
  - Honest runtime-derived state contract.
  - Amendment: Manager thinking during every ReAct decide phase.
  - Amendment: stop after increment 2 for visual sign-off.

**Stop condition:** resolved on 2026-06-23.

## Increment 2 — Base tokenized SVG rig + expression set

**Files:**
- Create `apps/desktop/src/features/workshop/mascots/types.ts`
- Create `apps/desktop/src/features/workshop/mascots/MascotRig.tsx`
- Create `apps/desktop/src/features/workshop/mascots/MascotRig.test.tsx`
- Modify `apps/desktop/src/styles.css`

**TDD steps:**
- [x] Write failing tests that render a neutral mascot and assert:
  - `role="img"` / accessible name exists.
  - expression layers switch for `neutral`, `happy`, `thinking`, `focused`, `surprised`, `error`,
    and `sleeping`.
  - no `fill="#` / `stroke="#` hard-coded colors appear in rendered SVG markup.
  - CSS class hooks expose reduced-motion-safe state names.
- [x] Run the focused test and confirm it fails because the rig does not exist.
- [x] Implement the base rig as layered inline SVG parts:
  - shadow/ring, back hair/hood, body, head, face, front hair/hood, seal-fins, prop slot, accents.
  - All colors are `var(--ym-*)`, `currentColor`, or inherited CSS variables.
- [x] Add CSS token bindings for `.yanshi-mascot` and size variants (`rail`, `stage`, `hero`), deriving
  defaults from `--ws-*`, `--accent`, `--warning`, `--danger`, `--success`, and text tokens.
- [x] Re-run focused tests to green.
- [x] Commit: `feat(workshop): add tokenized base mascot SVG rig`

**Stop condition after this increment:** show the rendered base rig for visual sign-off. Do not build
the six role skins or integrate mascots into Workshop surfaces until that sign-off happens.

## Increment 2A — Fresh dragon-horn chibi concept previews

**Files:**
- Create `docs/superpowers/notes/2026-06-23-workshop-character-direction-2-dragon-girl-brainstorm.md`
- Create PNG/SVG previews under
  `docs/superpowers/previews/2026-06-23-workshop-character-direction-2-dragon-girl/`
- Update this plan, the spec, and continuation docs.

**Steps:**
- [x] Record the owner revision: Q-version proportions, thick outline, blank-cute face, simplified
  standing pose, and an original dragon-horn girl.
- [x] Preserve the originality guardrail: no copied reference horn silhouette, long-hair waterfall,
  tactical outfit, copied palette, floating marks, name, lore, or asset.
- [x] Brainstorm three distinct original concepts:
  - Paper-Lantern Dragon Apprentice
  - Jade-Button Dragon Page
  - Cloud-Knot Dragon Tinkerer
- [x] Render each concept as an actual PNG with neutral + happy variants.
- [x] Run the requested gates.
- [x] Commit this preview increment with the required trailer.

**Stop condition after this increment:** owner chooses one concept on pixels. Do not reskin the product
rig, build role skins, or integrate mascots until the owner picks.

## Increment 2B — Selected Concept A rig reskin preview

**Files:**
- Modify `apps/desktop/src/features/workshop/mascots/MascotRig.tsx`
- Modify `apps/desktop/src/features/workshop/mascots/MascotRig.test.tsx`
- Modify `apps/desktop/src/styles.css`
- Add selected rig preview under
  `docs/superpowers/previews/2026-06-23-workshop-character-direction-2-dragon-girl/`
- Update this plan, the spec, and continuation docs.

**TDD steps:**
- [x] Write a failing component test for the selected Paper-Lantern Dragon Apprentice skin:
  - Dragon horn layer exists.
  - Apron tab layer exists.
  - Talisman seal layer exists.
  - Superseded seal-fin layer is gone.
- [x] Confirm the focused test fails before implementation.
- [x] Reskin the existing `MascotRig` to Concept A while keeping:
  - same public component API
  - same seven-expression system
  - accessible name/status
  - reduced-motion hooks
  - token-driven CSS variables
- [x] Render a full seven-expression preview PNG from the React component.
- [x] Run the requested gates.
- [x] Commit this selected rig preview increment with the required trailer.

**Stop condition after this increment:** resolved on 2026-06-23. Owner visually signed off the selected
Concept A seven-expression rig preview.

## Increment 3 — Honest mascot state selector + reduced motion

**Files:**
- Create `apps/desktop/src/features/workshop/mascots/state.ts`
- Create `apps/desktop/src/features/workshop/mascots/state.test.ts`
- Modify `MascotRig.tsx` / CSS as needed.

**TDD steps:**
- [x] Write failing table tests for `deriveMascotState`:
  - no active run -> `idle`
  - run started before assignment -> Manager `thinking`, others `idle`
  - each ReAct decide phase between act steps -> Manager `thinking`
  - worker action/tool started -> that worker `working`
  - partial answer text -> Manager `talking`
  - pending approval -> `awaitingApproval`
  - completed -> `success` / `completed`
  - failed/tool failed/model not configured -> `error` / `failed`
  - cancelled -> `blocked` / `stopped`
  - provider not configured with no active run -> `offline` / `sleeping`
- [x] Confirm tests fail.
- [x] Implement the selector from store-shaped inputs without timers or random state.
- [x] Add reduced-motion mode: loop classes disabled, static expression/ring preserved.
- [x] Test reduced-motion output with an explicit prop.
- [x] Run the requested gates.
- [x] Commit: `feat(workshop): derive mascot animation state from runtime events`

## Increment 4 — Role skins

**Files:**
- Create `apps/desktop/src/features/workshop/mascots/skins.tsx`
- Create `apps/desktop/src/features/workshop/mascots/skins.test.tsx`
- Modify `MascotRig.tsx`

**TDD steps:**
- [ ] Write failing tests for all six roles: manager, browser, computer, file, reviewer, terminal.
- [ ] Assert every skin uses the shared rig, exposes a role-specific prop/crest, and binds role accent
  through CSS variables rather than literals.
- [ ] Implement signed-off role skins:
  - manager command fin + talisman board
  - browser compass notch + compass charm
  - computer cursor visor + cursor tablet
  - file folder clasp + document stack
  - reviewer seal stamp crest + approval stamp
  - terminal abacus-console hood + command charm
- [ ] Commit: `feat(workshop): add original role skins for yanshi mascots`

## Increment 5 — Workshop integration

**Files:**
- Modify `apps/desktop/src/features/workshop/AtelierPreview.tsx`
- Modify `apps/desktop/src/features/workshop/WorkerRail.tsx`
- Modify `apps/desktop/src/features/workshop/WorkerInspector.tsx`
- Modify tests beside those components.
- Modify `apps/desktop/src/i18n/en.ts`
- Modify `apps/desktop/src/i18n/zh.ts`

**TDD steps:**
- [ ] Extend `AtelierPreview.test.tsx` to expect mascot stage markers instead of plain circles while
  preserving pointer/drag behavior.
- [ ] Extend `WorkerRail.test.tsx` for accessible mascot avatar names and selected state.
- [ ] Extend `WorkerInspector.test.tsx` for the large selected mascot and localized status text.
- [ ] Confirm tests fail.
- [ ] Replace station circles with `MascotMarker` groups using `worldToSvg` positions and existing
  pointer handlers.
- [ ] Add rail/inspector mascot instances with localized status.
- [ ] Ensure the Workshop does not show duplicate 3D standee workers behind the DOM/SVG mascot layer.
- [ ] Commit: `feat(workshop): host honest mascots in the workshop`

## Increment 6 — Animation polish, a11y, performance, docs

**Files:**
- Modify mascot CSS/components/tests.
- Update `docs/YANSHI_ATELIER_WORKER_DESIGN.md`.
- Update continuation docs.

**TDD / verification steps:**
- [ ] Add tests for failure not celebrating, cancelled not celebrating, and no-provider offline state.
- [ ] Add or update tests for zh/en i18n key parity.
- [ ] Confirm animations use transform/opacity only; no layout-thrashing animated properties.
- [ ] Confirm off-screen/window-hidden behavior is either paused or limited to static state.
- [ ] Run all requested gates.
- [ ] Commit: `polish(workshop): finalize mascot motion and docs`

## Done definition

- User has signed off the key visual/architecture decisions.
- Original Yanshi mascots render in Workshop without Arknights likeness or assets.
- Mascot colors are theme-token-driven and reduced-motion-safe.
- State/expression/animation is derived from real runtime state.
- zh/en copy and accessible labels are complete.
- Existing Workshop edit flows still work.
- Requested desktop and runtime gates pass.
