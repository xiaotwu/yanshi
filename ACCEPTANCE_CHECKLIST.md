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
- [ ] User has signed off the key decisions before role variants are mass-produced.
- [x] Requested desktop and runtime gates pass for this increment.

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
