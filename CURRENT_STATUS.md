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
- A standalone PyInstaller runtime sidecar (`yanshi-runtime-sidecar`, onefile) is built via `pnpm sidecar:build` and bundled into `Yanshi.app/Contents/Resources/resources/`; the packaged app launches it in `mode=bundled-sidecar` with no uv/repo/venv dependency (verified `/health` ok).
- The packaged Computer bridge was verified end-to-end via the runtime task path for `open-app` (native `open -a TextEdit`, returnCode 0) and rejects unauthorized bridge requests with 401.
- Persisted Docker Developer settings (`dockerImage/dockerMemory/dockerCpus/dockerPidsLimit`) are validated and used for per-run Docker sandbox execution; unsafe values return `docker_config_invalid`.
- Tool-availability settings are enforced: disabled Browser/Computer/Terminal tasks return honest `tool_disabled` observations.
- Provider API key is stored as an `apiKeyRef` in SQLite with the raw secret kept in an off-DB secret store (0600 file store by default; opt-in macOS Keychain via `YANSHI_SECRET_BACKEND=keychain`); legacy inline keys are migrated out and VACUUMed.
- Build/release docs exist in `docs/BUILD_AND_RELEASE.md`.

## What Does Not Work Yet

- Computer Use `click/type/shortcut` still need a one-time interactive macOS Accessibility grant to `Yanshi.app` before they can be manually verified; `open-app` is already verified (it needs no Accessibility).
- The bundled `.app`/`.dmg` are not codesigned or notarized, so Gatekeeper will warn on a second machine; functional distribution (self-contained runtime) works.
- Manual Docker command smoke did not complete because the required `alpine:3.20` image pull timed out in this environment.
- Terminal Tool does not support local shell pipelines; mutating commands are limited to the Docker sandbox path.
- Workshop export and richer pack-management flows are not implemented yet.
- Tray/global-shortcut/notification behavior still needs manual packaged-app verification.
- Live Office office editor is not implemented.

## Product Surfaces Progress (2026-06-08, toward full spec)

- Composer: real `+` menu (Plan first + Use Browser/Computer/Terminal directives), real voice
  button (Web Speech API; honest disabled state), flag chips. Plan-first creates a real approval
  gate after planning.
- Settings: grouped normal mode (General, Models, Permissions, Live Office, Workshop, Notifications,
  About) + Developer group (Runtime, Sandbox, Database). Theme light/dark with real dark CSS.
- Runs: grouping (Time/Project/Status), clickable rows, per-message Details expander (raw JSON in
  Developer Mode only). Hybrid Transcript retained.
- Projects: tabbed workspace (Overview, Runs, Files, Artifacts, Activity, Settings) on real data;
  new `GET /projects/{id}/files` lists the real workspace.
- Onboarding: first-run modal with a real "Try a demo" run; persists `onboarded`.

Still not built (deferred, no shells): Automations, Workshop Create/Agent Editor/Office Editor/
export, Live Office life-animations/hover-cards/fatigue/stations/project-scoped office state,
Search, reasoning levels, file upload, close-behavior prompt, codesign/notarization.

## Design / Visual Smoke (2026-06-08)

Checked the running web UI (vite + bundled runtime) against the product design spec:

- **New Task** — visually checked. Warm light theme, mascot brand, simple sidebar
  (New Task, Search, Projects, Runs, Workshop, Settings + conditional Artifacts), a single
  centered rounded composer with capsule Permission/Project chips and icon buttons, short
  template chips. No top bar, no dense cards, no subtitles. On-spec.
- **Runs / Run Details** — visually checked. Converted from a raw event dump into the spec's
  **Hybrid Transcript**: collapsible Plan, agent messages with friendly labels (Manager/Browser/
  File/…), Artifact cards, inline Approval cards, and a highlighted final Result. Raw event
  stream moved to a Developer-Mode-only collapsible (`Raw events`).

What was simplified this pass:

- Run transcript no longer shows low-level event types (`run.created`, `agent.task.*`,
  `observation.created`) in normal mode — only curated, human-readable items; raw stream is
  Developer-Mode only.
- Removed non-functional Workshop tabs (`Discover`/`Create`) that did nothing (placeholder smell).
- Shortened "Plan created · N steps" → "Plan · N steps".

What remains rough (not blocking RC):

- The 3D Live Office uses simple primitives; the "Q-style mechanical workers" / workshop styling
  is minimal, not final art.
- `Search` is an honest empty state (no index yet); `Projects` detail still shows a small
  technical `runtime-details` list (kept concise).

No-excess-text rule: followed — labels are short, settings copy is terse, technical detail sits
behind Developer Mode or expanders. No fake/mock data introduced; all transcript content is real
runtime output, and empty/not-configured/permission-required states are preserved.

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
- A truly distributable `.app` requires `pnpm desktop:release` (builds + bundles the standalone sidecar). A plain `pnpm --filter @yanshi/desktop tauri build` produces a setup-required bundle (no sidecar). For store/second-machine distribution, codesigning + notarization are still required.
