# Yanshi Build and Release Notes

## Local Build

Run from the repository root:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
uv run --project runtime/python pytest
cargo check --manifest-path apps/desktop/src-tauri/Cargo.toml
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml
pnpm --filter @yanshi/desktop tauri build
```

## Runtime Packaging Status

The current `.app` is setup-required for distribution unless a Python runtime sidecar is bundled.

Supported current launch paths:

- Development: Tauri starts `uv run --project runtime/python yanshi-runtime`.
- Override: set `YANSHI_RUNTIME_PROJECT` to a valid `runtime/python` directory with `uv` installed.
- Future bundled sidecar: package an executable named `yanshi-runtime-sidecar` in one of:
  - app resources root
  - `Resources/bin/yanshi-runtime-sidecar`
  - `Resources/runtime/yanshi-runtime-sidecar`

Do not claim the app is fully distributable until the standalone runtime sidecar is included and tested from a clean machine.

## External Requirements

- macOS with Tauri prerequisites and Xcode Command Line Tools.
- `pnpm` and the Node workspace installed for local builds.
- `uv` for the current Python runtime launch path.
- Playwright Chromium for Browser Use:

```bash
uv sync --project runtime/python --extra browser
uv run --project runtime/python playwright install chromium
```

- Docker Desktop running and the configured sandbox image available for Docker-backed terminal actions.
- macOS Accessibility permission for click/type/shortcut Computer Use.
- macOS Screen Recording permission for screenshot Computer Use.

## Release Checklist

- [ ] Run the full verification command set above.
- [ ] Manually launch `apps/desktop/src-tauri/target/release/bundle/macos/Yanshi.app`.
- [ ] Confirm runtime launch mode is either `bundled-sidecar` or explicitly setup-required.
- [ ] If distributing, bundle and verify `yanshi-runtime-sidecar`.
- [ ] Verify Browser Use with installed Chromium and screenshot artifact output.
- [ ] Verify Docker sandbox with the configured image pre-pulled or pullable.
- [ ] Verify macOS Accessibility and Screen Recording permission flows.
- [ ] Verify tray menu actions: Open Yanshi, Current Tasks, Open Live Office, Pause All, Quit.
- [ ] Verify notifications for approval requested, run completed, run failed, and runtime error.
- [ ] Verify no API keys or provider secrets appear in logs, events, or public settings responses.
