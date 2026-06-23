# Yanshi Acceptance Checklist

## Task 5 Runtime Loop

- [x] Tool tasks require a configured provider.
- [x] Missing provider fails with explicit `model_not_configured`.
- [x] Safety-blocked tasks fail with `permission_boundary` before provider calls.
- [x] Plan-first runs pause for approval and resume through the loop.
- [x] Disabled tools fail with `tool_disabled`.
- [x] Worker ability whitelist blocks fail with `tool_not_in_worker_abilities`.
- [x] Invalid Docker settings fail with `docker_config_invalid`.
- [x] Real file, browser, computer, terminal, Docker, artifact, project, and automation paths are exercised by tests.
- [x] Follow-up chat history reaches the manager decision prompt.
- [x] Dead linear graph helpers are removed.
- [x] Runtime test suite passes after cleanup.

## Handoff D Release Prep

- [x] Signed release workflow fails loudly before build when required Apple secrets are absent.
- [x] Manual workflow dry run builds and validates unsigned release config without Apple signing/notarization secrets.
- [x] Generated release config reads updater public key/feed from env and fails on partial updater setup.
- [x] Updater private key is never written to generated config or repo files.
- [x] Crash reporter remains disabled/inert when no DSN is configured.
- [x] Owner checklist documents each GitHub secret/variable slot, `.p12` base64 export, app-specific password creation, updater keypair generation, and DSN setup.
- [x] PR description is prepared locally; no push/PR opened.
- [x] Requested runtime, desktop, and Rust gates pass.

## Workshop Character Mascot Redesign — Increment 1

- [x] Brief read and IP boundary captured.
- [x] Brainstorm note includes 2-3 original Yanshi silhouette/style concepts.
- [x] Spec under `docs/superpowers/specs/` records key decisions for sign-off.
- [x] Plan under `docs/superpowers/plans/` decomposes post-sign-off implementation into TDD commits.
- [x] No Arknights asset, name, or likeness is shipped.
- [x] User has signed off the key decisions before role variants are mass-produced.
- [x] Requested desktop and runtime gates pass for this increment.

## Workshop Character Mascot Redesign — Increment 2

- [x] Spec updated with amendments: Manager thinking during every ReAct decide phase; stop after base rig
  for visual sign-off.
- [x] Base layered SVG rig exists under `apps/desktop/src/features/workshop/mascots/`.
- [x] Expression set covers `neutral`, `happy`, `thinking`, `focused`, `surprised`, `error`, and `sleeping`.
- [x] SVG presentation uses CSS variables rather than hard-coded mascot brand colors.
- [x] Reduced-motion-safe hooks are present.
- [x] Focused TDD test went red, then green.
- [x] Requested desktop and runtime gates pass for this increment.
- [x] Visual sign-off received before role skins are built.

## Workshop Character Mascot Redesign — Direction 2A Concept Preview

- [x] Seal-fin visual art direction marked superseded; rig engineering remains reusable.
- [x] Owner revision captured: Q-version proportions, thick outline, blank-cute expression, happy face,
  simplified standing pose, and an original dragon-horn girl.
- [x] Originality guardrail retained: no copied reference asset, name, likeness, horn silhouette, long-hair
  waterfall, tactical outfit, copied palette identity, or marks.
- [x] Three distinct dragon-horn chibi concepts are documented.
- [x] Three concept PNGs render with neutral + happy variants.
- [x] Requested desktop and runtime gates pass for this preview increment.
- [x] Commit created on `main` with the required co-author trailer.
- [x] Owner chooses one concept before any product rig reskin, role skin, or Workshop integration.

## Workshop Character Mascot Redesign — Direction 2B Selected Rig Preview

- [x] Owner selected Concept A: Paper-Lantern Dragon Apprentice.
- [x] Focused TDD test went red on the old seal-fin visual layer, then green after the reskin.
- [x] Existing `MascotRig` keeps the same public props, seven-expression system, accessible SVG semantics,
  reduced-motion hooks, and token-driven styling.
- [x] Seal-fin visual layer is retired from the component.
- [x] Concept A selected rig preview renders all seven expressions from the React component.
- [x] Requested desktop and runtime gates pass for this selected rig increment.
- [x] Commit created on `main` with the required co-author trailer.
- [x] Owner visually signs off selected rig before role skins or Workshop integration.

## Workshop Character Mascot Redesign — Increment 3 State Selector

- [x] Focused TDD test went red on missing `deriveMascotState`, then green.
- [x] No active run maps to idle; provider not configured with no active run maps to offline/sleeping.
- [x] Manager shows thinking after a real run starts before assignment/action.
- [x] Manager shows thinking between ReAct act steps after real completion/observation events.
- [x] Workers show working only after real start/action/tool events for that worker.
- [x] Partial answer text maps Manager to talking only while real partial text exists.
- [x] Pending approval maps to awaiting approval and never success.
- [x] Completed, failed/model-not-configured, and cancelled map to success, error, and stopped honestly.
- [x] Reduced motion disables loop motion while preserving state/expression.
- [x] Requested desktop and runtime gates pass for this increment.
- [x] Commit created on `main` with the required co-author trailer.

## Workshop Character Mascot Redesign — Increment 4 Role Skins

- [x] Focused TDD test went red on missing role skins, then green.
- [x] Role set covers manager, browser, computer, file, reviewer, and terminal.
- [x] Every role skin renders through the shared Concept A `MascotRig`.
- [x] Every role exposes a role-specific prop/crest layer.
- [x] Role props and accents are token-driven; no hard-coded SVG fill/stroke colors are added.
- [x] Unknown/custom stations fall back to the manager skin rather than inventing a new role.
- [x] Workshop surfaces are not integrated in this increment.
- [x] Requested desktop and runtime gates pass for this increment.
- [x] Commit created on `main` with the required co-author trailer.

## Product-Wide Acceptance Still Pending Outside This Task

- [ ] App starts end to end.
- [ ] Runtime starts with the desktop app.
- [ ] Real run creation works in the packaged desktop flow.
- [ ] Real event streaming works in the UI.
- [ ] Real approval flow works in the UI.
- [ ] Real persistence works across restarts.
- [ ] Live Office consumes real runtime events.
- [ ] Workshop validates/imports real packs.
- [ ] Settings has real state.
- [ ] Developer Mode exposes real runtime data.
- [ ] Full app/build gates pass when run for a release milestone.
