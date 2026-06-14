# Documentation Site Pass Report (2026-06-13)

## 1. Verdict

**PASS.** A polished, honest GitHub Pages documentation site is built, themed, base-path safe,
and verified.

## 2. Framework chosen

**VitePress 1.6** in `apps/docs/` (covered by the existing `apps/*` workspace glob). Chosen
because it is Vite-based (no new toolchain), ships the Augment-style chrome out of the box (left
sidebar, right "On this page" outline, real local ⌘K search, dark/light toggle, responsive
mobile), and themes cleanly via CSS variables to the Yanshi black/white + mint-glow identity.

## 3. Pages created (34 markdown files)

- **Home** (`index.md` + `.vitepress/theme/HomeLanding.vue`) — custom product/docs landing page
  with a Yanshi desktop-shell mock, Yanshi Atelier mini preview, mint glow, three CTAs
  (Get Started / Install on macOS / Read the Architecture), docs cards, quickstart, and an
  honest-status table.
- **Getting Started** — Introduction, Installation, Quickstart, First Chat.
- **Core Concepts** — Yanshi Runtime, Chats and Projects, Yanshi Atelier, Library and Files,
  Tools and Permissions.
- **AI Integrations** — Overview, LLM Providers, ACP External Agents, MCP Servers, Skills,
  Provider Secrets.
- **Desktop App** — macOS App, DMG Packaging, Keyboard Shortcuts, Notifications, macOS
  Permissions, Troubleshooting.
- **Customization** — Workshop, Agent Editor, Office Editor, Worker Design.
- **Reference** — Error Catalog, Settings, Runtime Events, Security Model, No-Mock Policy.
- **Release** — Build and Release, Codesign and Notarization, Known Limitations.

All 18 required pages are present, rewritten from internal docs into public-facing language; no
implementation logs or internal QA history are exposed on public pages. Honest status language is
standardized as Available now / Foundation implemented / Setup required / Planned / Blocked by
external requirement.

## 4. GitHub Pages workflow

`.github/workflows/deploy-docs.yml` — official Pages pattern: checkout → pnpm setup → Node 20 +
pnpm cache → `pnpm install --frozen-lockfile` → `DOCS_BASE_PATH=/${{ github.event.repository.name }}/ pnpm docs:build`
→ `upload-pages-artifact` (`apps/docs/.vitepress/dist`) → `deploy-pages`. Triggers on `main`
pushes touching `apps/docs/**` or the workflow, plus manual dispatch. Permissions scoped to
`pages: write` + `id-token: write`; no untrusted input used in any `run` step.

## 5. Local commands

Root scripts added (desktop build untouched — docs are excluded from the recursive
`pnpm build/lint/typecheck/test`):

```bash
pnpm docs:dev      # dev server
pnpm docs:build    # static build → apps/docs/.vitepress/dist
pnpm docs:preview  # preview the built site (port 4400)
```

## 6. Build result

`pnpm docs:build` PASS (built `index.html` + all sections + local-search index). Root
`pnpm typecheck` PASS, `pnpm test` PASS (7 suites), `pnpm build` PASS — desktop app unaffected.
Build output gitignored.

Additional 2026-06-13 verification:

- `pnpm docs:build` PASS after the homepage/base-path refinement.
- `DOCS_BASE_PATH=/new-repo-name/ pnpm docs:build` PASS.
- Generated HTML path audit found no unprefixed local `href`/`src` paths; assets, app JS, favicon,
  screenshots, and internal links were correctly prefixed under both `/yanshi/` and
  `/new-repo-name/`.

## 7. How to preview

```bash
pnpm docs:dev      # → http://localhost:5173/yanshi/
# or, after a build:
pnpm docs:preview  # → http://localhost:4400/yanshi/
```

## 8. How to deploy

1. Push to `main` (or run the workflow manually). The workflow builds and deploys.
2. One-time repo setting: **Settings → Pages → Source: GitHub Actions** (cannot be set from code).
3. Published at `https://xiaotwu.github.io/yanshi/` (base path `/yanshi/`).
4. If the repository name changes, build with `DOCS_BASE_PATH=/<new-repo-name>/` or rely on the
   workflow's repository-name-derived default. Use `DOCS_BASE_PATH=/` only for a root Pages site
   or root-mounted custom domain.

## 9. Manual smoke results

| Check | Result |
|---|---|
| Home opens, custom hero + docs cards render | PASS (SCREENSHOTS/docs-home-final-desktop.png) |
| Hero visual renders as HTML, not escaped code | PASS |
| CTA labels and links | PASS: Get Started, Install on macOS, Read the Architecture |
| Sidebar navigation | PASS |
| Right "On this page" TOC | PASS (ACP page checked) |
| Local search (⌘K) | PASS (23 real results for "provider") |
| Dark / light toggle | PASS (SCREENSHOTS/docs-home-light.png) |
| Hero images render (mark + worker SVGs) | PASS |
| Mobile 390px — no horizontal overflow, hamburger | PASS (SCREENSHOTS/docs-home-final-mobile.png) |
| Public status language on ACP/MCP/providers/permissions/release | PASS |
| GitHub Pages base path `/yanshi/` + simulated `/new-repo-name/` | PASS |
| Status badges present | PASS |
| Favicon (Yanshi mark) | PASS (in build output) |

## 10. Remaining docs gaps

- Screenshots are real app captures from prior QA passes; a couple of surfaces (Workshop editors,
  Library list) use prose only — could add captures later.
- Content is honest to the v0.1 candidate; it should be refreshed as ACP/MCP/providers advance.
- The `apps/docs` package has no lint/typecheck/test of its own (echo no-ops) — intentional to
  keep `pnpm -r` fast and the desktop pipeline unchanged.

## Assets

Original/own assets only: `public/yanshi-mark.svg` (original mint mechanism glyph), puppet SVGs
exported from the app's own `worker-art.ts`, and real app screenshots reused from
`qa/*/SCREENSHOTS`. No third-party or Arknights/Endfield imagery.
