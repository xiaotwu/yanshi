<div align="center">

# Yanshi · 偃师

**A macOS-first AI agent workspace with a living project atelier.**

Chats, tools, projects, files, and animated workers — connected in one calm desktop app.

![macOS](https://img.shields.io/badge/macOS-Apple%20Silicon-111?logo=apple&logoColor=white)
![Tauri](https://img.shields.io/badge/Tauri-2-24C8DB?logo=tauri&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)
![Python](https://img.shields.io/badge/Python-3.12-3776AB?logo=python&logoColor=white)
![Runtime](https://img.shields.io/badge/runtime-FastAPI%20%C2%B7%20LangGraph%20%C2%B7%20SQLite-2fc279)
![Status](https://img.shields.io/badge/status-v0.1%20Local%20Final%20Candidate-2fc279)

[Documentation](https://xiaotwu.github.io/yanshi/) ·
[Build & Release](docs/BUILD_AND_RELEASE.md) ·
[AI Integrations](docs/AI_INTEGRATIONS.md) ·
[Error Catalog](docs/ERROR_CATALOG.md)

</div>

---

**Yanshi** (偃师) means a craftsman of animated mechanisms. The app brings that idea to the
desktop: it turns AI agent work into a visual workspace where agents plan, act, review, and
rest inside a project-scoped **atelier**. Chats are the surface; underneath, a real local runtime
handles agents, tools, approvals, persistence, and a live event stream.

It is **local-first** and **honest** — every feature shows a real state. If a model key, a macOS
permission, Chromium, or Docker is missing, Yanshi shows a clear *setup-required* or *blocked*
state instead of faking success.

## What Yanshi does

- **Chats become workspaces** — standalone or project-scoped conversations with their own files,
  outputs, and live progress.
- **Yanshi Atelier · 偃师工坊** — animated workers mirror real agent state at their stations; idle
  life animation is decorative and never fakes progress.
- **A real runtime, bundled** — a FastAPI / LangGraph / SQLite runtime ships *inside* the macOS
  app as a standalone sidecar; no separate Python install at run time.
- **Tools with honest states** — File, Browser, Computer Use, and Terminal/Docker, each with a
  real availability or permission-required state.
- **AI Integrations** — OpenAI-compatible LLM providers (real save/test), an ACP external-agent
  foundation, MCP server configuration, and agent Skills.
- **App-wide error toasts** — every failure surfaces as a coded `YANSHI_<AREA>_<NNN>` toast with a
  short reason; details stay in Developer Mode.

## Current status

Yanshi is a **v0.1 Local Final Candidate**.

✅ Local packaged app validated (Codex global review passed)
✅ Documentation site validated and ready
✅ Error toast system accepted
✅ No active P0/P1/P2 issues from the latest review
⚠️ Public distribution still requires Apple Developer ID signing, notarization, stapling, and
Gatekeeper verification on a second Mac
⚠️ Some tools require external setup (Chromium) or macOS permissions (Accessibility / Screen
Recording)

It is ready for **local final-candidate use** on the build machine. It is **not yet a public,
notarized macOS release**. Unimplemented and future capabilities are documented honestly below
and in [Final Product Gaps](docs/FINAL_PRODUCT_GAPS.md).

## Quick start

```bash
pnpm install        # install the TypeScript workspace
pnpm desktop:dev    # run the Tauri desktop app in dev mode
```

Workspace checks and bundle:

```bash
pnpm test           # Vitest suites
pnpm build          # build packages + the desktop web bundle
pnpm desktop:release # build the packaged macOS .app + .dmg (bundled runtime)
```

> No global `pnpm dev` — the desktop app runs with `pnpm desktop:dev`, and the runtime can be run
> standalone with `pnpm runtime:dev`.

## Build the macOS app

```bash
pnpm desktop:release
```

This builds the standalone runtime sidecar (PyInstaller) and then the Tauri release bundle.
Artifacts:

```txt
apps/desktop/src-tauri/target/release/bundle/macos/Yanshi.app
apps/desktop/src-tauri/target/release/bundle/dmg/Yanshi_0.1.0_aarch64.dmg
```

The bundle is functionally self-contained for local use (the runtime is embedded), but it is
**unsigned and un-notarized** — Gatekeeper will warn on another Mac. Right-click → **Open**, or
`xattr -dr com.apple.quarantine Yanshi.app`. Public distribution requires a Developer ID
certificate, codesigning, notarization + stapling, and a second-machine Gatekeeper check — see
[docs/BUILD_AND_RELEASE.md](docs/BUILD_AND_RELEASE.md).

## Architecture

| Path | Purpose |
| --- | --- |
| `apps/desktop` | Tauri + React + Vite desktop shell — chats, Settings, Library, Workshop, the Atelier host, tray, notifications, shortcuts, and the permission bridge. |
| `apps/docs` | VitePress documentation site for GitHub Pages (base-path-safe build). |
| `runtime/python` | FastAPI / LangGraph / SQLite **Yanshi Runtime** — runs, projects, events, approvals, tools, provider settings, ACP foundation, Workshop packs, persistence. |
| `packages/shared` | Shared TypeScript types (events, settings, runtime, projects, providers, integrations, Workshop). |
| `packages/live-office` | **Yanshi Atelier** worker visualization — React Three Fiber scene, worker art, station rules, and worker-state mapping. |

The Tauri shell launches and supervises the bundled Python sidecar, which serves the runtime API
and a WebSocket event stream. The frontend hydrates over REST and streams events that drive chats,
the Progress panel, and the Atelier. SQLite holds durable state, and provider keys are stored as
an off-database reference — never returned by the API.

## Core features

### Chats and Projects
Standalone or project-scoped chats. A project owns its own files, agent team, and atelier office
state; standalone chats use the global office. Recent chats reopen as real conversation history.

### Yanshi Atelier · 偃师工坊
A visual worker world where each worker maps to a real agent. Workers stay at fixed home stations
and only move for real behaviors (an occupancy guard prevents overlap). Poses reflect live runtime
state — working, waiting for approval, blocked, completed — never fabricated progress.

### Library and Files
Files and generated outputs across every chat, grouped by project and chat, with real file names
and paths, sorting, web-source links, and reveal/open actions.

### Tools
File, Browser (Playwright), Computer Use (via a token-authenticated localhost bridge), and
Terminal/Docker — each with an honest availability or permission-required state.

### AI Integrations
OpenAI-compatible providers with a real save/test flow; an **ACP** external-agent foundation
(stdio launch + `initialize` handshake); **MCP** server configuration with an honest
runtime-client-pending status; and **Skills** as real agent instructions and Workshop packs —
not executable plugins. See [docs/AI_INTEGRATIONS.md](docs/AI_INTEGRATIONS.md).

### Error toasts
Every user-facing failure becomes a red toast with a stable code and a short, localized reason;
diagnostics stay in Developer Mode. See [docs/ERROR_CATALOG.md](docs/ERROR_CATALOG.md).

### Customization
The **Workshop** imports/exports packs; the **Agent Editor** tunes each agent; the **Office
Editor** lays out the atelier. Worker visuals follow
[docs/YANSHI_ATELIER_WORKER_DESIGN.md](docs/YANSHI_ATELIER_WORKER_DESIGN.md).

## Providers and secrets

Yanshi supports a real OpenAI-compatible provider path: set base URL, model, and API key in
**Settings → AI Integrations → LLM Providers**, then use the real **Test** action.

- The raw key is written to an off-database secret store; SQLite stores only an opaque `apiKeyRef`.
- Settings responses expose `apiKeyConfigured`, **never** the raw key, and it is never logged or
  emitted in events. Optional macOS Keychain via `YANSHI_SECRET_BACKEND=keychain`.
- A provider must be configured before real model chats. If a test key was used during
  validation, enter your own key first.

Native Anthropic / Gemini adapters are planned; the OpenAI-compatible path works today.

## Documentation site

The public docs live in `apps/docs` (VitePress) and deploy to GitHub Pages.

```bash
pnpm docs:dev                              # local dev server
pnpm docs:build                            # static build → apps/docs/.vitepress/dist
pnpm docs:preview                          # preview the built site (port 4400)
DOCS_BASE_PATH=/new-repo-name/ pnpm docs:build  # build for a different repo/base path
```

The default base path is `/yanshi/`. GitHub Pages deploys via
`.github/workflows/deploy-docs.yml` — one-time repo setup: **Settings → Pages → Source → GitHub
Actions**. Use `DOCS_BASE_PATH=/` only for a user/org Pages site or a root-mounted custom domain.

## Verification

Not every change needs all of these, but the full suite is:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
uv run --project runtime/python pytest
cargo check --manifest-path apps/desktop/src-tauri/Cargo.toml
cargo test  --manifest-path apps/desktop/src-tauri/Cargo.toml
pnpm docs:build
pnpm desktop:release   # packaged app, when build behavior changes
```

Requirements: Node.js + `pnpm` (TypeScript workspace), Rust + Cargo (Tauri), Python `>=3.12,<3.13`
with `uv` (runtime), macOS for the packaged app. Docker is optional (Docker-backed terminal
sandbox); Apple Developer ID is needed only for public signing/notarization.

## Known limitations

| Area | Honest state |
| --- | --- |
| Public macOS release | Pending Developer ID signing, notarization, stapling, and Gatekeeper second-machine verification. |
| ACP External Agents | A whole run can be routed to a connected stdio agent (`session/new` + `session/prompt`), and connected ACP agents can be called as ReAct-loop sub-steps with their replies fed back as observations. Tool/permission call-back, multi-turn sessions, and custom protocol are planned. |
| MCP Servers | Stdio MCP servers connect, discover tools live (`initialize` + `tools/list`), and callable discovered tools can run inside the ReAct loop via `tools/call`. HTTP/SSE transport is planned. |
| Browser tool | Requires Playwright Chromium provisioning when missing. |
| Computer Use | Requires macOS Accessibility / Screen Recording for full control and screenshots. |
| Native providers | OpenAI-compatible and native Anthropic (Messages API) both work, selectable by provider type; native Gemini is planned. |
| Atelier workers | 2D generated SVG standees + fallback are real; richer sprite/Lottie/3D animation and pathfinding are future work. |
| Chat continuation | Real: finished runs reopen as history and follow-up turns thread onto the same run, carrying prior conversation forward. |

## Links

- [Documentation site](https://xiaotwu.github.io/yanshi/) · [docs source](apps/docs)
- [Build and Release](docs/BUILD_AND_RELEASE.md)
- [AI Integrations](docs/AI_INTEGRATIONS.md)
- [Error Catalog](docs/ERROR_CATALOG.md)
- [UI Interaction Model](docs/UI_INTERACTION_MODEL.md)
- [Keyboard Shortcuts](docs/KEYBOARD_SHORTCUTS.md)
- [Yanshi Atelier Worker Design](docs/YANSHI_ATELIER_WORKER_DESIGN.md)
- [Final Product Gaps](docs/FINAL_PRODUCT_GAPS.md)

---

<div align="center">

**Yanshi · 偃师** — a craftsman of animated mechanisms.
Built with Tauri, React, and a bundled Python runtime. Honest about what is real and what is next.

</div>
