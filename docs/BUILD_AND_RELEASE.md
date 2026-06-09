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

## Computer Use Bridge

The desktop app starts an in-process localhost HTTP bridge server before it spawns
the Python runtime:

- Binds `127.0.0.1:0` (OS-assigned random port); never listens on a public interface.
- Generates a per-launch random bearer token (32 bytes from `/dev/urandom`, hex-encoded).
- Injects `YANSHI_COMPUTER_BRIDGE_URL` and `YANSHI_COMPUTER_BRIDGE_TOKEN` into the
  runtime process environment for both the `uv` and bundled-sidecar launch paths.
- Authenticates every request with a constant-time bearer-token check. Missing or
  invalid tokens return HTTP 401; unknown operations return 404; non-POST returns 405.
- Exposes `POST /computer/{click,type,shortcut,open-app}`, dispatching to the native
  macOS CoreGraphics action functions (which still enforce Accessibility permission).

The token is never logged, persisted, or returned in any API response. The runtime
log only records the bridge URL (host/port), not the token.

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
