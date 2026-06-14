# DMG Packaging

The distributable build bundles the frontend and a standalone runtime sidecar into a macOS
`.app` and `.dmg`.

## Build

```bash
pnpm desktop:release
```

This runs `pnpm sidecar:build` (PyInstaller) and then `tauri build` with the sidecar overlay
config (`apps/desktop/src-tauri/tauri.sidecar.conf.json`). Outputs:

- `…/target/release/bundle/macos/Yanshi.app`
- `…/target/release/bundle/dmg/Yanshi_0.1.0_aarch64.dmg`

The sidecar lands at `Yanshi.app/Contents/Resources/resources/yanshi-runtime-sidecar` (mode 0755).

## Sidecar build

`pnpm sidecar:build` (`scripts/build-sidecar.sh`) uses PyInstaller `--onefile` to build
`yanshi-runtime-sidecar` from `runtime/python/sidecar_main.py` and stages it under
`apps/desktop/src-tauri/resources/` (gitignored, ~63 MB).

## Launch-path resolution (Rust)

The shell resolves the runtime in this order:

1. `YANSHI_RUNTIME_PROJECT` env → `uv run` against that project (dev override).
2. Bundled sidecar binary in `Resources/…` → `mode=bundled-sidecar`.
3. Bundled `Resources/runtime/python` project with `uv` available.
4. (debug builds only) the repo `runtime/python` project.
5. Otherwise → an honest `setup_required` state.

## Plain vs. release build

| Build path | Status |
|---|---|
| `pnpm desktop:release` | <Badge type="tip" text="Available now" /> self-contained local bundle with embedded sidecar |
| `pnpm --filter @yanshi/desktop tauri build` | <Badge type="warning" text="Setup required" /> plain bundle with no sidecar |
| Public distribution | <Badge type="danger" text="Blocked by Apple Developer ID" /> until signing and notarization |

See [Build and Release](/release/build) and [Codesign and Notarization](/release/codesign).
