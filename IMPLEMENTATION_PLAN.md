# Yanshi Implementation Plan

## Current Milestone

Milestone 1-6 foundation and hardening slice is implemented: monorepo, Tauri shell, React UI, Python runtime, REST/WebSocket API, SQLite persistence, LangGraph checkpointing, approvals, event protocol, file-tool sandbox, Workshop validation/import hardening, Live Office event visualization, Developer Mode event view, Tauri runtime reliability states, OpenAI-compatible provider settings/client, persisted app settings, project-scoped workspaces, real macOS permission status probes, persisted agent queues, Browser summarization, Docker sandbox execution path, queued multi-agent execution, Tauri Computer Use bridge commands, tray/menu actions, event notifications, lazy Live Office panel/full view/pop-out, tightened CSP, and build/release docs.

## Completed

- [x] Monorepo setup with pnpm workspaces and uv runtime project.
- [x] Tauri + React + Vite desktop shell.
- [x] Python Yanshi Runtime sidecar command.
- [x] REST API: health, runtime status, runs, approvals, events, Workshop validation.
- [x] WebSocket event stream.
- [x] SQLite schema for runs, events, approvals, actions, observations, artifacts, settings, and Workshop packs.
- [x] LangGraph run skeleton with SQLite checkpointing.
- [x] Event protocol with durable storage and UI consumption.
- [x] Default agent profiles and Live Office actor states.
- [x] Permission/risk policy and approval pause/resume.
- [x] File tool with real workspace sandbox and JSON artifact output.
- [x] Browser, Computer Use, and Docker readiness states without fake success.
- [x] New Task UI, Runs view, Approval cards, Artifacts entry, Workshop validation, Settings, Developer Mode, and Live Office.
- [x] Tauri sidecar startup/restart/status bridge.
- [x] Tauri runtime setup-required state with runtime log path and restart/log commands.
- [x] OpenAI-compatible model provider client with settings persistence and health check.
- [x] Runtime Settings persistence for normal-mode preferences and tool toggles.
- [x] Project CRUD with durable project records and real workspace directories.
- [x] Project-scoped run creation and file-tool workspace routing.
- [x] Projects UI and project selector in New Task.
- [x] Browser Tool navigation/extraction path with Playwright install-required states.
- [x] Conservative Terminal Tool execution for read-only workspace commands.
- [x] SQLite storage locking for concurrent desktop hydration requests.
- [x] Workshop pack import, install persistence, enable/disable state, and UI.
- [x] Runtime CORS supports localhost/127.0.0.1 development ports.
- [x] Global shortcut registration for opening Yanshi.
- [x] Tauri release build producing `.app` and `.dmg`.
- [x] Tauri Settings bridge reports native macOS Accessibility and Screen Recording status.
- [x] Runtime Computer Tool probes macOS permission state and distinguishes missing permissions from missing action bridge.
- [x] Runtime Computer Tool can perform real macOS screen capture and persist PNG artifacts when permission is granted.
- [x] Workshop upload filenames are sanitized to basename-only incoming files.
- [x] Workshop uploads enforce raw upload size, uncompressed zip size, per-member size, file count, unsafe path, executable, and symlink limits.
- [x] Manager creates provider-backed structured JSON plans for general provider tasks.
- [x] Project-level and agent-level queue items persist in SQLite and emit real `agent.task.*` events.
- [x] File, Browser, Computer, Terminal, Manager, and Reviewer work is mapped to persisted queue assignments.
- [x] Reviewer creates a real failure review observation for failed runs.
- [x] Browser Tool was manually smoked with installed Playwright Chromium and verified a screenshot artifact.
- [x] Browser page summarization uses the configured provider after real page capture.
- [x] Docker sandbox command path uses Docker CLI with workspace bind mount, no network, resource limits, timeout, lock metadata, and terminal log artifacts.
- [x] Executor now runs persisted queued `agent_tasks` instead of a single keyword branch.
- [x] Browser, File, Computer, Terminal, Manager, and Reviewer assignments can execute from assignment data with original-request context.
- [x] Manager performs final synthesis after multiple agent observations.
- [x] Reviewer records final-quality/failure review for multi-agent runs without fake success.
- [x] Tauri exposes real macOS click/type/shortcut/open-app Computer bridge commands.
- [x] Runtime Computer Tool calls a configured desktop bridge for control actions and otherwise reports `computer_use_control_bridge`.
- [x] Tray/menu includes Open Yanshi, Current Tasks, Open Live Office, Pause All, and Quit.
- [x] Runtime-event notifications are wired for approvals, run completion, run failure, and runtime error.
- [x] Live Office is lazy-loaded, default-closed by setting, auto-opens on real run start, user-closeable during runs, has full view, and has a pop-out Tauri window path.
- [x] Tauri CSP is no longer disabled.
- [x] Developer Mode settings persist Docker image and resource-limit preferences.
- [x] Build/release docs and setup-required runtime packaging status are documented.
- [x] Tauri runs a secure localhost Computer bridge HTTP server (random port + per-launch random bearer token) and injects `YANSHI_COMPUTER_BRIDGE_URL`/`YANSHI_COMPUTER_BRIDGE_TOKEN` into the spawned runtime process so Computer Use control actions are connected end-to-end. Missing/invalid tokens are rejected (401); unknown ops 404; non-POST 405. Covered by Rust unit + end-to-end tests and Python bridge-client tests.
- [x] Repository cleanup: `.playwright-mcp/` untracked and ignored; root smoke screenshots moved to `docs/assets/`; `.gitignore` updated.
- [x] Standalone PyInstaller runtime sidecar (`pnpm sidecar:build`) bundled into the app via the `tauri.sidecar.conf.json` overlay (`pnpm desktop:release`); packaged app launches it in `mode=bundled-sidecar` with no uv/repo dependency.
- [x] Persisted Docker Developer settings wired into per-run Docker execution with `docker_config_invalid` validation (tests).
- [x] Tool-availability settings enforced with honest `tool_disabled` observations for Browser/Computer/Terminal (tests).
- [x] Provider API key moved to an `apiKeyRef` + off-DB secret store (file default, opt-in Keychain) with legacy migration + VACUUM (tests).
- [x] Computer bridge verified end-to-end in the packaged app for `open-app`; 401 on unauthorized bridge requests.

