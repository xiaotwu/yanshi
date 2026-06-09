# Current Status

_Last updated: 2026-06-09. This is a clean snapshot; phase history lives in IMPLEMENTATION_LOG.md._

> **RC status: Final RC local build complete. Public notarized release pending Apple Developer ID
> signing/notarization.** Automated suite green (pytest 73, cargo 10, lint/typecheck/build);
> packaged-app QA passed for all non-interactive items incl. a real Docker command smoke; see
> docs/RELEASE_NOTES_RC.md.

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
- AgentProfile persona injected into all agent execution contexts (advisory, prompt-injection-separated).
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

- **Office Editor**: visual 2D drag canvas with stations + area blocks + **editable furniture**
  (desk/plant/shelf/couch/table/lamp; draggable + removable), snap + reset; persists and drives the
  3D Live Office; exports/imports as a Workshop pack. Path/collision metadata not added (agents use
  lerp movement; real pathfinding is future — not stubbed).
- **Live Office workers**: Q-style procedural mechanical figures with role props + status glow
  (not modelled art assets).
- **Frontend structure**: `App.tsx` split into `lib/shared` + `features/*` + `components/*`
  (App.tsx now 174 lines). Finer `components/composer|layout|ui` extraction is optional future work.

## Packaged verification (2026-06-09, this machine)

Non-interactive checks **passed** in the packaged `.app`: bundled-sidecar launch + health +
clean-env launch; project/standalone/project-scoped runs; multi-agent plan + agent_tasks; Hybrid
Transcript events; file upload (+ traversal/size safety); **real Docker command smoke** (daemon up:
completed, stdout captured, settings applied, log artifact); Computer `open-app`; bridge 401 +
no token in logs; approvals request/persist/deny/resume; Workshop export/re-import + unsafe-pack
rejection; Agent Editor save; Office Editor furniture persist + export; AgentInstance/AgentActor3D
persistence; automations run + history; secret audit (no API key in settings/SQLite/events/logs);
Browser → honest `playwright_browser_binaries` missing-dependency state.

Still pending (interactive / environment-limited, honest states verified):
- Computer `click/type/shortcut` (one-time macOS Accessibility grant) and `screenshot`
  (Screen Recording grant) — honest permission-required state verified; `open-app` verified working.
- Tray actions / notifications / global shortcuts / close-prompt / Light-Dark-System in the
  packaged `.app` (functional in dev; need a packaged interactive pass).

## Not done (optional polish)

- Office Editor path/collision metadata + real agent pathfinding; modelled worker art;
  finer `components/composer|layout|ui` split; codesign + notarization (guide in
  docs/BUILD_AND_RELEASE.md).

## Build / run

- Distributable build: `pnpm desktop:release` → `apps/desktop/src-tauri/target/release/bundle/macos/Yanshi.app`
  and `.../dmg/Yanshi_0.1.0_aarch64.dmg` (sidecar at `Contents/Resources/resources/yanshi-runtime-sidecar`).
- Dev: `pnpm desktop:dev`. Web UI smoke: `pnpm --filter @yanshi/desktop dev --host 127.0.0.1`.

## Tests

- Python: `uv run --project runtime/python pytest` — 73 passed.
- Rust: `cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml` — 10 passed.
- JS: lint/typecheck/build green (no JS unit tests yet).

## Distribution

- Functionally distributable local build exists. **Codesign/notarization remain** for public release.
