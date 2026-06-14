# Codex Docs Site Review (2026-06-13)

## 1. PASS / FAIL

**PASS.** The documentation site is ready for GitHub Pages deployment under the repository
subpath.

## 2. Docs site readiness

Ready. `apps/docs` is a VitePress documentation site with a premium public-docs feel: left
sidebar, top search, right page outline, dark/light theme, polished homepage, cards, status
badges, and readable code blocks.

## 3. GitHub Pages readiness

Ready after the repository setting is enabled: **Settings -> Pages -> Source: GitHub Actions**.

The workflow uses the Pages artifact/deploy pattern and builds with:

```bash
DOCS_BASE_PATH=/${{ github.event.repository.name }}/ pnpm docs:build
```

The default local/repo base path is `/yanshi/`. If the repository name changes, build with
`DOCS_BASE_PATH=/<new-repo-name>/` or rely on the workflow-derived repository name.

## 4. Commands run

| Command | Result | Notes |
|---|---:|---|
| `pnpm docs:build` | PASS | Built 35 HTML pages with default `/yanshi/` base. |
| `DOCS_BASE_PATH=/new-repo-name/ pnpm docs:build` | PASS | Built successfully with simulated renamed-repo base. |
| Generated link/path audit for `/yanshi/` | PASS | 0 unprefixed local `href`/`src`; 0 broken clean-URL local targets. |
| Generated link/path audit for `/new-repo-name/` | PASS | 0 `/yanshi/` leftovers; 0 unprefixed local `href`/`src`; 0 broken local targets. |
| `pnpm docs:dev --host 127.0.0.1 --port 5173` | PASS | Served `http://127.0.0.1:5173/yanshi/` with HTTP 200; stopped manually. |
| `pnpm docs:preview --host 127.0.0.1` | PASS | First attempt found an existing VitePress preview on port 4400; stopped that repo-local process, reran, and served `http://localhost:4400/yanshi/`. |
| `pnpm lint` | PASS | Includes docs no-op lint plus app/package TypeScript checks. |
| `pnpm typecheck` | PASS | Includes docs no-op typecheck plus app/package TypeScript checks. |
| `pnpm test` | PASS | Docs no-op tests; live-office 10 tests passed; desktop 41 tests passed. |
| `pnpm build` | PASS | Full workspace build passed. Vite emitted the existing large-chunk warning for desktop assets. |
| Workflow YAML parse | PASS | Ruby YAML parse succeeded. `actionlint` is not installed locally. |

## 5. Broken links/base-path result

PASS. The built output correctly prefixes assets and internal links with the active VitePress
`base`. The default build uses `/yanshi/`; the simulated renamed-repo build uses
`/new-repo-name/` with no stale `/yanshi/` paths.

## 6. Visual review

PASS. Browser smoke review covered desktop `1280x720` and mobile `390x844`.

- Homepage presents as product landing plus docs entry.
- Hero includes the Yanshi desktop shell mock, Atelier preview, worker visuals, green glow accent,
  and the required CTAs: Get Started, Install on macOS, Read the Architecture.
- Sidebar, top search, right page outline, cards, status badges, and code blocks render cleanly.
- Dark mode is near-black (`--vp-c-bg: #0c0e10`); light mode tokens are white/neutral.
- No beige/cream visual theme was found.
- No horizontal overflow was detected on desktop or mobile.
- Mobile nav hamburger opens and exposes top-level navigation.
- Local search works: query `provider` returns provider-related docs results.

## 7. Content honesty review

PASS. Public docs clearly distinguish Available now / Foundation implemented / Setup required /
Planned / Blocked by external requirement.

Checked focus areas:

- Public notarized release is **not** claimed complete; signing/notarization is blocked by Apple
  Developer ID.
- ACP is described as launch/stdio/initialize foundation; prompt routing and sessions are planned.
- MCP is described as configuration persistence only; runtime MCP client/tool discovery is planned.
- OpenAI-compatible provider path is available; native Anthropic/Gemini adapters are planned.
- Browser Chromium is setup-required.
- Computer Use click/type/shortcut/screenshot is blocked until macOS permissions are granted.
- Yanshi Atelier worker visuals are honest about current 2D/fallback scope and planned animation/3D.

## 8. Accessibility review

PASS for this smoke scope.

- Tested homepage and ACP page each have one `h1`.
- VitePress skip link is present.
- Focus-visible styling is defined for links, buttons, inputs, and feature cards.
- Reduced-motion media query disables transitions and worker animation.
- Desktop and mobile smoke checks showed no overflow.
- Mobile navigation is keyboard/ARIA-backed through VitePress controls and opened successfully.
- Contrast appears acceptable against the near-black/white-neutral palettes; no low-contrast beige
  palette was introduced.

## 9. Changes made

No docs-site source fixes were required.

Added this review report only:

- `qa/codex-docs-site-review/DOCS_SITE_REVIEW.md`

## 10. Remaining issues

- `actionlint` is not installed locally, so workflow validation was structural/manual plus YAML
  parsing rather than actionlint-backed.
- The docs package intentionally keeps lint/typecheck/test/build scripts as no-op placeholders so
  root recursive workspace commands stay fast and do not replace `pnpm docs:build`.
- The desktop build still emits a Vite chunk-size warning. This is not a docs-site readiness issue.
- GitHub Pages still needs the one-time repository setting: **Pages -> Source: GitHub Actions**.

## 11. Ready to enable GitHub Pages

**Yes.** The docs site and workflow are ready to enable GitHub Pages with GitHub Actions.

Desktop app source and runtime/backend source were not edited during this review pass.
