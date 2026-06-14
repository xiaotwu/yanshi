# README Update Report (2026-06-13 — Hermes-inspired rewrite)

_Latest pass on top. The prior Codex README-update report is preserved below the divider._

## 1. Verdict

**PASS.** `README.md` rewritten into a polished, public-facing product README; all checks green;
no app/runtime/docs-site source changed.

## 2. README rewrite summary

The previous README (preserved below) was accurate but reference-heavy (dense tables, an internal
"Workflow Notes / Junie" section). It was rewritten with more product energy and skimmability
while keeping every claim honest and unchanged in substance:

- A centered **hero** (`# Yanshi · 偃师`, tagline, short story paragraph) with static,
  non-breaking badges and a quick-links row.
- A punchy **"What Yanshi does"** bullet list.
- A visible **Current status** block (✅/⚠️) — validated app/docs/error-toasts, no active
  P0/P1/P2; signing/notarization + setup/permissions pending.
- **Quick start**, **Build the macOS app** (artifact paths + Gatekeeper note), **Architecture**
  (paths table + runtime flow), concise **Core features** subsections, **Providers and secrets**,
  **Documentation site** (`DOCS_BASE_PATH`), **Verification** matrix, **Known limitations**
  table, and a curated **Links** section.
- Removed the internal "Workflow Notes" + Junie reference and the QA-report links from the body
  (kept docs links only).

## 3. Hermes-inspired structure used

Structural/tone reference only (no content copied): strong top hero → short memorable
description → badges/links → quick start → crisp feature bullets → practical command references →
docs links → honest status, told with Yanshi's own product story and facts.

## 4. Commands run

| Command | Result |
|---|---|
| `pnpm lint` | PASS |
| `pnpm typecheck` | PASS |
| `pnpm test` | PASS (41 tests, 7 files) |
| `pnpm docs:build` | PASS |

## 5. Link check result

All 16 local relative links resolve (`docs/*`, `apps/docs`). External links are the GitHub Pages
docs site and `img.shields.io` static badges (no repo-state dependency).

## 6. Honesty checks

- **No License badge** — repo has no `LICENSE` file or `license` field, so none was claimed.
- **Only real scripts** referenced; the non-existent `pnpm dev` was avoided and clarified.
- **No overclaiming**: 0 uses of "complete"; ACP = foundation, MCP = config + planned client,
  native providers = planned, workers = 2D SVG real / 3D future, public release = pending.
- **0 Junie references**; no internal QA-dump tone.

## 7. Files changed

- `README.md` (rewritten).
- `qa/codex-readme-update/README_UPDATE_REPORT.md` (this report; prior report preserved below).

No `apps/desktop`, `apps/docs` source, `runtime/python`, `packages/*`, or config files changed.

## 8. Remaining README gaps

- No CI build-status badge (no public CI status to point at — a static status badge is used).
- No license badge/section until a `LICENSE` is added.
- Screenshots/GIFs could further lift the hero later; the live docs site carries the visual story
  for now.

---

# (Previous) README Update Report (2026-06-13)

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

## 5. Assumptions

- Public README can mention "Codex global review passed" because the update request required that
  status, but it should avoid dumping QA history or raw implementation logs.
- The README should keep the public release status conservative: local final candidate is ready,
  public notarized distribution remains blocked by external signing/notarization requirements.

## 6. Remaining README gaps

No blocking README gaps remain. Future refreshes should update the README when Developer ID
signing/notarization completes, ACP prompt/session routing ships, the MCP runtime client ships,
native adapters ship, or richer Atelier assets replace the current SVG standees.
