# Build and Release

## Local verification

From the repository root:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
uv run --project runtime/python pytest
cargo check --manifest-path apps/desktop/src-tauri/Cargo.toml
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml
```

All suites are green on the v0.1 candidate.

## Distributable build

```bash
pnpm desktop:release
```

Builds the runtime sidecar (PyInstaller) then runs `tauri build` with the sidecar overlay config,
producing `Yanshi.app` and `Yanshi_0.1.0_aarch64.dmg` with the embedded sidecar. Details in
[DMG Packaging](/desktop/packaging).

## Plain build

```bash
pnpm --filter @yanshi/desktop tauri build
```

Produces a setup-required bundle (no sidecar) used for CI/verification.

## Docs site

This documentation site lives in `apps/docs` (VitePress):

```bash
pnpm docs:dev      # local dev server
pnpm docs:build    # static build → apps/docs/.vitepress/dist
pnpm docs:preview  # preview the built site
```

It deploys to GitHub Pages via `.github/workflows/deploy-docs.yml`.

### GitHub Pages base path

VitePress uses `base` for repository-subpath deploys such as
`https://<user>.github.io/<repo>/`. The docs config reads `DOCS_BASE_PATH` and defaults to
`/yanshi/`.

```bash
DOCS_BASE_PATH=/yanshi/ pnpm docs:build
DOCS_BASE_PATH=/new-repo-name/ pnpm docs:build
DOCS_BASE_PATH=/ pnpm docs:build   # only for a root Pages site or custom root domain
```

The GitHub Actions workflow sets `DOCS_BASE_PATH` from the repository name. If the repo name
changes, the Pages base changes with it; for a custom domain mounted at the root, change that
workflow value to `/`.

## Status

The current build is the **v0.1 Local Final Candidate** — fully functional locally. Public
distribution beyond the build machine requires [codesign + notarization](/release/codesign).
