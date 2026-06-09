# Yanshi Implementation Log

## 2026-06-08 - Queue Executor, Computer Bridge, Desktop Product Shell

- Phase: P0 final-product continuation.
- Documentation checked:
  - Context7 `/websites/v2_tauri_app` for Tauri v2 commands, tray/menu APIs, notification plugin API, CSP, and WebviewWindowBuilder.
- Files changed:
  - `runtime/python/yanshi_runtime/graph/runtime_graph.py`
  - `runtime/python/yanshi_runtime/tools/computer_tool.py`
  - `runtime/python/yanshi_runtime/models.py`
  - `runtime/python/tests/test_runtime.py`
  - `apps/desktop/src-tauri/src/runtime.rs`
  - `apps/desktop/src-tauri/src/lib.rs`
  - `apps/desktop/src-tauri/tauri.conf.json`
  - `apps/desktop/src/api/client.ts`
  - `apps/desktop/src/api/desktop.ts`
  - `apps/desktop/src/stores/runtimeStore.ts`
  - `apps/desktop/src/App.tsx`
  - `apps/desktop/src/styles.css`
  - `packages/shared/src/index.ts`
  - `.gitignore`
  - `docs/BUILD_AND_RELEASE.md`
  - Continuation docs.
- Implemented:
  - Runtime executor now iterates persisted queued `agent_tasks` and dispatches each assignment to the assigned Browser/File/Computer/Terminal/Manager/Reviewer agent.
  - Direct multi-tool tasks queue multiple tool agents instead of collapsing to one keyword branch.
  - Tool agents execute from assignment text plus original-request context.
  - Manager performs final synthesis after multiple agent observations and records `MessageObservation` from actual results.
  - Reviewer records quality/failure review from actual agent results and does not fake success.
  - Failed tool-agent runs can still complete queued Manager/Reviewer tasks with grounded failure observations.
  - Added tests for multi-agent queued Browser+File execution, Manager final synthesis, and failed Browser task Reviewer behavior.
  - Added real Tauri/Rust Computer bridge commands for click, type, shortcut, and open app.
  - Runtime `ComputerTool` now supports bridge-backed click/type/shortcut/open-app actions when `YANSHI_COMPUTER_BRIDGE_URL` is configured; missing permissions and missing bridge remain honest states.
  - Added Computer bridge tests for permission-required, bridge-required, and action-success paths.
  - Added tray menu actions for Open Yanshi, Current Tasks, Open Live Office, Pause All, and Quit.
  - Added desktop notification command and websocket-driven notifications for approval requested, run completed, run failed, and runtime error events.
  - Window close now hides the main window instead of killing the runtime; Quit remains explicit through the tray/app exit path.
  - Live Office is lazy-loaded, default-closed by settings, auto-opens on real `run.started`, remains user-closeable during runs, has Full Office View, queue bubbles, hover titles, and a Tauri pop-out always-on-top window command.
  - Tightened Tauri CSP instead of leaving it disabled.
  - Added persisted Docker Developer Mode settings for image, memory, CPU, and PID limit.
  - Added build/release docs with explicit setup-required runtime-sidecar status and release checklist.
  - Cleaned `.DS_Store`/`.pytest_cache` and added `._*` AppleDouble ignore rule.
- Commands run in this phase:
  - `uv run --project runtime/python pytest runtime/python/tests/test_runtime.py`
  - `uv run --project runtime/python pytest runtime/python/tests/test_runtime.py -k "multi_agent or failed_agent_task"`
  - `uv run --project runtime/python pytest`
  - `cargo check --manifest-path apps/desktop/src-tauri/Cargo.toml`
  - `cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml`
  - `pnpm --filter @yanshi/desktop typecheck`
  - `pnpm --filter @yanshi/shared typecheck`
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm test`
  - `pnpm build`
  - `pnpm --filter @yanshi/desktop tauri build`
  - `find . -name 'node_modules' -type d -prune -exec rm -rf {} +`
  - `find . -name '.DS_Store' -o -name '._*' -o -name '.pytest_cache' | xargs rm -rf`
  - `find . -name 'node_modules' -type d -prune -print -o -name '.pytest_cache' -print -o -name '.DS_Store' -print -o -name '._*' -print | head -100`
- Results:
  - Runtime tests: 43 passed, 1 upstream FastAPI/TestClient deprecation warning.
  - Rust tests: 5 passed.
  - `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build` passed.
  - `pnpm test` still has no JS test files.
  - `pnpm build` and Tauri build still report Vite's large chunk warning for the 3D bundle.
  - Tauri build passed and produced:
    - `apps/desktop/src-tauri/target/release/bundle/macos/Yanshi.app`
    - `apps/desktop/src-tauri/target/release/bundle/dmg/Yanshi_0.1.0_aarch64.dmg`
  - Cleanup verification found no remaining `node_modules`, `.pytest_cache`, `.DS_Store`, or `._*` files under the repo.
- Known remaining blockers:
  - The packaged `.app` is still setup-required for distribution until a standalone Python runtime sidecar is bundled.
  - Runtime Computer control actions need an actual desktop bridge transport URL configured in packaged runtime launches; missing bridge is surfaced honestly.
  - Docker command success still depends on Docker Desktop and the sandbox image being locally available or pullable.

## 2026-06-08 - Workshop Hardening, Agent Queues, Browser Summary, Docker Sandbox

- Phase: security hardening and orchestration continuation.
- Documentation checked:
  - Context7 `/fastapi/fastapi` for current `UploadFile` multipart handling.
  - Context7 `/docker/cli` for `docker run` flags including bind mounts, `--rm`, `--network`, and resource limits.
- Files changed:
  - `runtime/python/yanshi_runtime/workshop/packs.py`
  - `runtime/python/yanshi_runtime/server/app.py`
  - `runtime/python/yanshi_runtime/models.py`
  - `runtime/python/yanshi_runtime/storage.py`
  - `runtime/python/yanshi_runtime/graph/runtime_graph.py`
  - `runtime/python/yanshi_runtime/tools/terminal_tool.py`
  - `runtime/python/yanshi_runtime/agents/profiles.py`
  - `runtime/python/tests/test_runtime.py`
  - `packages/shared/src/index.ts`
  - `apps/desktop/src/api/client.ts`
  - `apps/desktop/src/stores/runtimeStore.ts`
  - Continuation docs.
- Implemented:
  - Workshop upload filenames now use a sanitized basename-only incoming filename with a random prefix.
  - Workshop upload stream enforces a 25 MiB raw upload limit and rejects empty uploads.
  - Workshop zip validation enforces file count, total uncompressed size, per-member size, unsafe path, executable suffix, and symlink limits.
  - Workshop extraction streams files and rechecks path/member/total size limits while writing.
  - Added malicious filename, raw upload limit, uncompressed zip-bomb, and file-count limit tests.
  - Added persisted `agent_tasks` queue table with project-level and agent-level query filters.
  - Manager planning now creates real queue rows and emits persisted `agent.task.assigned`, `agent.task.started`, `agent.task.completed`, and `agent.task.failed` events.
  - General provider tasks ask the configured provider for a structured JSON plan before final provider execution.
  - File, Browser, Computer, Terminal, Manager, and Reviewer branches start/complete persisted agent queue items around real actions.
  - Reviewer creates a real failure review action/observation for failed runs.
  - Added `/agent-tasks` read endpoint and a shared/client `AgentTaskSummary` contract.
  - Added Terminal Agent profile and Live Office state handling for `agent.task.failed`.
  - Browser page summarization now uses the configured provider after a real BrowserObservation when the task asks for a summary.
  - Installed the runtime browser extra and Playwright Chromium locally, then manually smoked `https://example.com`; screenshot artifact was created at `/tmp/yanshi-browser-smoke/browser-snapshot.png`.
  - Docker sandbox path now runs through Docker CLI with `--rm`, `--network none`, workspace bind mount, `/workspace` workdir, memory/CPU/PID limits, timeout handling, and Docker lock metadata.
  - Docker sandbox creates a terminal log artifact for stdout/stderr.
  - Docker readiness is real; local Docker daemon responded, but manual command smoke timed out while pulling `alpine:3.20`, now reported as `docker_image_pull_timeout`.
