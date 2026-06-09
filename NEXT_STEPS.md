# Next Steps

- [x] Run the full requested verification stack after this phase (lint, typecheck, test, build, pytest, cargo check, cargo test, tauri build — all green on 2026-06-08).
- [x] Implement a concrete Tauri-to-runtime Computer bridge transport so the Python runtime receives `YANSHI_COMPUTER_BRIDGE_URL`/`_TOKEN` in every launch (done: in-process localhost server + token + env injection + tests).
- [x] Bundle a standalone Python runtime sidecar (PyInstaller) — `pnpm desktop:release`; packaged app launches it in `mode=bundled-sidecar`.
- [x] Wire persisted Docker image/resource settings into per-run Docker execution with validation.
- [x] Enforce tool-availability settings with honest `tool_disabled` observations.
- [x] Move provider API key to an off-DB `apiKeyRef` secret store with migration.
- [ ] Grant Accessibility to packaged `Yanshi.app` and verify Computer bridge `click/type/shortcut`; also verify tray actions, close behavior, notifications, Cmd+Y.
- [ ] Codesign + notarize the bundle for distribution beyond the build machine.
- [ ] Pre-pull or configure the Docker sandbox image, then manually smoke a Docker command run to completion.
- [ ] Move provider API key storage to macOS Keychain or an `apiKeyRef` design.
- [ ] Add Workshop export and richer pack-management flows.
- [ ] Expand Developer Mode with graph state, checkpoint view, database status, and tool traces.
- [ ] Add focused frontend reducer/tests for Live Office state and desktop event handling.
- [ ] Add release-side manual QA evidence to `docs/BUILD_AND_RELEASE.md`.
