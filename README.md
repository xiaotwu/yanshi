# Yanshi

**Yanshi** (偃师, "puppet-maker") is a macOS-first desktop AI agent workspace with real tools,
project-scoped chats, an animated **Yanshi Atelier** (偃师工坊), a local Python runtime sidecar,
AI integrations, and a GitHub Pages documentation site.

Yanshi is built to feel simple on the surface and powerful underneath: chats are the main
workflow, while the runtime handles agents, tools, approvals, persistence, and event streaming.

## Current Status

| Area | Status |
| --- | --- |
| Product candidate | **v0.1 Local Final Candidate** |
| Codex global review | **Passed** for the v0.1 local final-candidate review |
| Docs site | **Ready** (`apps/docs`, VitePress) |
| GitHub Pages workflow | **Ready** (`.github/workflows/deploy-docs.yml`) |
| Public release | **Pending** Developer ID signing, notarization, stapling, and Gatekeeper verification |

Yanshi is ready for local final-candidate use on the build machine. It is **not yet a public
stable or notarized macOS release**.

## Features

- macOS desktop shell built with Tauri, React, Vite, and TypeScript.
- Bundled Python **Yanshi Runtime** sidecar for local app releases.
- Real project-scoped chats, recent chats, projects, approvals, files, and persisted runtime events.
- **Yanshi Atelier / 偃师工坊** worker visualization with real-state worker poses and 2D fallback.
- Library / Files surfaces for outputs and workspace files.
- Workshop pack import/export, agent editor, office editor, and local customization.
- AI Integrations:
  - OpenAI-compatible LLM provider path with real save/test.
  - ACP External Agents foundation: stdio launch + `initialize` handshake.
  - MCP Servers configuration persistence with honest "runtime client not implemented" status.
  - Skills as real agent instructions and Workshop pack configuration, not executable plugins.
- Error toast system with stable `YANSHI_<AREA>_<NNN>` codes.
- en-US / zh-CN interface, including 偃师 and 偃师工坊 naming in Chinese UI.
- Light, dark, and system theme modes.
- Editable keyboard shortcuts and macOS global show/hide shortcut.
- Viewport-safe menus, right-click context menus, modal stack handling, and reduced-motion support.
- No-mock policy: missing credentials, permissions, Chromium, Docker, or signing are shown as
  honest setup-required or blocked states.

## Architecture

| Path | Purpose |
| --- | --- |
| `apps/desktop` | Tauri + React + Vite desktop app. Includes the macOS shell, settings, chats, Library, Workshop, Yanshi Atelier host, notifications, shortcuts, tray, and permission bridge. |
| `apps/docs` | VitePress documentation site for GitHub Pages. Includes product/docs homepage, sidebar, search, right page outline, and base-path-safe build config. |
| `runtime/python` | FastAPI / LangGraph / SQLite **Yanshi Runtime**. Owns runs, projects, events, approvals, tools, provider settings, ACP foundation, Workshop packs, and persistence. |
| `packages/shared` | Shared TypeScript event, settings, runtime, project, provider, AI integration, and Workshop types. |
| `packages/live-office` | Yanshi Atelier worker visualization package, including React Three Fiber scene logic, worker art, station rules, and worker-state mapping. |

## Requirements

- Node.js and `pnpm` for the TypeScript workspace.
- Rust and Cargo for Tauri.
- Python with `uv` for the runtime.
- macOS for the packaged desktop app.
- Docker Desktop is optional and only needed for Docker-backed terminal sandbox actions.
- Playwright Chromium may be required for Browser tool usage.
- macOS Accessibility and Screen Recording permissions are required for Computer Use click/type/
  shortcut/screenshot flows.
- Apple Developer ID is required only for public signing and notarization.

The runtime package currently requires Python `>=3.12,<3.13`. The GitHub Pages workflow uses
Node 20.

## Development

Install dependencies from the repository root:

```bash
pnpm install
```

Common commands:

| Command | What it does |
| --- | --- |
| `pnpm desktop:dev` | Runs the Tauri desktop app in development mode. |
| `pnpm desktop:web` | Runs only the desktop web UI through Vite. |
| `pnpm runtime:dev` | Starts the Python Yanshi Runtime with `uv`. |
| `pnpm lint` | Runs workspace lint/type checks configured as package scripts. |
| `pnpm typecheck` | Runs workspace TypeScript checks. |
| `pnpm test` | Runs workspace Vitest suites. |
| `pnpm build` | Builds workspace packages and the desktop web bundle. |
| `pnpm runtime:test` | Runs the Python runtime test suite. |
| `pnpm sidecar:build` | Builds the standalone runtime sidecar with PyInstaller. |
| `pnpm desktop:release` | Builds the bundled macOS app and DMG using the sidecar overlay config. |