- Commands run:
  - `uv sync --project runtime/python --extra browser`
  - `uv run --project runtime/python playwright install chromium`
  - Browser smoke: `uv run --project runtime/python python - <<'PY' ... BrowserTool().open_from_task('Use browser https://example.com') ... PY`
  - Docker status smoke: `uv run --project runtime/python python - <<'PY' ... TerminalTool().docker_status() ... PY`
  - Docker command smoke: `uv run --project runtime/python python - <<'PY' ... TerminalTool().run_in_docker('echo docker-smoke') ... PY`
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm test`
  - `pnpm build`
  - `uv run --project runtime/python pytest`
  - `cargo check --manifest-path apps/desktop/src-tauri/Cargo.toml`
  - `cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml`
  - `pnpm --filter @yanshi/desktop tauri build`
- Results:
  - `uv run --project runtime/python pytest`: 36 passed, 1 upstream FastAPI/TestClient deprecation warning.
  - `pnpm lint`: passed.
  - `pnpm typecheck`: passed.
  - `pnpm test`: passed, with no JS test files yet.
  - `pnpm build`: passed; Vite still reports the large 3D bundle chunk warning.
  - `cargo check`: passed.
  - `cargo test`: 2 passed.
  - `tauri build`: passed with bundles regenerated:
    - `apps/desktop/src-tauri/target/release/bundle/macos/Yanshi.app`
    - `apps/desktop/src-tauri/target/release/bundle/dmg/Yanshi_0.1.0_aarch64.dmg`
  - Browser smoke passed: `Example Domain` loaded with HTTP 200 and screenshot size 16577 bytes.
  - Docker readiness smoke passed: Docker sandbox is available.
  - Docker command smoke reached Docker but timed out while pulling `alpine:3.20`; this is now surfaced as `docker_image_pull_timeout`.
- Issues found and fixed:
  - Workshop upload paths previously trusted `UploadFile.filename`; incoming writes now use sanitized basename-only names.
  - Workshop validation previously lacked zip-bomb and file-count limits.
  - Agent task activity was previously event-only; queues are now persisted and queryable.
  - Docker timeout while pulling a missing image was too generic; it now reports an image-pull-specific missing requirement.
- Next action:
  - Implement macOS click/type/shortcut/open-app bridge through Tauri/Rust, then add desktop menubar/notification behavior and Live Office pop-out/lazy-load behavior.

## 2026-06-08 - macOS Permission And Screen Capture Bridge

- Phase: native permission status and first real Computer Use action slice.
- Documentation checked:
  - Apple Developer Documentation for `AXIsProcessTrusted` return type.
  - Apple Developer Documentation for `CGPreflightScreenCaptureAccess` return type.
- Files changed:
  - `apps/desktop/src-tauri/src/runtime.rs`
  - `packages/shared/src/index.ts`
  - `apps/desktop/src/api/desktop.ts`
  - `apps/desktop/src/stores/runtimeStore.ts`
  - `apps/desktop/src/App.tsx`
  - `runtime/python/yanshi_runtime/tools/computer_tool.py`
  - `runtime/python/yanshi_runtime/graph/runtime_graph.py`
  - `runtime/python/tests/test_runtime.py`
  - Continuation docs.
- Implemented:
  - Tauri now exposes real native macOS Accessibility and Screen Recording status through `macos_permission_status`.
  - Rust FFI uses the correct macOS Accessibility `Boolean` byte for `AXIsProcessTrusted` and C `bool` for `CGPreflightScreenCaptureAccess`.
  - Shared TypeScript contracts and desktop API/store hydrate macOS permission state independently from runtime REST status.
  - Settings shows concise permission status with a refresh action and a compact macOS access details panel in desktop builds.
  - Runtime `ComputerTool` now probes macOS permission status through Python `ctypes` instead of always returning a static permission-required response.
  - Computer Use now distinguishes missing macOS permissions, non-macOS unsupported state, and the remaining missing click/type/app-control bridge after permissions are granted.
  - Computer Tool can run the real macOS `screencapture -x` command without a shell for explicit screen-capture tasks after permissions are granted.
  - Runtime graph records `ComputerAction`, `ComputerObservation`, and PNG artifact records for successful Computer Tool screen captures.
  - Runtime graph now fails tool-status runs whenever a missing requirement is present, instead of relying on summary text.
- Commands run:
  - `cargo check --manifest-path apps/desktop/src-tauri/Cargo.toml`
  - `cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml`
  - `pnpm lint`
  - `pnpm typecheck`
  - `uv run --project runtime/python pytest`
  - `pnpm test`
  - `pnpm build`
  - `pnpm --filter @yanshi/desktop tauri build`
  - Visual smoke runtime: `uv run --project runtime/python yanshi-runtime --host 127.0.0.1 --port 8765 --data-dir /tmp/yanshi-permission-smoke-data`
  - Visual smoke UI: `pnpm --filter @yanshi/desktop dev --host 127.0.0.1 --port 5175`
- Results:
  - `cargo check`: passed.
  - `cargo test`: 2 passed.
  - `pnpm lint`: passed.
  - `pnpm typecheck`: passed.
  - `uv run --project runtime/python pytest`: 27 passed, 1 upstream FastAPI/TestClient deprecation warning.
  - `pnpm test`: passed, with no JS test files yet.
  - `pnpm build`: passed; Vite still reports a large chunk warning from the 3D bundle.
  - `tauri build`: passed with bundles regenerated:
    - `apps/desktop/src-tauri/target/release/bundle/macos/Yanshi.app`
    - `apps/desktop/src-tauri/target/release/bundle/dmg/Yanshi_0.1.0_aarch64.dmg`
  - Browser visual smoke opened Settings against the real runtime, verified the permission card layout in the web shell, and found no console warnings or errors.
- Issues found and fixed:
  - The initial Rust FFI treated the Accessibility `Boolean` as C `bool`; it now uses `c_uchar` and compares nonzero.
  - The Python Computer Tool previously returned a static missing-permission response even when permissions might be granted; it now probes and reports the remaining bridge gap separately.
- Next action:
  - Implement macOS Computer Use click/type/app-control actions, then Docker-backed command sandbox/resource locks.

## 2026-06-08 - Phase 1-4 Continuation

- Phase: runtime packaging reliability, provider, settings, and projects.
- Files changed:
  - Runtime sidecar bridge: `apps/desktop/src-tauri/src/runtime.rs`, `apps/desktop/src-tauri/src/lib.rs`.
  - Desktop API/store/UI: `apps/desktop/src/api/client.ts`, `apps/desktop/src/api/desktop.ts`, `apps/desktop/src/stores/runtimeStore.ts`, `apps/desktop/src/App.tsx`, `apps/desktop/src/styles.css`.
  - Shared contracts: `packages/shared/src/index.ts`.
  - Runtime models/storage/server/graph/provider: `runtime/python/yanshi_runtime`.
  - Runtime tests: `runtime/python/tests/test_runtime.py`.
- Implemented:
  - Tauri runtime status now distinguishes dev, override, bundled sidecar, bundled uv project, and setup-required states.
  - Runtime logs are written under app data and can be opened from Settings.
  - OpenAI-compatible provider settings, health check, and chat-completions execution path.
  - Provider API keys persist write-only and are not returned in public settings/events.
  - App settings persistence for Developer Mode, permission defaults, tool toggles, Live Office, notifications, and shortcut state.
  - Project CRUD with real workspace directories under the runtime workspace root.
  - Project-scoped run creation, filtered run listing, project event emission, and project-scoped file scans.
  - Project deletion preserves run history by making affected runs standalone and leaving workspace files in place.
  - Projects view with create/select/edit/delete, workspace details, run count, and related run list.
  - New Task project selector for standalone versus project-scoped runs.
  - Live Office now resolves completed/failed tool actions from real events.
- Commands run:
  - `uv run --project runtime/python pytest`
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm test`
  - `pnpm build`
  - `cargo check --manifest-path apps/desktop/src-tauri/Cargo.toml`
  - `cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml`
  - Visual smoke runtime: `uv run --project runtime/python yanshi-runtime --port 8877 --data-dir /tmp/yanshi-codex-runtime`
  - Visual smoke UI: `VITE_RUNTIME_URL=http://127.0.0.1:8877 pnpm --filter @yanshi/desktop dev`
