# AGENTS.md — Yanshi Full Build Instructions

This repository is for **Yanshi**.

Yanshi is a macOS-first AI Agent desktop workspace with animated virtual workers.

## Core product

Yanshi combines:

- Tauri desktop shell
- React + Vite + TypeScript frontend
- React Three Fiber / three.js 2.5D/3D Live Office
- Python Yanshi Runtime sidecar
- LangGraph orchestration
- Action / Observation / Tool / Sandbox execution model
- Multi-Agent worker system
- SQLite persistence
- macOS Computer Use
- Browser Use
- File / terminal / Docker sandbox tools
- Workshop customization
- Menubar, notifications, global shortcuts
- Developer Mode

## Critical product principle

Yanshi must feel simple on the surface and powerful underneath.

Normal mode must be clean, concise, and non-technical.

Avoid:
- Long text inside buttons
- Repeated subtitles under headings
- Dense dashboard cards
- Mock/demo-only UI
- Raw logs in normal mode
- Overexplaining obvious controls

Use:
- Short labels
- Icons with tooltips
- Hover cards
- Expandable details
- Developer Mode for technical detail
- Settings descriptions only where needed

## No mock policy

Do not ship mock, fake, placeholder, scaffold-only, demo-only, or “coming soon” implementations.

Allowed:
- Test fixtures in tests only
- Deterministic sample data for unit tests only
- Clear not-configured states for missing real external dependencies
- Permission-required states when macOS access is missing

Not allowed:
- Fake successful tool execution
- Fake browser/computer/file results
- Fake LangGraph runtime
- Fake agent runs in user-facing flows
- Fake Workshop installs
- Fake provider health
- Fake approval completion

If something cannot run because of missing external credentials, missing OS permission, or unavailable local daemon, implement the real path and show the exact missing requirement.

## Runtime architecture

Use **Yanshi Runtime** terminology.

Yanshi Runtime is:

```txt
LangGraph orchestration
+
Action / Observation execution model
+
Tool providers
+
Sandbox
+
Approvals
+
Event streaming
```

Do not brand the user-facing app as OpenHands. OpenHands-style ideas are architectural references only.

## Desktop architecture

Use:

```txt
Tauri
React + Vite + TypeScript
Tailwind CSS
Zustand
React Three Fiber
three.js
@react-three/drei
Python runtime sidecar
SQLite
REST + WebSocket
```

Tauri handles:
- desktop shell
- app windows
- menubar
- global shortcuts
- notifications
- macOS permission bridge
- Computer Use bridge

Python runtime handles:
- LangGraph runtime
- agents
- tool execution
- sandbox
- approvals
- artifacts
- runtime events
- SQLite run/checkpoint data

## Required app sections

Sidebar default:

```txt
Yanshi
New Task
Search
Projects
Runs
Workshop
Settings
```

Conditional:

```txt
Approvals
Artifacts
Developer
```

## Required first core agents

- Manager Agent
- Browser Agent
- Computer Agent
- File Agent
- Reviewer Agent

Developer Mode may enable:
- Code / Terminal Agent

## Required build style

Codex must first create a complete plan and wait for approval.

After approval, Codex may execute freely:
- create files
- delete obsolete files
- install dependencies
- run tests
- refactor architecture
- update docs
- perform visual checks
- continue until the project is complete

## Continuation requirement

Maintain these files during implementation:

- `IMPLEMENTATION_PLAN.md`
- `IMPLEMENTATION_LOG.md`
- `CURRENT_STATUS.md`
- `NEXT_STEPS.md`
- `ACCEPTANCE_CHECKLIST.md`

Update them after each major phase so another Codex session can resume.

## Required verification

Run all applicable checks before reporting completion:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
cargo check
cargo test
uv run pytest
tauri build
```

If commands differ, document the actual commands and why.

## Final acceptance

A task is not complete until:

- the app starts
- runtime starts with desktop app
- real run creation works
- real event streaming works
- real approval flow works
- real persistence works
- Live Office consumes real events
- Workshop validates/imports real packs
- Settings has real state
- Developer Mode exposes real runtime data
- tests pass
- build passes
- no user-facing mock remains
