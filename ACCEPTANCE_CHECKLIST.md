# Acceptance Checklist

_Clean snapshot, 2026-06-09. Categories: ✅ complete · 🟡 partial · 🔍 manual-verify pending ·
🚀 release-only pending. No contradictory entries — superseded items were removed._

## ✅ Complete (real, automated-tested where applicable)

- App + bundled runtime sidecar launch (`bundled-sidecar` mode, no uv/repo dependency).
- REST + WebSocket, SQLite persistence, LangGraph runtime, Action/Observation model.
- OpenAI-compatible provider; API key as `apiKeyRef` in off-DB secret store; never in
  responses/logs/events.
- Computer bridge (localhost, random port, bearer token; token never logged).
- Multi-agent queue execution; Manager planning/synthesis; Reviewer; approval interrupt/resume.
- Reasoning levels persisted + per-run override → Manager planning depth.
- AgentProfile persona injected into **all** agent execution contexts (Manager/Browser LLM prompts;
  File/Computer/Terminal/Reviewer action context), delimited as advisory (prompt-injection separation).
- Tools: File, Browser (Playwright), Computer (screenshot + bridge click/type/shortcut/open-app),
  Terminal/Docker. Tool toggles enforced; Docker settings validated + applied.
- Data model: Project / Run / Action / Observation / Approval / Artifact / WorkshopPack /
  Automation / AgentProfile / LiveOfficeState / AgentInstance / AgentActor3D. Project-scoped agent
  teams + office state persist and survive restart.
- New Task / Composer: `+` menu (upload/plan-first/tool directives), reasoning chip, permission +
  project chips, voice, file upload with chips, templates.
- Runs grouping + Hybrid Transcript (raw events Developer-only).
- Projects tabbed workspace (Overview/Runs/Files/Artifacts/Automations/Live Office/Activity/Settings).
- Search (grouped, real). Artifacts (list + metadata + Reveal). Automations (CRUD + Run now +
  interval scheduler). Workshop (Installed / Agent Editor / Office Editor / Create+Export).
- Office Editor: visual 2D drag canvas (draggable stations, areas, snap, reset) persisting real
  layout that drives Live Office; export/import via Workshop pack.
- Live Office: Q-style mechanical workers with role props, hover cards, queue bubbles, fatigue,
  behavior modes, life animations, camera modes, theme-aware; mini/full/pop-out; persisted actors.
- Settings: grouped normal + Developer Mode; System/Light/Dark theme (tokenized, green accent, no beige).
- Onboarding; tray/menu; notifications; global shortcut; close-with-active-runs prompt.
- Verification: pnpm lint/typecheck/build green; pytest 72 passed; cargo test 10 passed;
  `pnpm desktop:release` builds `.app` + `.dmg` (bundled sidecar verified serving new endpoints).

- Office Editor: visual 2D drag canvas with stations + areas + **editable draggable furniture**;
  persists + drives Live Office; exports/imports via pack. (Path/collision metadata + real
  pathfinding are future, not stubbed.)
- `App.tsx` split into `lib/shared` + `features/*` + `components/*` (App.tsx now 174 lines);
  behavior preserved (typecheck + build + UI smoke).

## 🟡 Partial (real first version)

- Live Office workers are procedural Q-style figures (not modelled art assets).
- Office Editor has no path/collision editing yet.

## ✅ Packaged verification passed (2026-06-09, non-interactive)

- `.app` launch → `mode=bundled-sidecar`; `/agent-instances`,`/agent-actors`,`/live-office` → 200.
- Computer bridge rejects no-token/bad-token → 401; runtime task → native `open-app TextEdit` completed.
- Office furniture round-trips in the packaged app; provider settings never returns the API key;
  no secret/token in the runtime log.

## 🔍 Manual verification pending (interactive / environment-limited)

- Packaged Computer `click` / `type` / `shortcut` (need a one-time macOS Accessibility grant).
- Computer `screenshot` (needs Screen Recording grant).
- Docker command completion (needs Docker Desktop running + pre-pulled image).
- Tray actions / notifications / global shortcuts / close-prompt / Light-Dark-System in the
  packaged `.app` (functional in dev; need a packaged interactive pass).

## 🚀 Release-only pending

- Codesign (Developer ID) + notarization + stapling for distribution beyond the build machine.