- Results:
  - `uv run --project runtime/python pytest`: 13 passed, 1 upstream FastAPI/TestClient deprecation warning.
  - `pnpm lint`: passed.
  - `pnpm typecheck`: passed.
  - `pnpm test`: passed, with no JS test files yet.
  - `pnpm build`: passed; Vite still reports a large chunk warning from the 3D bundle.
  - `cargo check`: passed.
  - `cargo test`: 2 passed.
  - Browser visual smoke created a real project, wrote a real file into its workspace, ran a project-scoped file scan, and verified `latest-file-scan.json` landed in the project workspace.
- Issues found and fixed:
  - Project edit fields were too narrow because generic settings-grid CSS won the cascade.
  - Long JSON event payloads could overflow the Runs column.
  - Live Office left File Agent in `working` after `action.completed`.
  - A transient CORS console error appeared during dev reload; direct CORS checks and a clean reload were healthy.
- Next action:
  - Implement real Browser Tool execution with Playwright installation/status checks and approval-aware action records.

## 2026-06-08 - Browser Tool And Storage Concurrency

- Phase: Browser Tool execution slice.
- Documentation checked:
  - Context7 `/websites/playwright_dev_python` for current Python sync Playwright launch, navigation, screenshot, timeout, and install-command docs.
- Files changed:
  - `runtime/python/yanshi_runtime/tools/browser_tool.py`
  - `runtime/python/yanshi_runtime/graph/runtime_graph.py`
  - `runtime/python/yanshi_runtime/storage.py`
  - `runtime/python/tests/test_runtime.py`
- Implemented:
  - Browser Tool extracts HTTP(S) URLs from tasks and rejects missing/unsupported targets explicitly.
  - Browser Tool launches Chromium through Playwright sync API, navigates headless, captures title/final URL/status/body snippet, and writes a screenshot artifact when Playwright and browser binaries are installed.
  - Browser Tool returns honest `playwright_python`, `playwright_browser_binaries`, `browser_url`, timeout, and navigation failure states.
  - Runtime graph creates `BrowserAction`, `BrowserObservation`, and a PNG artifact for successful browser navigations.
  - Run-linked events now inherit `projectId` from their run in storage.
  - Shared SQLite connection access is serialized with an `RLock` to prevent concurrent desktop hydration requests from misusing the connection.
