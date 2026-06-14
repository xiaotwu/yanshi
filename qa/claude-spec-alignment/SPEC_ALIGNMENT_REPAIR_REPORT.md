# Spec Alignment Audit + Repair Report (2026-06-13)

## 1. Verdict

**PASS.** A full audit of the original product design spec against the latest product decisions
and the current implementation found the product **already aligned with every latest decision**.
No P0/P1/P2 mismatches. One safe P3 hygiene repair applied (dead i18n keys). All suites green.

## 2. Original spec areas reviewed

All 33 audit areas (see `SPEC_ALIGNMENT_MATRIX.md`), mapped from `docs/Yanshi_Product_Design_Spec.md`
§0–§32: app shell, runtime lifecycle, New Chat/composer, chat view, right panel, search, projects,
library/files, Atelier, workers/stations, workshop, settings, AI integrations, providers, ACP,
MCP, skills, browser, computer use, terminal/docker, file tool, permissions/approvals,
automations, error toasts, i18n, theme, context menus, shortcuts, developer mode, docs site,
README, build/release, no-mock/secret safety.

## 3. Latest overrides applied (confirmed in implementation)

- "New Task" → **New Chat / 新对话**.
- "Runs" page → **Library** (runtime run records internal only).
- "Artifacts" page → **Files / Outputs**.
- "Live Office" → **Yanshi Atelier / 偃师工坊** (centered floating window).
- warm-ivory palette → **white / near-black + mint-green glow**.
- zh-CN product name → **偃师**.
- Workflow: Claude implements, Codex validates, Junie historical only.
- Honest states for Provider / ACP / MCP / Skills / Browser / Computer / Terminal; public release
  pending Apple Developer ID.

## 4. Mismatches found

**None at P0/P1/P2.** The only finding was code hygiene: four old-terminology i18n keys
(`nav.runs`, `project.tabRuns`, `project.tabArtifacts`, `progress.tabArtifacts`) still defined but
with **zero UI references** — not a user-facing leak, but stale.

## 5. Mismatches fixed

- Removed the four dead i18n keys from `apps/desktop/src/i18n/en.ts` and `zh.ts` (compile-time
  parity preserved; i18n parity test green). No rendered UI changed.

## 6. Mismatches deferred

None to defer beyond the documented roadmap (these are not mismatches — they are honestly-scoped
foundations/future work): ACP prompt/tool routing, MCP runtime client, native provider adapters,
chat continuation, richer Atelier animation/3D + pathfinding.

## 7. Obsolete old-spec items (NOT reverted)

§9 New Task, §13 Runs page, §14 Artifacts page, §16-17 Live Office, §20 warm-ivory palette — all
intentionally superseded by the latest decisions and left as-is. Internal runtime identifiers
(`Run`, `Artifact`, `LiveOfficeState`, package `live-office`, i18n `tasks.*`/`project.tab*`
namespaces) legitimately remain — they are developer-facing, not user-facing.

## 8. Files changed

- `apps/desktop/src/i18n/en.ts`, `apps/desktop/src/i18n/zh.ts` — removed 4 dead keys.
- Docs: `IMPLEMENTATION_LOG.md`, `qa/CURRENT_QA_STATUS.md` (+ this report and the matrix).

No `apps/desktop` component/runtime/Tauri logic, `runtime/python`, `packages/*` behavior changed.

## 9. Docs updated

`IMPLEMENTATION_LOG.md` (audit entry), `qa/CURRENT_QA_STATUS.md` (current validation reference),
`qa/claude-spec-alignment/SPEC_ALIGNMENT_MATRIX.md` + this report. `CURRENT_STATUS.md`,
`README.md`, `docs/FINAL_PRODUCT_GAPS.md`, `docs/AI_INTEGRATIONS.md`, `docs/ERROR_CATALOG.md`,
`docs/UI_INTERACTION_MODEL.md`, `docs/KEYBOARD_SHORTCUTS.md`,
`docs/YANSHI_ATELIER_WORKER_DESIGN.md` reviewed and already current — no changes needed (they
already separate implemented / setup-required / blocked / deferred / obsolete).

## 10. Commands run

| Command | Result |
|---|---|
| `pnpm lint` | PASS |
| `pnpm typecheck` (in lint) | PASS |
| `pnpm test` | PASS (41 tests, 7 files — incl. i18n parity) |
| `pnpm build` | PASS |
| `uv run --project runtime/python pytest` | PASS (79) |
| `cargo check` | PASS |
| `cargo test` | PASS (11) |
| `pnpm docs:build` | PASS |
| `DOCS_BASE_PATH=/new-repo-name/ pnpm docs:build` | PASS |

`pnpm desktop:release` not run — no desktop shell / runtime / Tauri config / packaged behavior
changed (the only edit removes unused i18n keys from the web bundle).

## 11. Manual smoke result

Live web smoke (vite + isolated runtime):

- Sidebar terms: **New Chat / Search / Library / Workshop / New Project** — zero
  Runs/Artifacts/Live Office/New Task leaks (zh-CN: 新对话 / 搜索 / 资料库 / 创意工坊).
- Yanshi Atelier: open → close → reopen ×2, live canvas each time, **no blank**, single toolbar
  button (no duplicate pop-out), dev chips hidden in normal mode, title "Yanshi Atelier" /
  "偃师工坊".
- Right panel sections: progress / files / approvals / agents.
- Error toast: provider test against a dead endpoint → `YANSHI_PROVIDER_002` with localized reason
  + Open-Settings action; assertive ARIA live region.
- Dark theme + zh-CN verified.

## 12. Remaining blockers

External/human only: Apple Developer ID signing + notarization + stapling + Gatekeeper
second-machine verification; Browser Chromium provisioning; Computer Use macOS Accessibility /
Screen Recording grants; real provider API key for live chats; packaged human interactive pass.

## 13. Ready for Codex validation?

**Yes.** The product is fully aligned with the latest product decisions, no active P0/P1/P2,
suites green, and the change set is a single safe i18n cleanup plus documentation. Recommended
Codex focus: spot-check the alignment matrix conclusions and the dead-key removal.
