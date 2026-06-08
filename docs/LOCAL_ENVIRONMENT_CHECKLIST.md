# Local Environment Checklist

Yanshi is macOS-first.

Install or verify:

## macOS

- Latest supported macOS version for your Tauri toolchain
- Xcode Command Line Tools
- Homebrew

## JavaScript / frontend

- Node.js current LTS
- pnpm
- Vite
- React
- TypeScript

## Rust / Tauri

- Rust toolchain
- Cargo
- Tauri CLI
- Tauri macOS prerequisites

## Python runtime

- Python 3.11 or 3.12
- uv or equivalent Python package manager
- LangGraph
- FastAPI or selected API server
- pytest

## 3D / UI testing

- Playwright
- Playwright browser binaries

## Sandbox / Computer Use

- Docker Desktop for Docker sandbox
- macOS Screen Recording permission
- macOS Accessibility permission
- Files / Folders permission
- Microphone permission if using voice input
- Notifications permission

## Verification commands

Expected commands may include:

```bash
pnpm install
pnpm lint
pnpm typecheck
pnpm test
pnpm build

cargo check
cargo test

uv sync
uv run pytest

pnpm tauri dev
pnpm tauri build
```

Use the actual package scripts created by Codex.