- Commands run:
  - `uv run --project runtime/python pytest`
  - `pnpm typecheck`
  - `pnpm lint`
  - `pnpm test`
- Results:
  - `uv run --project runtime/python pytest`: 17 passed, 1 upstream FastAPI/TestClient deprecation warning.
  - `pnpm typecheck`: passed.
  - `pnpm lint`: passed.
  - `pnpm test`: passed, with no JS test files yet.
- Issues found and fixed:
  - Visual-smoke shutdown revealed intermittent `sqlite3.InterfaceError: bad parameter or other API misuse` during parallel UI hydration. Added storage locking and a parallel hydration regression test.
- Next action:
  - Implement terminal command execution inside a conservative workspace sandbox.

## 2026-06-08 - Terminal Workspace Sandbox

- Phase: Terminal Tool execution slice.
- Files changed:
  - `runtime/python/yanshi_runtime/tools/terminal_tool.py`
  - `runtime/python/yanshi_runtime/graph/runtime_graph.py`
  - `runtime/python/tests/test_runtime.py`
  - Continuation docs.
- Implemented:
  - Terminal Tool extracts commands from backticks or `terminal:` task text.
  - Terminal Tool runs commands with `subprocess.run(..., shell=False)` in the run workspace.
  - Environment is sanitized to PATH/LANG/LC_ALL plus `YANSHI_TERMINAL_SANDBOX=workspace`.
  - Read-only allowlist: `pwd`, `ls`, `find`, `cat`, `head`, `tail`, `wc`, `stat`, `du`, `grep`, `rg`.
  - Blocks shell pipelines/redirects, absolute executable paths, parent-directory paths, unsupported commands, parse failures, missing commands, and timeouts with explicit missing requirements.
  - Runtime graph records `TerminalAction` and `TerminalObservation` and marks failed tool outcomes as failed runs.
- Commands run:
  - `uv run --project runtime/python pytest`
- Results:
  - `uv run --project runtime/python pytest`: 20 passed, 1 upstream FastAPI/TestClient deprecation warning.
- Next action:
  - Implement either macOS Computer Use permission/action bridge or Workshop install/enable persistence.

## 2026-06-08 - Workshop Import And Final Verification

- Phase: Workshop import/enable slice and verification pass.
- Documentation checked:
  - Context7 `/fastapi/fastapi` for current `CORSMiddleware` `allow_origin_regex` behavior with credentials.
- Files changed:
  - `runtime/python/yanshi_runtime/models.py`
  - `runtime/python/yanshi_runtime/workshop/packs.py`
  - `runtime/python/yanshi_runtime/storage.py`
  - `runtime/python/yanshi_runtime/server/app.py`
  - `runtime/python/tests/test_runtime.py`
  - `packages/shared/src/index.ts`
  - `apps/desktop/src/api/client.ts`
  - `apps/desktop/src/stores/runtimeStore.ts`
  - `apps/desktop/src/App.tsx`
  - `apps/desktop/src/styles.css`
  - `apps/desktop/src-tauri/src/runtime.rs`
  - Continuation docs.
- Implemented:
  - Workshop pack validation now captures manifest author metadata.
  - Valid packs can be imported through `/workshop/import`, safely extracted under the runtime packs directory, and persisted in `workshop_packs`.
  - Installed packs can be listed with `/workshop/packs`.
  - Packs can be enabled/disabled with `/workshop/packs/{pack_id}/enabled`, emitting `workshop.pack.enabled` and `workshop.pack.disabled`.
  - Desktop Workshop UI imports real zip packs, lists installed packs, and toggles enabled state.
  - Runtime CORS now supports arbitrary `localhost` and `127.0.0.1` development ports via `allow_origin_regex`.
  - Release-only Rust dead-code warning for the debug runtime repo helper was removed with `#[cfg(debug_assertions)]`.
- Commands run:
  - `uv run --project runtime/python pytest`
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm test`
  - `pnpm build`
  - `cargo check --manifest-path apps/desktop/src-tauri/Cargo.toml`
  - `cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml`
  - `pnpm --filter @yanshi/desktop tauri build`
  - Visual smoke runtime: `uv run --project runtime/python yanshi-runtime --port 8878 --data-dir /tmp/yanshi-codex-workshop-runtime`
  - Visual smoke UI: `VITE_RUNTIME_URL=http://127.0.0.1:8878 pnpm --filter @yanshi/desktop dev --host 127.0.0.1 --port 5174`
- Results:
  - `uv run --project runtime/python pytest`: 23 passed, 1 upstream FastAPI/TestClient deprecation warning.
  - `pnpm lint`: passed.
  - `pnpm typecheck`: passed.
  - `pnpm test`: passed, with no JS test files yet.
  - `pnpm build`: passed; Vite still reports a large chunk warning from the 3D bundle.
  - `cargo check`: passed.
  - `cargo test`: 2 passed.
  - `tauri build`: passed with bundles regenerated:
    - `apps/desktop/src-tauri/target/release/bundle/macos/Yanshi.app`
    - `apps/desktop/src-tauri/target/release/bundle/dmg/Yanshi_0.1.0_aarch64.dmg`
  - Browser visual smoke imported and enabled a real `Visual Safe Pack` zip through the Workshop UI and confirmed persisted API state/events.
- Issues found and fixed:
  - Runtime CORS initially rejected Vite fallback port `5174`; added regex CORS and regression coverage.
  - Tauri release build warned about debug-only runtime helper; gated it with `#[cfg(debug_assertions)]`.
- Next action:
  - Implement macOS Computer Use bridge actions after permission checks, then Docker-backed command sandbox/resource locks.

## 2026-06-08 - Foundation Build

