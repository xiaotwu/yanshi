# Current Status

_Last updated: 2026-06-08. This is a clean snapshot; phase history lives in IMPLEMENTATION_LOG.md._

## Complete (real, tested, no mocks)

**Platform & runtime**
- macOS Tauri desktop app; bundled standalone PyInstaller runtime sidecar (`pnpm desktop:release`)
  launches in `mode=bundled-sidecar` with no uv/repo/venv dependency.
- Python LangGraph runtime, SQLite persistence, REST + WebSocket event stream.
- OpenAI-compatible provider client/settings; API key stored as `apiKeyRef` in an off-DB secret
  store (file default; opt-in macOS Keychain), never returned in responses/logs/events.
- Secure localhost Computer bridge (random port + bearer token, token never logged).

**Agents & execution**
- Multi-agent queue execution; Manager planning/synthesis; Reviewer reviews; approval interrupt/resume.
- Reasoning levels (Low/Medium/High/Extra) persisted + per-run override, affect Manager planning.
- AgentProfile personality/prompt injected into Manager/Browser execution prompts.
- Tools: File, Browser (Playwright), Computer (screenshot + bridge click/type/shortcut/open-app),
  Terminal/Docker sandbox. Tool-availability toggles enforced (`tool_disabled`). Docker settings
  validated + applied (`docker_config_invalid`).

**Data model & persistence**
- Project / Run / Action / Observation / Approval / Artifact / WorkshopPack / Automation /
  AgentProfile / LiveOfficeState / **AgentInstance** / **AgentActor3D** tables. Project-scoped
  Agent teams + office state persist and survive app restart.

**Product surfaces**
- New Task / Composer: `+` menu (Upload files, Plan first, tool directives), reasoning chip,
  permission + project chips, voice button, file upload with chips/remove, templates.
- Runs: grouping (time/project/status) + Hybrid Transcript (raw events Developer-only).
- Projects: tabbed workspace (Overview / Runs / Files / Artifacts / Automations / Live Office /
  Activity / Settings) on real data.
- Search: real grouped search across projects/runs/artifacts/packs.
- Artifacts: real list + metadata + Reveal in Finder (desktop).
- Automations: create/enable-disable/Run now/run history + interval scheduler.
- Workshop: Installed / Agent Editor / Office Editor / Create+Export (re-importable pack).
- Live Office: Q-style mechanical workers, stations + rest/coffee/break/meeting areas, hover cards,
  queue bubbles, fatigue, behavior modes, life animations, camera modes, theme-aware; mini / full /
  pop-out. Actor state persisted (AgentInstance/Actor3D) and restored on restart.
- Settings: grouped normal mode + Developer Mode; **System / Light / Dark** theme (tokenized,
  green accent, no beige).
- Onboarding first-run modal; tray/menu, notifications, global shortcut; close-with-active-runs
  prompt (Pause and quit / Keep running / Cancel).

## Partial / honest first version

- **Office Editor**: real persisted editor (theme, behavior, camera, numeric station layout applied
  to Live Office) — not yet a drag-drop 2D/2.5D canvas.
- **Live Office workers**: Q-style procedural mechanical figures (not modelled art assets).
- **AgentProfile → runtime**: personality/prompt injected into Manager/Browser; not yet every agent.

## Manual verification pending (interactive / environment-limited)

- Packaged Computer `click/type/shortcut` (needs a one-time macOS Accessibility grant).
- Docker command smoke (needs Docker Desktop running + image pre-pulled).
- Tray actions / notifications / global shortcuts in the packaged `.app`.

## Not done (optional polish)

- Drag-drop 2D/2.5D Office Editor; `App.tsx` split into `features/*`; modelled worker art;
  codesign + notarization (guide in docs/BUILD_AND_RELEASE.md).

## Build / run

- Distributable build: `pnpm desktop:release` → `apps/desktop/src-tauri/target/release/bundle/macos/Yanshi.app`
  and `.../dmg/Yanshi_0.1.0_aarch64.dmg` (sidecar at `Contents/Resources/resources/yanshi-runtime-sidecar`).
- Dev: `pnpm desktop:dev`. Web UI smoke: `pnpm --filter @yanshi/desktop dev --host 127.0.0.1`.

## Tests

- Python: `uv run --project runtime/python pytest` — 70 passed.
- Rust: `cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml` — 10 passed.
- JS: lint/typecheck/build green (no JS unit tests yet).

## Distribution

- Functionally distributable local build exists. **Codesign/notarization remain** for public release.
