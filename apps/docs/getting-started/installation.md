# Installation

Yanshi targets **macOS (Apple Silicon)**. You can build the packaged app from source today;
a signed public download is [pending notarization](/release/codesign).

## Prerequisites

- **macOS** on Apple Silicon (aarch64).
- **Node.js** 20+ and **pnpm** (`corepack enable` or install pnpm directly).
- **Rust** toolchain (for the Tauri shell) — install via [rustup](https://rustup.rs).
- **uv** (for the Python runtime) — see [astral.sh/uv](https://docs.astral.sh/uv/).

## Clone and install

```bash
git clone https://github.com/xiaotwu/yanshi.git
cd yanshi
pnpm install
```

## Build the packaged app

```bash
pnpm desktop:release
```

This builds the standalone runtime sidecar (PyInstaller) and then runs the Tauri release build.
The output lands at:

- `apps/desktop/src-tauri/target/release/bundle/macos/Yanshi.app`
- `apps/desktop/src-tauri/target/release/bundle/dmg/Yanshi_0.1.0_aarch64.dmg`

The bundled `.app` launches the runtime in `mode=bundled-sidecar` — no `uv` or repo checkout
needed at runtime.

## First launch (unsigned build)

Because the build is not yet notarized, Gatekeeper will warn on first open. Either:

- Right-click `Yanshi.app` → **Open**, then confirm; or
- Clear the quarantine attribute:

```bash
xattr -dr com.apple.quarantine Yanshi.app
```

::: tip Status
The unsigned build is fully functional locally. A second machine will show a Gatekeeper warning
until [codesign + notarization](/release/codesign) are completed.
<Badge type="danger" text="Blocked by Apple Developer ID" />
:::

## Develop without packaging

For UI iteration you can run the dev shell and runtime directly:

```bash
# Terminal 1 — runtime
pnpm runtime:dev

# Terminal 2 — desktop app (Tauri dev)
pnpm desktop:dev
```

Continue to the [Quickstart](/getting-started/quickstart).
