# Build And Release

## Checks

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

Expected outputs:

```txt
apps/desktop/src-tauri/target/release/bundle/macos/Yanshi.app
apps/desktop/src-tauri/target/release/bundle/dmg/Yanshi_0.1.0_aarch64.dmg
```

## Public Release

Public macOS distribution requires Developer ID signing, notarization, stapling, and Gatekeeper
verification on a separate Mac. A public release should fail before publishing if required signing
or release configuration is missing.
