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
