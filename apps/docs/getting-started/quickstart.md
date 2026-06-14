# Quickstart

This walks through a clean build, the automated checks, and the first launch.

## 1. Install dependencies

```bash
pnpm install
```

## 2. Run the checks

The full local verification set:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
uv run --project runtime/python pytest
cargo check --manifest-path apps/desktop/src-tauri/Cargo.toml
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml
```

All suites are green on the v0.1 candidate (frontend tests, runtime pytest, and Rust tests).

## 3. Build the app

```bash
pnpm desktop:release
```

Produces `Yanshi.app` and `Yanshi_0.1.0_aarch64.dmg` with the embedded runtime sidecar. See
[DMG Packaging](/desktop/packaging) for the launch-path resolution details.

## 4. Launch

Open `Yanshi.app`. On first run the bundled runtime starts automatically; the title bar shows the
window controls, and the right-side panel and Atelier are available from the toolbar.

If the runtime cannot start, Yanshi shows an honest error toast (`YANSHI_RUNTIME_001`) rather than
hanging — see the [Error Catalog](/reference/error-catalog).

## 5. Configure a model provider

To run real chats you need an LLM provider. Open **Settings → LLM Providers**, choose the
OpenAI-compatible option, set the base URL + model, and paste your API key. The key is stored in
a secure off-database store and is never shown again — see [Provider Secrets](/integrations/secrets).

## 6. Run your first chat

Head to [First Chat](/getting-started/first-chat).
