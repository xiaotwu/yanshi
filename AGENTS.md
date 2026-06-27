# AGENTS.md - Yanshi Contributor Notes

This repository contains **Yanshi**, a macOS-first desktop AI agent workspace with chats, tools,
projects, and animated workers.

## Product Principles

- Keep normal mode simple, concise, and non-technical.
- Show technical detail in Developer Mode, logs, or expandable details.
- Prefer short labels, icons with tooltips, hover cards, and clear settings.
- Avoid dense dashboard surfaces, raw logs in normal mode, and long explanatory button text.

## No-Mock Policy

Do not ship fake, placeholder, demo-only, scaffold-only, or "coming soon" behavior in user-facing
flows.

Allowed:

- Test fixtures in tests.
- Deterministic sample data for unit tests.
- Clear not-configured states for missing external dependencies.
- Permission-required states when macOS access is missing.

Not allowed:

- Fake successful tool execution.
- Fake provider health.
- Fake browser, computer, file, terminal, approval, or runtime results.
- Fake Workshop imports or agent runs.

If something cannot run because a credential, daemon, binary, or macOS permission is missing,
implement the real path and show the exact missing requirement.

## Architecture

Yanshi uses:

- Tauri desktop shell.
- React, Vite, TypeScript, Tailwind CSS, and Zustand.
- React Three Fiber / three.js for the Yanshi Atelier.
- Python Yanshi Runtime sidecar.
- LangGraph orchestration.
- Action / Observation execution model.
- REST and WebSocket runtime APIs.
- SQLite persistence.
- macOS permission bridge and desktop integrations.

Tauri handles windows, menus, notifications, shortcuts, permission bridging, and sidecar
supervision.

The Python runtime handles orchestration, agents, tool execution, approvals, artifacts, event
streaming, settings, and persistence.

## Terminology

- Use **Chat** for the user-facing conversation surface.
- Use **Files / Outputs** for generated results.
- Use **Yanshi Runtime** for the sidecar orchestration system.
- Use **Yanshi Atelier** in English and **偃师工坊** in zh-CN normal-mode UI.
- Keep internal terms such as run, task, action, and observation out of normal-mode UI unless a
  technical view needs them.

## Verification

Run the checks relevant to the change:

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

For packaging changes, also run:

```bash
pnpm desktop:release
```

Document any command that cannot run and the exact reason.