- Phase: initial execution.
- Files changed:
  - Root workspace config: `package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json`, `.gitignore`.
  - Continuation files: `IMPLEMENTATION_PLAN.md`, `IMPLEMENTATION_LOG.md`, `CURRENT_STATUS.md`, `NEXT_STEPS.md`, `ACCEPTANCE_CHECKLIST.md`.
  - Shared packages: `packages/shared`, `packages/live-office`.
  - Desktop app: `apps/desktop`.
  - Tauri shell: `apps/desktop/src-tauri`.
  - Python runtime: `runtime/python`.
- Implemented:
  - Tauri + Vite + React + TypeScript + Tailwind app shell.
  - Python FastAPI Yanshi Runtime with SQLite persistence.
  - LangGraph state graph with SQLite checkpointing and interrupt-based approval resume.
  - Durable event store and WebSocket stream.
  - Real file workspace sandbox and artifact creation.
  - Not-configured states for missing model provider, Browser Use, Computer Use permissions, and Docker.
  - Workshop zip validator that rejects scripts/executables and unsafe paths.
  - Live Office React Three Fiber scene driven by runtime-derived state.
  - Developer event/status view.
  - Tauri runtime sidecar startup and global shortcut.
- Commands run:
  - `pnpm install`
  - `uv sync --project runtime/python`
  - `pnpm lint`
  - `pnpm test`
  - `pnpm build`
  - `uv run --project runtime/python pytest`
  - `cargo check --manifest-path apps/desktop/src-tauri/Cargo.toml`
  - `cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml`
  - `pnpm --filter @yanshi/desktop tauri build`
  - Runtime smoke: `uv run --project runtime/python yanshi-runtime --host 127.0.0.1 --port 8765 --data-dir data/smoke`
  - UI smoke: `pnpm --filter @yanshi/desktop dev --host 127.0.0.1`
- Results:
  - `pnpm lint`: passed.
  - `pnpm test`: passed, with no JS test files yet.
  - `pnpm build`: passed; Vite reports a large chunk warning from the 3D bundle.
  - `uv run --project runtime/python pytest`: 5 passed, 1 upstream FastAPI/TestClient deprecation warning.
  - `cargo check`: passed.
  - `cargo test`: passed, with no Rust tests yet.
  - `tauri build`: passed.
  - Bundles created:
    - `apps/desktop/src-tauri/target/release/bundle/macos/Yanshi.app`
    - `apps/desktop/src-tauri/target/release/bundle/dmg/Yanshi_0.1.0_aarch64.dmg`
  - Browser smoke screenshot: `.playwright-mcp/yanshi-ui-run-smoke.png`.
- Issues found and fixed:
  - Tauri icon path was wrong.
  - FastAPI dependency injection needed explicit `Depends(...)` defaults.
  - File sandbox needed an absolute resolved root for relative data dirs.
  - CORS needed `http://127.0.0.1:5173`.
  - WebSocket shutdown needed cancellation handling.
- Next action:
  - Implement real model provider client and project CRUD, then expand tools from readiness checks to real execution.

## Phase: Computer Use bridge connected end-to-end + repo cleanup (2026-06-08)

- Context reconstructed from repo docs/code after a lost Codex chat (no chat history assumed).
- P0 #1 (Computer bridge end-to-end) implemented in `apps/desktop/src-tauri/src/runtime.rs`:
  - Added `ComputerBridgeHandle { url, token }` and a `bridge` slot on `RuntimeState`.
  - `start_computer_bridge()` binds `127.0.0.1:0`, generates a per-launch random bearer
    token (`/dev/urandom`, 32 bytes, hex; deterministic time+pid fallback), and serves on a
    background thread. `ensure_computer_bridge()` starts it once and reuses it across restarts.
  - `inject_bridge_env()` adds `YANSHI_COMPUTER_BRIDGE_URL`/`YANSHI_COMPUTER_BRIDGE_TOKEN` to
    both the `uv` and bundled-sidecar `Command` builders before spawn.
  - Minimal dependency-free HTTP/1.1 handler (`serve_bridge_connection`): parses request line +
    headers + Content-Length body, constant-time bearer auth (`authorize_bridge_request`),
    routes `/computer/{click,type,shortcut,open-app}` (`operation_from_path`), and dispatches to
    the existing native action functions (`dispatch_bridge_operation`). Refactored the four
    `#[tauri::command]` bodies into reusable `run_computer_*` functions.
  - Responses: 200 for handled ops (ok may be false with honest `missingRequirement`), 401 for
    missing/invalid token, 404 for unknown op, 405 for non-POST. Token is never logged.
- Tests:
  - Rust (`runtime::tests`): bearer auth matrix, path mapping, dispatch body validation,
    token shape/uniqueness, and a real localhost end-to-end test (raw TcpStream → 200/401/404/405).
    10 Rust tests pass.
  - Python (`tests/test_runtime.py`): `DesktopHttpComputerBridge` sends `Authorization: Bearer`
    to `/computer/<op>` and returns the bridge result; a 401 maps to `computer_use_control_bridge`;
    empty base URL is unavailable. 46 Python tests pass.
- P0 #6 repo cleanup: untracked + ignored `.playwright-mcp/`, moved root smoke PNGs to
  `docs/assets/`, updated `.gitignore`.
- Verification (all green on 2026-06-08):
  - `pnpm install`, `pnpm lint`, `pnpm typecheck`, `pnpm test` (no JS test files), `pnpm build`.
  - `uv run --project runtime/python pytest`: 46 passed.
  - `cargo check` + `cargo test`: 10 passed.
  - `pnpm --filter @yanshi/desktop tauri build`: passed; produced `Yanshi.app` and
    `Yanshi_0.1.0_aarch64.dmg`.
