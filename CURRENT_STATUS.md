# Current Status

## What Works

- Monorepo installs with pnpm and uv.
- Desktop web UI builds and renders.
- Tauri app compiles, tests, and builds release bundles.
- Tauri starts the uv-managed Python runtime sidecar in dev/runtime mode.
- Runtime REST health/status works.
- Runtime run creation works.
- Runtime event persistence works.
- Runtime WebSocket stream works.
- SQLite run/event/action/observation/artifact persistence works.
- LangGraph graph runs with SQLite checkpointing.
- Approval request/resume works in tests.
- File tool scans the real workspace sandbox and writes a JSON artifact.
- OpenAI-compatible model provider settings, health check, and chat-completions execution work when configured.
- Missing model provider state remains honest when no provider is configured.
- Project CRUD works with durable project records and real workspace directories.
- Project-scoped runs and project-scoped file scans work.
- Manager creates structured provider-backed JSON plans for general provider tasks.
- Project-level and agent-level queues persist in SQLite and are exposed through `/agent-tasks`.
- The executor runs queued `agent_tasks` and dispatches each assignment to Browser, File, Computer, Terminal, Manager, or Reviewer.
- Direct multi-tool requests can queue and run multiple tool agents in one run.
- Manager synthesizes final output after multiple agent observations.
- Reviewer explains failed agent tasks and records final quality review without fake success.
- Browser Tool can execute URL navigation/extraction/screenshot through Playwright when Python Playwright and Chromium browser binaries are installed.
- Browser Tool reports honest missing URL, missing Python package, and missing Chromium browser-binary states.
- Browser Tool was manually smoked with installed Playwright Chromium against `https://example.com`, including screenshot artifact verification.
- Browser page summarization uses the configured provider after real page capture.
- Tauri Settings can report real native macOS Accessibility and Screen Recording status in desktop builds.
- Runtime Computer Tool probes macOS permission state with native APIs and reports missing permission, unsupported platform, or missing action bridge honestly.
- Runtime Computer Tool can capture the screen through real macOS `screencapture` for explicit screenshot tasks and saves a PNG artifact.
- Tauri exposes real macOS Computer bridge commands for click, type, shortcut, and open app.
- Tauri runs an in-process localhost Computer bridge HTTP server on an OS-assigned random port with a per-launch random bearer token, and injects `YANSHI_COMPUTER_BRIDGE_URL`/`YANSHI_COMPUTER_BRIDGE_TOKEN` into the spawned Python runtime process (both `uv` and bundled-sidecar launch paths).
- The bridge server authenticates every request with a constant-time bearer-token check, rejects missing/invalid tokens with HTTP 401, rejects unknown operations with 404 and non-POST with 405, and dispatches `/computer/{click,type,shortcut,open-app}` to the native CoreGraphics action functions.
- Runtime Computer Tool calls the injected desktop bridge URL with the bearer token for click/type/shortcut/open-app; a rejected token or missing bridge remains an honest `computer_use_control_bridge` state.
- Docker readiness state is real.
- Docker sandbox command execution path is implemented with workspace bind mount, no network, resource limits, timeout, resource-lock metadata, and terminal log artifact output.
- Terminal Tool can execute read-only allowlisted commands in the run workspace without a shell.
- Terminal Tool supports approved mutating commands through the Docker sandbox path when Docker image execution is available.
- Terminal Tool blocks unsupported commands, shell redirects/pipelines, absolute executable paths, and parent-directory paths.
- SQLite storage is locked for concurrent runtime API requests from the desktop UI.
- Runtime CORS supports localhost and 127.0.0.1 dev ports.
- Workshop zip validation works for unsafe executable rejection.
- Workshop uploads sanitize filenames to basename-only incoming paths.
- Workshop uploads enforce raw size, uncompressed zip size, per-member size, file count, unsafe path, executable, and symlink limits.
- Workshop zip import installs validated packs into runtime storage.
- Workshop pack enable/disable state persists and emits events.
- UI composer can create a real run through the runtime.
- UI composer can create standalone or project-scoped runs.
- Projects view can create, select, edit, and delete projects.
- Workshop view imports, lists, and enables/disables real packs.
- Runs view shows plan/events.
- Live Office consumes runtime events and changes agent state.
- Settings persists provider and app preferences.
- Developer Mode settings persist Docker image and resource-limit preferences.
- Developer Mode shows runtime status and raw events.
- Tauri runtime bridge reports setup-required states, runtime log path, restart, and open-log action.
- Tauri tray/menu includes Open Yanshi, Current Tasks, Open Live Office, Pause All, and Quit.
- Runtime-event notifications are wired for approvals, run completion, run failure, and runtime error events.
- Live Office is lazy-loaded, default-closed by settings, auto-opens on real run start, can be closed during runs, includes Full Office View, queue bubbles, and a pop-out always-on-top window path.
- Tauri CSP is tightened and no longer `null`.
- Build/release docs exist in `docs/BUILD_AND_RELEASE.md`.

## What Does Not Work Yet

- Runtime Computer Use control actions are now wired end-to-end (localhost bridge server + token + env injection, covered by Rust and Python tests), but the click/type/shortcut/open-app path has not yet been manually verified in the packaged `.app` with real macOS Accessibility permission granted.
- Manual Docker command smoke did not complete because the required `alpine:3.20` image pull timed out in this environment.
- Persisted Docker Developer Mode settings are not yet wired into per-run TerminalTool construction.
- Terminal Tool does not support local shell pipelines; mutating commands are limited to the Docker sandbox path.
- Workshop export and richer pack-management flows are not implemented yet.
- Tray/global-shortcut/notification behavior still needs manual packaged-app verification.
- Live Office office editor is not implemented.
- The packaged `.app` is not fully distributable until a standalone Python runtime sidecar is bundled and tested.

## Current Failing Tests

- None in the implemented test suites.

## Current Branch

- `main` (Git repository initialized; single `initial commit` plus in-progress working tree).

## Current App Start Command

Workspace dependencies are installed (`pnpm install` run this session). If `node_modules` is ever cleared, run `pnpm install` again before using pnpm scripts.

```bash
pnpm desktop:dev
```

For web-only UI smoke:

```bash
pnpm --filter @yanshi/desktop dev --host 127.0.0.1
```

## Current Runtime Start Command

```bash
uv run --project runtime/python yanshi-runtime --host 127.0.0.1 --port 8765
```

## Current Build Artifacts

- `apps/desktop/src-tauri/target/release/bundle/macos/Yanshi.app`
- `apps/desktop/src-tauri/target/release/bundle/dmg/Yanshi_0.1.0_aarch64.dmg`

## Current Blockers

- General-purpose task execution requires configured provider settings or `YANSHI_MODEL_PROVIDER` and `YANSHI_MODEL_API_KEY`.
- Browser execution requires `uv sync --project runtime/python --extra browser` and `uv run --project runtime/python playwright install chromium`; both were run successfully in this environment.
- Computer Use screen capture requires macOS Accessibility and Screen Recording permission; click/type/shortcut control requires Accessibility plus a configured desktop bridge transport.
- Docker execution requires Docker Desktop running and the configured sandbox image to be available or pullable before timeout.
- Local terminal execution is intentionally limited to read-only workspace commands.
- Packaged distribution requires a bundled standalone Python runtime sidecar; current release bundles are setup-required when no sidecar or `uv` runtime project is available.
