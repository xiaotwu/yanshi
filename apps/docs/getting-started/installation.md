# Installation

Yanshi targets macOS on Apple Silicon.

## Requirements

- Node.js 20+.
- pnpm 10+.
- Rust toolchain.
- Python 3.12 with `uv`.
- macOS permissions for Computer Use, when needed.

## Install From Source

```bash
git clone git@github.com:xiaotwu/yanshi.git
cd yanshi
pnpm install
```

## Run In Development

Start the runtime and desktop app:

```bash
pnpm runtime:dev
pnpm desktop:dev
```

## Build A Local App

```bash
pnpm desktop:release
```

The local bundle is created under:

```txt
apps/desktop/src-tauri/target/release/bundle/
```

Unsigned local builds may require a manual first-open approval in macOS.