Additional release verification commands are documented in
[docs/BUILD_AND_RELEASE.md](docs/BUILD_AND_RELEASE.md).

## Documentation Site

The public documentation site lives in `apps/docs` and is built with VitePress.

```bash
pnpm docs:dev      # local dev server
pnpm docs:build    # static build -> apps/docs/.vitepress/dist
pnpm docs:preview  # preview the built site on port 4400
```

GitHub Pages deployment uses `.github/workflows/deploy-docs.yml`:

1. Enable **Settings -> Pages -> Source -> GitHub Actions** in the GitHub repository.
2. Push changes to `main` that touch `apps/docs/**` or the workflow, or run the workflow manually.
3. The workflow installs the workspace and builds with `DOCS_BASE_PATH=/${{ github.event.repository.name }}/`.
4. The built artifact is uploaded from `apps/docs/.vitepress/dist` and deployed through GitHub Pages.

The default docs base path is `/yanshi/`. If the repository name changes, build with:

```bash
DOCS_BASE_PATH=/new-repo-name/ pnpm docs:build
```

Use `DOCS_BASE_PATH=/` only for a user/organization Pages site or a custom domain mounted at root.

## Build And Release

The local distributable build is:

```bash
pnpm desktop:release
```

This runs `pnpm sidecar:build`, stages `yanshi-runtime-sidecar`, and then runs Tauri with
`apps/desktop/src-tauri/tauri.sidecar.conf.json`.

Expected artifacts:

- `apps/desktop/src-tauri/target/release/bundle/macos/Yanshi.app`
- `apps/desktop/src-tauri/target/release/bundle/dmg/Yanshi_0.1.0_aarch64.dmg`

The app can be functionally self-contained for local use because the Python runtime is bundled as
a standalone sidecar. It is still **unsigned and un-notarized**, so public distribution requires:

1. Developer ID Application certificate.
2. Codesigning the `.app` and bundled sidecar with hardened runtime.
3. Notarizing the DMG with Apple and stapling the ticket.
4. Gatekeeper verification on a second Mac.

See [docs/BUILD_AND_RELEASE.md](docs/BUILD_AND_RELEASE.md) for the detailed release checklist.

## Providers And Secrets

Yanshi currently supports a real OpenAI-compatible provider path: configure base URL, model, and
API key in Settings -> AI Integrations -> LLM Providers, then use the real Test action.

Secret handling is intentionally conservative:

- The raw provider key is written to an off-database secret store.
- SQLite stores only an opaque `apiKeyRef`.
- Settings responses expose `apiKeyConfigured`, never the raw key.
- The key is not returned by the runtime API, logged, or emitted in events.
- Optional macOS Keychain storage is available with `YANSHI_SECRET_BACKEND=keychain`.

Native Anthropic and Gemini adapters are planned, not implemented. If a local test key was used
during validation, enter your own provider key before running real chats.

## Known Limitations

| Limitation | Current honest state |
| --- | --- |
| Public macOS release | Blocked until Developer ID signing, notarization, stapling, and Gatekeeper verification are complete. |
| ACP External Agents | Foundation implemented: stdio launch + initialize handshake. Prompt/session/tool/permission routing is planned. |
| MCP Servers | Configuration persists. Runtime MCP client and tool discovery are planned. |
| Browser tool | Requires Playwright Chromium provisioning when missing. |
| Computer Use | Requires macOS Accessibility and Screen Recording permissions for full control/screenshot flows. |
| Native providers | OpenAI-compatible path works; native Anthropic/Gemini protocols are planned. |
| Yanshi Atelier workers | Current 2D generated SVG standees and fallback are real; richer sprite/Lottie/3D animation and pathfinding are future work. |
| Chat continuation | Finished runs are reopened as real conversation history; follow-up turns on an existing run are planned. |

## Useful Links

- [Build and release notes](docs/BUILD_AND_RELEASE.md)
- [AI integrations](docs/AI_INTEGRATIONS.md)
- [Error catalog](docs/ERROR_CATALOG.md)
- [UI interaction model](docs/UI_INTERACTION_MODEL.md)
- [Yanshi Atelier worker design](docs/YANSHI_ATELIER_WORKER_DESIGN.md)
- [Keyboard shortcuts](docs/KEYBOARD_SHORTCUTS.md)
- [Final product gaps](docs/FINAL_PRODUCT_GAPS.md)
- [Docs site source](apps/docs)
- [Docs site review](qa/codex-docs-site-review/DOCS_SITE_REVIEW.md)
- [Codex global review](qa/codex-global-review/GLOBAL_REVIEW_REPORT.md)

## Workflow Notes

The active project workflow is:

- Claude Code handles implementation and bug fixes.
- Codex handles independent validation and regression review.
- The user makes final product and release decisions.

Historical Junie reports are archived; they are not part of the active workflow.