## Product surfaces (2026-06-08)

- [x] Composer Plus menu (Plan first + tool directives) + real voice button; dead `+` removed.
- [x] Plan-first approval gate (real interrupt/resume), tested.
- [x] Settings grouped normal mode + Developer Mode; light/dark theme.
- [x] Runs grouping + per-message detail expanders (raw events Developer-only).
- [x] Projects tabbed workspace + `GET /projects/{id}/files`.
- [x] First-run onboarding with a real demo run; `onboarded`/`theme` settings.

## Final Completion Pass (2026-06-08)

- [x] Automations: tables + endpoints + storage + interval scheduler + project Automations tab; tested.
- [x] Artifacts: `/artifacts` API + Artifacts page with metadata + `reveal_path` Tauri command.
- [x] Search: real grouped search across projects/runs/artifacts/packs.

## Persistence + Upload + Close-prompt + Q-style workers (2026-06-08)

- [x] AgentInstance + AgentActor3D persistence (tables, endpoints, runtime updates, restart survival, tests).
- [x] Composer file upload (safe workspace copy, chips, File Agent scannable, tests).
- [x] Close-with-active-runs prompt (Rust + frontend modal; real pause/hide/cancel).
- [x] Live Office Q-style mechanical workers.
- [ ] Pending: drag-drop 2D Office Editor; App.tsx → features/* split; interactive packaged verification.

## Theme + Reasoning + Profile Injection (2026-06-08)

- [x] Tokenized theme layer (System/Light/Dark, green accent, no beige); theme-aware Live Office.
- [x] Reasoning levels persisted + per-run override, wired to Manager planning; Composer chip.
- [x] AgentProfile personality/prompt injected into Manager/Browser execution prompts.

## Agent System + Live Office (2026-06-08)

- [x] AgentProfile + LiveOfficeState data models, endpoints, migrations, tests.
- [x] Live Office behavior/fatigue/hover/queue/stations/life-animation system from real events.
- [x] Workshop Agent Editor / Office Editor / Create + real pack export.
- [x] Project-scoped Live Office tab + state.

## Pending

- [ ] Persist AgentInstance/AgentActor3D; full drag-drop 3D Office Editor.
- [ ] Live Office life-animations, hover cards, fatigue, stations, project-scoped office state.
- [ ] AgentProfile/Instance/Actor3D + LiveOfficeState data models + migrations.
- [ ] Split frontend into `features/*` per spec §7; add Search; close-with-active-runs prompt.
- [ ] Codesign + notarize the bundle for second-machine / store distribution.
- [ ] Manually verify Computer bridge `click/type/shortcut` in the packaged app after granting Accessibility.
- [ ] Manual Docker command smoke after the required image is available locally or image pull can complete.
- [ ] Manually verify menubar/tray actions and notification delivery in the packaged desktop app.
- [ ] Workshop export and richer pack management.
- [ ] Live Office office editor.
- [ ] Rich Developer Mode graph/checkpoint/database panels.
- [ ] Manual verification of global shortcuts, tray actions, notifications, and packaged `.app` launch.
- [ ] Full final acceptance pass.

## Acceptance Criteria

Yanshi is not final-complete until the desktop app starts, the runtime starts with it, real runs and events work, approvals pause/resume, persistence works, Live Office consumes real events, Workshop validates and imports real packs, settings persist real state, Developer Mode exposes real runtime data, tests/builds pass, and no user-facing mock remains.
