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

## Pending

- [ ] Bundle a standalone Python runtime sidecar for truly distributable `.app` packages.
- [ ] Manual Docker command smoke after the required image is available locally or image pull can complete.
- [ ] Wire persisted Docker Developer Mode settings into per-run TerminalTool construction.
- [ ] Implement a concrete desktop bridge transport from Tauri to runtime for packaged Computer Use control actions; runtime already supports bridge calls when a bridge URL is configured.
- [ ] Manually verify menubar/tray actions and notification delivery in the packaged desktop app.
- [ ] Workshop export and richer pack management.
- [ ] Live Office office editor.
- [ ] Rich Developer Mode graph/checkpoint/database panels.
- [ ] Manual verification of global shortcuts, tray actions, notifications, and packaged `.app` launch.
- [ ] Full final acceptance pass.

## Acceptance Criteria

Yanshi is not final-complete until the desktop app starts, the runtime starts with it, real runs and events work, approvals pause/resume, persistence works, Live Office consumes real events, Workshop validates and imports real packs, settings persist real state, Developer Mode exposes real runtime data, tests/builds pass, and no user-facing mock remains.
