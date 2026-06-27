<div align="center">

# Yanshi · 偃师

**A macOS-first AI agent workspace with chats, real tools, projects, and animated workers.**

![macOS](https://img.shields.io/badge/macOS-Apple%20Silicon-111?logo=apple&logoColor=white)
![Tauri](https://img.shields.io/badge/Tauri-2-24C8DB?logo=tauri&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)
![Python](https://img.shields.io/badge/Python-3.12-3776AB?logo=python&logoColor=white)

[Documentation](https://xiaotwu.github.io/yanshi/) ·
[Usage](docs/USAGE.md) ·
[Important Notes](docs/IMPORTANT_NOTES.md) ·
[Build & Release](docs/BUILD_AND_RELEASE.md) ·
[Error Catalog](docs/ERROR_CATALOG.md)

</div>

## What Is Yanshi?

Yanshi is a local-first desktop app for running AI agent work on macOS. You start with a chat,
optionally attach it to a project, and Yanshi routes the work through its local runtime, tools,
approvals, files, and visual workspace.

The name 偃师 refers to a craftsman of animated mechanisms. In the app, that idea appears as the
Yanshi Atelier: animated workers reflect real runtime state while the chat remains the main
surface.

## Core Features

- **Chat-first workspace**: create standalone chats or project-scoped chats with persistent
  history and outputs.
- **Yanshi Runtime**: a Python sidecar with orchestration, tools, approvals, event streaming, and
  SQLite persistence.
- **Real tools**: file operations, browser automation, macOS Computer Use, and terminal/Docker
  tools report real availability and errors.
- **Projects and Library**: organize chats, files, and outputs by project.
- **Yanshi Atelier**: visual workers mirror live states such as working, waiting for approval,
  blocked, or complete.
- **Settings**: configure providers, permissions, appearance, shortcuts, and developer detail.

## Quick Start

Requirements:

- macOS on Apple Silicon
- Node.js 20+
- pnpm 10+
- Rust toolchain
- Python 3.12 with `uv`

```bash
git clone git@github.com:xiaotwu/yanshi.git
cd yanshi
pnpm install
```

Run the desktop app in development:

```bash
pnpm runtime:dev
pnpm desktop:dev
```

Build the local macOS app:

```bash
pnpm desktop:release
```

Expected local artifacts:

```txt
apps/desktop/src-tauri/target/release/bundle/macos/Yanshi.app
apps/desktop/src-tauri/target/release/bundle/dmg/Yanshi_0.1.0_aarch64.dmg
```

## Basic Use

1. Open Yanshi and create a new chat.
2. Configure an OpenAI-compatible provider in Settings if you want model-backed runs.
3. Grant macOS permissions when using Computer Use.
4. Approve risky actions when Yanshi asks before running them.
5. Review generated files and outputs in the chat or Library.

See [docs/USAGE.md](docs/USAGE.md) for the short usage guide.

## Important Notes

- Yanshi does not fake successful tool execution. Missing provider keys, browser binaries,
  Docker, runtime startup, or macOS permissions appear as explicit setup-required or blocked
  states.
- Provider API keys are stored outside the main SQLite database and are not returned by settings
  APIs.
- The local build is useful for development and local testing. Public macOS distribution requires
  Developer ID signing, notarization, stapling, and Gatekeeper verification.
- Browser automation may need Playwright Chromium provisioning.
- Computer Use requires macOS Accessibility and Screen Recording permission.

See [docs/IMPORTANT_NOTES.md](docs/IMPORTANT_NOTES.md) for the concise checklist.

## Repository Layout

| Path | Purpose |
| --- | --- |
| `apps/desktop` | Tauri, React, Vite, TypeScript desktop app. |
| `apps/docs` | VitePress documentation site. |
| `runtime/python` | Python Yanshi Runtime sidecar. |
| `packages/shared` | Shared TypeScript types. |
| `packages/live-office` | Yanshi Atelier visual worker package. |
| `scripts` | Build and release helper scripts. |

## Verification

Use the checks that match your change:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
uv run --project runtime/python pytest
cargo check --manifest-path apps/desktop/src-tauri/Cargo.toml
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml
pnpm docs:build
```

For release packaging:

```bash
pnpm desktop:release
```

## Documentation Site

```bash
pnpm docs:dev
pnpm docs:build
pnpm docs:preview
DOCS_BASE_PATH=/yanshi/ pnpm docs:build
```

The default GitHub Pages base path is `/yanshi/`.