- Still blocked / not done this phase: standalone runtime sidecar bundling (P0 #2),
  Docker settings wiring into TerminalTool (P0 #3), tool-availability enforcement (P0 #4),
  Keychain/apiKeyRef key storage (P0 #5), and manual packaged-app verification of the bridge
  control path with Accessibility granted.
- Next action: wire persisted Docker settings into per-run `TerminalTool` and enforce
  tool-availability toggles with honest `tool_disabled` observations (P0 #3 + #4).

## Phase: RC blockers — sidecar bundling, Docker/tool enforcement, key storage (2026-06-08)

- P0 #5 Provider API key off SQLite: added `yanshi_runtime/secrets.py` (`FileSecretStore` 0600,
  opt-in `KeychainSecretStore` via `YANSHI_SECRET_BACKEND=keychain`, `default_secret_store`).
  `Storage` now persists only `apiKeyRef`; `get_provider_settings_secret` resolves the raw key
  from the store. Startup migration moves any legacy inline `apiKey` out and runs
  `VACUUM` + `wal_checkpoint(TRUNCATE)` so the raw key does not linger in the DB file. Tests:
  ref-not-in-DB, legacy migration purged from file.
- P0 #3 Docker settings: `TerminalTool` gained `DockerConfig` + `validate_docker_config`
  (image/memory/cpus/pids regex + bounds → `docker_config_invalid`). Graph passes a
  `DockerConfig` built from persisted app settings into `run_in_docker`. Tests: validation
  matrix, persisted-settings applied to `docker run` args, invalid settings short-circuit.
- P0 #4 Tool availability: graph `_tool_disabled_result` checks `browserToolEnabled`/
  `computerToolEnabled`/`terminalToolEnabled` before dispatch and records a `tool_disabled`
  observation (failed action + failed agent_task). Tests for all three. Updated two pre-existing
  terminal tests to enable `terminalToolEnabled` (it defaults off, which is now enforced).
- P0 #1 Standalone sidecar: added `runtime/python/sidecar_main.py`, `scripts/build-sidecar.sh`,
  `apps/desktop/src-tauri/tauri.sidecar.conf.json`, and `pnpm sidecar:build` / `pnpm desktop:release`.
  PyInstaller `--onefile` (collect uvicorn/langgraph submodules) builds a ~63 MB
  `yanshi-runtime-sidecar`. Rust resolver gained a `Resources/resources/` candidate. Bundled into
  `Yanshi.app/Contents/Resources/resources/`.
- P0 #2 Packaged verification (this machine, Apple Silicon):
  - Clean-env launch of bundled binary served `/health` ok.
  - Packaged app launched → `mode=bundled-sidecar`, `/health` ok, `computer bridge listening …`.
  - Bridge end-to-end: 401 on no/bad token; runtime task `open-app TextEdit` →
    `Computer bridge opened TextEdit.` returnCode 0, run completed.
  - Remaining interactive step: grant Accessibility to verify click/type/shortcut.
- Verification (all green): `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`,
  `uv run --project runtime/python pytest` (54 passed), `cargo check`, `cargo test` (10 passed),
  `pnpm --filter @yanshi/desktop tauri build`, and `pnpm desktop:release` (bundled `.app` + `.dmg`).
- Next: design alignment / UI polish pass against the product design spec, then codesign/notarize.

## Phase: Product surfaces toward full spec (2026-06-08)

Source of truth: docs/Yanshi_Product_Design_Spec.md. Large refactors allowed; no shells/mocks.

- Composer (§10): replaced the dead `+` button with a real Plus menu (Plan first + Use
  Browser/Computer/Terminal directives that affect routing); added a real voice button using the
  Web Speech API with an honest disabled state when unavailable; flags chips reflect selections.
- Plan-first (§10/§11): `CreateRunRequest.planFirst` → graph forces a real approval gate after
  planning ("Review the plan before Yanshi starts working."), reusing the existing interrupt/resume.
- Settings (§25/§26): rebuilt into a grouped layout with a left sub-nav — normal mode
  (General, Models, Permissions, Live Office, Workshop, Notifications, About) and a Developer
  group (Runtime, Sandbox, Database) shown only when Developer Mode is on. Added Theme (light/dark)
  with real dark-theme CSS. All actions remain real (provider save/health, restart/logs, tool
  toggles, docker config, macOS permission refresh).
- Runs (§11/§13): added grouping (Time / Project / Status), clickable run rows, and a per-message
  Details expander (concise key/values; raw JSON only in Developer Mode). Hybrid Transcript kept.
- Projects (§12): rebuilt the detail pane into a tabbed workspace — Overview, Runs, Files,
  Artifacts, Activity, Settings — all backed by real data. New `GET /projects/{id}/files`
  endpoint lists the real workspace via FileTool.
- Onboarding (§24): first-run modal ("Try a demo" runs a real file-scan; "Not now" persists
  `onboarded`). Added `AppSettings.onboarded` + `theme` with migration-safe defaults.
- Tests: added plan-first approval-gate test and project-files endpoint test (pytest 56 passed).
- Verification (all green): pnpm lint/typecheck/build, pytest 56, cargo check, cargo test 10,
  pnpm desktop:release (rebuilt sidecar + `.app`/`.dmg`). Visually smoke-checked New Task (+ menu),
  Onboarding, Projects tabs (Overview/Files real data), and grouped Settings via the web UI on the
  live runtime.
- Found + fixed during smoke: the previously-built sidecar binary was stale (missing the new
  settings fields); `desktop:release` rebuilds it. No mocks introduced.
- Deferred (documented, NOT shipped as shells): Automations, Workshop Create/Agent Editor/Office
  Editor/export, Live Office life-animations/hover-cards/fatigue/stations/project-scoped state,
  Search, reasoning levels, file upload, close-behavior prompt, codesign/notarization.

## Phase: Automations + Search + Artifacts (Final Completion Pass, 2026-06-08)

- Automations (spec §8/§12) — REAL, not a placeholder:
  - SQLite `automations` + `automation_runs` tables (CREATE IF NOT EXISTS; backward-compatible).
  - Models AutomationSummary/Create/Update; storage CRUD + record/list automation runs.
  - Endpoints: GET/POST `/automations`, PUT/DELETE `/automations/{id}`, POST `/automations/{id}/run`,
    GET `/automations/{id}/runs`.
  - Manual "Run now" launches a real run and links it; run history lists those runs.
  - Real background scheduler (`start_automation_scheduler`, started in `main()` only) runs due
    interval automations via `run_due_automations` + `is_automation_due`. Verified firing in smoke.
  - UI: project Automations tab (create with optional interval, enable/disable, Run now, delete,
    last-run time). Events automation.created/updated/deleted/started.
- Artifacts (spec §14) — real `GET /artifacts?projectId=&runId=` backed by the artifacts table;
  `list_artifacts` + `_artifact_from_row`. UI Artifacts page shows real artifacts with metadata
  (agent, created, path) and a "Reveal in Finder" action via a new Tauri `reveal_path` command
  (`open -R`); Reveal is shown only in the desktop app (honest web fallback).
- Search (spec §6) — replaced the empty placeholder with a real grouped search over projects, runs,
  artifacts, and workshop packs; clicking a result navigates; "No results." empty state.
- Tests: +4 (artifacts list, automation CRUD + manual run, interval due/run, interval validation).
  pytest 60 passed; cargo 10 passed; lint/typecheck/build green; desktop:release rebuilt sidecar
  (verified /automations + /artifacts on the bundled binary) and `.app`/`.dmg`.
- No-mock audit: clean (the web Reveal button is correctly hidden, not faked).
- Still deferred (no shells): Live Office life-system/hover-cards/fatigue/stations/project-scoped
  office state; Workshop Create/Agent Editor/Office Editor/export; AgentProfile/Instance/Actor3D +
  LiveOfficeState models; reasoning levels; composer file upload; close-with-active-runs prompt;
  codesign/notarization; `features/*` frontend split.

## Phase: Agent system + Live Office behavior + Workshop editors (2026-06-08)

Signature product features, all real (no mocks):
- Data model: `agent_profiles` table (seeded from defaults: name/role/prompt/personality/tools/
  accent/behaviorMode/station/taskPriority) + `live_office_state` table (project-scoped, theme/
  behaviorMode/cameraMode/stationLayout). Models AgentProfileSummary/LiveOfficeStateSummary +
  Create/Update requests. CREATE IF NOT EXISTS migrations (backward-compatible).
- Endpoints: GET/POST/PUT/DELETE `/agent-profiles`; GET/PUT `/live-office?projectId=`;
  POST `/workshop/export` (returns a real, re-importable .zip: manifest + agents/*.json + themes/office.json).
- Live Office behavior system (store `computeAgents`): derives status/currentTask/queue/fatigue per
  agent from REAL `agent.task.*` / `action.*` / `approval.*` events; fatigue accumulates from real
  work; idle agents get life/idle animations generated from behaviorMode + fatigue + idleness
  (never faked task progress). Profiles supply names/stations/accents/behavior.
- Live Office 3D rewrite (packages/live-office): stations + rest/coffee/break/meeting areas,
  hover cards (role/status/current task/queue/fatigue bar), queue bubbles, status dots, behavior-mode
  liveliness, life animations (coffee/chatting/phone/nap/walking/stretching) with movement to areas,
  camera modes (rear/iso), project station layout.
- Workshop rewrite: Installed / Agent Editor / Office Editor / Create+Export tabs. Agent Editor
  edits+saves AgentProfiles (name/station/behavior/accent/priority/personality/prompt; create/delete).
  Office Editor edits+saves global office (behavior/camera/station layout). Create+Export downloads
  a real pack (blob), re-importable under Installed. Project "Live Office" tab edits project-scoped
  office state and renders the live scene.
- Tests: +5 (agent profile seed/update, create/delete, live-office default/upsert project-scoped,
  export re-importable). pytest 64 passed; cargo 10 passed; lint/typecheck/build green;
  desktop:release rebuilt sidecar (verified /agent-profiles, /live-office, /workshop/export on the
  bundled binary) and `.app`/`.dmg`.
- Visual smoke: Live Office mini panel shows agents at stations with live idle actions
  (Chatting/Coffee/On phone); Agent Editor renders the full per-agent form with accents + Save.
- No-mock audit: clean.
- Still deferred (honest): full drag-drop 3D Office Editor (current is a practical numeric layout
  editor per spec's allowance); reasoning levels; composer file upload; codesign/notarization;
  `features/*` frontend split.

## Phase: Theme system + reasoning + profile injection (2026-06-08)

- Theme (headline override): replaced the warm ivory/beige palette with a tokenized theme layer.
  `styles.css` now uses CSS variables (`--background/surface/surface-elevated/border/text-*/accent/
  accent-glow/accent-soft/danger/warning/success/overlay/shadow`) for light (pure white) and dark
  (near-black) with a soft mint-green accent. All ~70 hardcoded colors were migrated to tokens
  (verified: no hardcoded hex outside the token block). Added System/Light/Dark setting
  (`AppSettings.theme` default `system`); App resolves system via `matchMedia` and sets
  `data-theme`, reacting to OS changes. Live Office 3D is theme-aware (floor/lighting/environment
  by `dark`, green glow for active workers). Verified light (white) and dark (black) visually.
- Reasoning levels (Problem 7): `AppSettings.reasoning` + per-run `CreateRunRequest.reasoning`
  override; threaded run→graph→Manager planning. The planning system prompt + user message now carry
  a reasoning directive (low=short, medium=balanced, high=detailed, extra_high=thorough+review).
  Composer shows a Reasoning chip. Tests verify the level and settings default reach the prompt.
- AgentProfile injection (Problem 2): the graph injects each agent's configured personality/prompt
  into the Manager planning, Manager synthesis, and Browser summary system messages
  (`_agent_persona`). The Agent Editor now has real runtime effect. Test verifies a profile's
  personality string reaches the manager prompt. Raw prompts are never shown in normal UI.
- Verification: pnpm lint/typecheck/build green; pytest 66 passed (+4); cargo 10 passed;
  desktop:release rebuilt the sidecar and bundles. No-mock audit clean.
- Honestly NOT done this session (documented): persistent AgentInstance/AgentActor3D tables;
  2.5D drag-drop Office Editor; Q-style worker mesh upgrade; file upload; close-with-active-runs
  prompt; packaged click/type/shortcut manual verification; Docker command smoke; App.tsx split;
  codesign/notarization.

## Phase: Instance/Actor persistence + upload + close-prompt + Q-style workers (2026-06-08)

- AgentInstance + AgentActor3D persistence: `agent_instances` + `agent_actor3d` tables (UNIQUE per
  profile×project), models, storage (`ensure_agent_team`, `list_agent_instances/actors`,
  `update_agent_state` with status→animation/expression/motion mapping), endpoints
  (`/agent-instances`, `/agent-actors`). Project create seeds the team; the graph updates instance/
  actor state from real agent-task start/done/fail (fatigue accumulates). Frontend loads persisted
  instances and seeds liveAgents (restored office shows last-known status/fatigue before events).
  Survives restart (SQLite). Tests: persistence+update from a real run, restart survival.
- File upload (Composer): `POST /uploads?projectId=` copies into `<workspace>/uploads/` with
  basename sanitize (path-traversal guard) + 50 MB limit; returns input metadata. Files are real
  workspace files the File Agent scans. Composer `+` menu → file input → chips with remove → run
  task references `Uploaded files: …`. Tests: traversal sanitize, scannable, project-scoped.
- Close-with-active-runs prompt: Rust tracks active run count (`update_active_runs`); on window
  close with active runs it emits `desktop:close-prompt` + prevents close; the frontend shows a
  modal — Pause and quit (real `pauseAllRuns` + `quit_app`), Keep running (`hide_main_window`),
  Cancel. No active runs → hide to tray as before. New commands: update_active_runs/hide_main_window/quit_app.
- Live Office Q-style workers: replaced capsules with procedural mechanical figures (cylindrical
  torso + chest plate, boxy head with glowing status eyes, arms, feet, role props per station),
  accent-colored, green glow when active. Verified in Full Office View.
- Docs: rewrote CURRENT_STATUS.md and NEXT_STEPS.md as clean snapshots (removed stale "Search empty"/
  "Workshop Create missing"/obsolete deferred claims).
- Verification: pnpm lint/typecheck/build green; pytest 70 passed (+4); cargo check + test 10 passed;
  desktop:release rebuilt sidecar (verified /agent-instances, /agent-actors, /uploads on the bundled
  binary). No-mock audit clean.
- Honestly deferred this session: drag-drop 2D/2.5D Office Editor; App.tsx → features/* split;
  interactive packaged Computer click/type/shortcut + Docker smokes; codesign/notarization.

## Phase: Persona-everywhere + 2D Office Editor + final cleanup (2026-06-09)

- AgentProfile persona injected into every agent type: Manager/Browser via LLM system prompts;
  File/Computer/Terminal/Reviewer via the recorded action `input.persona` (execution context,
  Developer-Mode visible — action.created events now carry `input`). Persona is wrapped as a
  delimited *advisory* section so user-edited profiles can't override instructions/safety
  (prompt-injection separation). Tests: File + Terminal + Computer persona present.
- Fixed a real latent bug: `ComputerTool.capture_screen` called `_status_result(status)` without the
  required `needs_screen_recording` kwarg, crashing the screenshot path when permission is missing;
  now returns the honest permission-required state.
- Office Editor upgraded to a real visual 2D drag canvas (SVG): draggable station dots, area blocks
  (rest/coffee/break/meeting/workshop), snap-to-grid toggle, reset, persists `stationLayout` to
  LiveOfficeState (drives Live Office), exports via Workshop pack. Verified: dragging Manager
  persisted `[-1.4, -2.0]` to the office state.
- Docs: rewrote ACCEPTANCE_CHECKLIST.md into clean categories (complete / partial / manual-verify /
  release-only) with no contradictions.
- Packaged verification (this machine, non-interactive): `.app` launches `mode=bundled-sidecar`;
  Computer bridge rejects unauthorized (401); runtime task → native `open-app TextEdit` completed;
  6 AgentInstances persisted in the packaged app. Interactive checks (click/type/shortcut/screenshot
  need Accessibility/Screen-Recording grant; Docker needs the daemon; tray/notifications/shortcuts
  need a human) remain pending and are recorded honestly.
- Verification: pnpm lint/typecheck/build green; pytest 72 passed (+3); cargo test 10 passed;
  pnpm desktop:release rebuilt sidecar + bundles. No-mock audit clean.
- Deferred honestly: App.tsx → features/* split (large; would risk the green build this session);
  furniture/path/collision editing in the Office Editor; modelled worker art; codesign/notarization.

## Phase: App.tsx split + Office furniture + final hardening (2026-06-09)

- App.tsx split (P0 #1): refactored the ~2,090-line App.tsx into feature modules with behavior
  preserved. New layout: `lib/shared.tsx` (types + helpers: eventSummary/agentLabel/groupRuns/
  permission*/EmptyView/TranscriptMessage + BEHAVIOR_OPTIONS/STATION_OPTIONS); `features/`
  new-task, search, projects, runs, artifacts, automations, workshop, settings, developer,
  live-office; `components/modals.tsx` (Onboarding + CloseRunsModal). App.tsx is now 174 lines
  (orchestration + nav only). Verified via typecheck + build + a runtime UI smoke (all views render,
  lazy Live Office loads). Extraction used `sed` line-range copies (no transcription) + auto-export.
- Office Editor furniture (P0 #2): added `FurnitureItem` + `furniture` to LiveOfficeState (model +
  `furniture_json` column with idempotent ALTER migration + get/upsert/export). Office Editor gained
  a furniture palette (desk/plant/shelf/couch/table/lamp), draggable furniture on the 2D canvas,
  a removable furniture list; the 3D Live Office renders furniture meshes. Path/collision metadata
  intentionally not added as fake controls (agents use lerp movement; real pathfinding is future).
  Test: furniture persists + appears in the exported pack.
- Live Office polish (P0 #4): status-driven ground glow ring under workers (soft green when working,
  dim when idle); workers already Q-style with role props + glowing eyes.
- Packaged verification (P0 #3, this machine, non-interactive): `.app` launches `mode=bundled-sidecar`;
  `/agent-instances`,`/agent-actors`,`/live-office` 200; Computer bridge 401 on no/bad token; runtime
  task → native `open-app TextEdit` completed; furniture round-trips in the packaged app; provider
  settings never returns the API key; no secret/token in the runtime log. Interactive items
  (click/type/shortcut/screenshot → Accessibility/Screen-Recording; Docker → daemon+image;
  tray/notifications/shortcuts → human) remain pending.
- Verification: pnpm lint/typecheck/test/build green; pytest 73 passed; cargo check + test 10 passed;
  pnpm desktop:release built `.app` + `.dmg` (first DMG attempt hit a transient bundle_dmg flake;
  succeeded on retry after clearing the stale dmg). No-mock audit clean.
