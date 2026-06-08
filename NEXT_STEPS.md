# Next Steps

- [ ] Run the full requested verification stack after this phase.
- [ ] Manually launch the packaged `Yanshi.app` and verify tray actions, close behavior, notifications, and Cmd+Y/global shortcut behavior.
- [ ] Implement or package a concrete Tauri-to-runtime Computer bridge transport so the Python runtime receives `YANSHI_COMPUTER_BRIDGE_URL` in packaged launches.
- [ ] Bundle a standalone Python runtime sidecar; until then, keep packaged builds clearly setup-required.
- [ ] Wire persisted Docker image/resource settings into per-run `TerminalTool` configuration.
- [ ] Pre-pull or configure the Docker sandbox image, then manually smoke a Docker command run to completion.
- [ ] Move provider API key storage to macOS Keychain or an `apiKeyRef` design.
- [ ] Add Workshop export and richer pack-management flows.
- [ ] Expand Developer Mode with graph state, checkpoint view, database status, and tool traces.
- [ ] Add focused frontend reducer/tests for Live Office state and desktop event handling.
- [ ] Add release-side manual QA evidence to `docs/BUILD_AND_RELEASE.md`.
