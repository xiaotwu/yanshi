# Build and Release

This page covers local development, local packaging, and the requirements for a public macOS
release.

## Prerequisites

- macOS on Apple Silicon.
- Node.js 20+.
- pnpm 10+.
- Rust toolchain.
- Python 3.12 with `uv`.
- Apple Developer ID credentials for public distribution only.

## Install

```bash
git clone git@github.com:xiaotwu/yanshi.git
cd yanshi
pnpm install
```

## Development

Run the runtime and desktop app while developing:

```bash
pnpm runtime:dev
pnpm desktop:dev
```

The desktop app talks to the local runtime over the configured localhost API and WebSocket.

## Local Checks

Run the checks that match the change:

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

## Local Package

```bash
pnpm desktop:release
```

This builds the Python sidecar and the Tauri app bundle.

Expected outputs:

```txt
apps/desktop/src-tauri/target/release/bundle/macos/Yanshi.app
apps/desktop/src-tauri/target/release/bundle/dmg/Yanshi_0.1.0_aarch64.dmg
```

An unsigned local build may need a manual first-open approval in macOS Gatekeeper.

## Public macOS Release

Public distribution requires:

- Developer ID Application certificate.
- Apple notarization credentials.
- Signed and stapled app bundle.
- Gatekeeper verification on a separate Mac.
- Release metadata and updater configuration that match the published artifact.

The release path should fail before publishing if required signing, notarization, updater, or
crash-reporting configuration is missing. Do not silently ship an unsigned artifact as a public
release.

## Documentation Site

```bash
pnpm docs:dev
pnpm docs:build
pnpm docs:preview
DOCS_BASE_PATH=/yanshi/ pnpm docs:build
```

The default GitHub Pages base path is `/yanshi/`.
