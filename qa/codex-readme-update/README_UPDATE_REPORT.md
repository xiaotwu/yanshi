# README Update Report (2026-06-13)

## 1. PASS / FAIL

**PASS.** `README.md` now reflects the current repository state as a polished public-facing
project overview.

## 2. README sections updated

- Replaced the old "Codex Start Kit" framing with the actual Yanshi project identity.
- Added current status: v0.1 Local Final Candidate, Codex global review passed, docs site ready,
  GitHub Pages workflow ready, and public signing/notarization still pending.
- Added feature overview for desktop app, Yanshi Runtime, chats/projects, Yanshi Atelier,
  Library/Files, Workshop, AI integrations, error toasts, i18n, themes, shortcuts, context menus,
  and no-mock states.
- Added repository architecture table for `apps/desktop`, `apps/docs`, `runtime/python`,
  `packages/shared`, and `packages/live-office`.
- Added requirements section covering Node/pnpm, Rust/Cargo, Python/uv, macOS, Docker,
  Chromium, macOS permissions, and Apple Developer ID.
- Added accurate development command table from `package.json`.
- Added docs-site section with `pnpm docs:*` commands, GitHub Pages setup, workflow behavior,
  and `DOCS_BASE_PATH` guidance.
- Added build/release section with `.app`/`.dmg` artifact paths and unsigned/notarized status.
- Added provider/secrets section describing OpenAI-compatible support, `apiKeyRef`, off-database
  secret storage, and planned native providers.
- Added known limitations table with ACP/MCP/Chromium/Computer Use/provider/Atelier/chat-continuation
  scope.
- Added useful internal links to release, AI integration, error, UI, worker-design, shortcut,
  final-gaps, docs-site, and review docs.

## 3. Commands verified

| Command | Result |
| --- | --- |
| `pnpm lint` | PASS |
| `pnpm typecheck` | PASS |
| `pnpm test` | PASS |
| `pnpm docs:build` | PASS |

`pnpm desktop:release` was not run because this pass changed only README/report documentation and
did not affect app packaging behavior.

## 4. Links checked

Checked all local Markdown links in `README.md` with a Node script. Result: **12 local links
checked, 0 missing targets**.

Key linked targets checked:

- `docs/BUILD_AND_RELEASE.md`
- `docs/AI_INTEGRATIONS.md`
- `docs/ERROR_CATALOG.md`
- `docs/UI_INTERACTION_MODEL.md`
- `docs/YANSHI_ATELIER_WORKER_DESIGN.md`
- `docs/KEYBOARD_SHORTCUTS.md`
- `docs/FINAL_PRODUCT_GAPS.md`
- `apps/docs`
- `qa/codex-docs-site-review/DOCS_SITE_REVIEW.md`
- `qa/codex-global-review/GLOBAL_REVIEW_REPORT.md`

## 5. Assumptions

- Public README can mention "Codex global review passed" because the update request required that
  status, but it should avoid dumping QA history or raw implementation logs.
- The README should keep the public release status conservative: local final candidate is ready,
  public notarized distribution remains blocked by external signing/notarization requirements.
- Existing workspace/package changes from prior phases are treated as current repository state;
  this pass did not attempt to review or modify product behavior.

## 6. Remaining README gaps

No blocking README gaps remain.

Future refreshes should update the README when:

- Developer ID signing/notarization completes.
- ACP prompt/session routing ships.
- MCP runtime client/tool discovery ships.
- Native Anthropic/Gemini adapters or multi-provider routing ship.
- Richer Atelier animation/3D assets replace the current SVG standees.
