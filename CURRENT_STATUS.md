# Current Status

_Last updated: 2026-06-13 (README/docs progress reconciliation). One clean snapshot — pass-by-pass history
lives in IMPLEMENTATION_LOG.md; acceptance detail in ACCEPTANCE_CHECKLIST.md; QA state in
qa/CURRENT_QA_STATUS.md._

## Product status

**Yanshi v0.1 — Local Final Candidate (frozen 2026-06-12).** The packaged macOS app (Tauri
shell + bundled standalone Python runtime sidecar) is feature-complete for v0.1, real
end-to-end (no mocks), passes every automated suite, and passed **Codex global validation**
(PASS WITH MINOR ISSUES, ~92% readiness — artifacts under `qa/codex-global-review/`; error
toast system accepted, packaged smoke passed, no-mock + secret audits passed).

- **Ready for local final-candidate use** on this machine today.
- **Not yet a public notarized release.**
- **No active P0/P1/P2 issues remain.**
- **Current docs/README task progress is clean** — remaining items are classified as human
  verification, external release blockers, or deferred roadmap in NEXT_STEPS.md.

## Current workflow

- **Claude Code** — design, implementation, and bug fixes.
- **Codex** — independent validation / regression QA.
- **User** — final product decisions and human-only verification.
- **Junie** — historical only, no longer part of the active workflow (Junie evidence directories
  were removed in repository cleanup).

## Latest verified state (2026-06-11)

- Suites green: pytest **79** · vitest **34** · cargo **11** · `pnpm lint` / `typecheck` /
  `build` · `pnpm desktop:release` (.app + .dmg, bundled sidecar; launch + clean quit verified).
- **Chat-first UX:** New Chat / Recent chats user-facing (runs/tasks stay internal); Claude-style
  conversation view from real events; Library + right-panel Files show real file names; honest
  "Start a new chat" (no fake continuation).
- **Settings:** fixed title + independent scroll panes; Profile (local identity: name, emoji
  avatar, label); AI-integration sections as card rows + centered config modals; Save split from
  Set-as-preferred; nested-modal ESC closes one layer; Permissions shows an honest
  bridge-unavailable state.
- **Providers:** real OpenAI-compatible save/test; API key in the off-DB secret store — never in
  SQLite/responses/logs (re-audited). Anthropic/Gemini honestly "not implemented".
- **ACP foundation (real):** stdio launch + JSON-RPC `initialize` handshake + live capability
  discovery with honest lifecycle; prompts/tools not routed yet and the UI says so. MCP: config
  persistence only, honest statuses, tools never faked.
- **Yanshi Atelier / 偃师工坊:** the **Yanshi Puppets (偃师傀)** worker identity — authored 2D
  chibi art (generated SVG; six role variants with mechanical puppet-ear fins + red seal pin;
  six runtime-driven expressions) rendered as billboard standees in the 3D office and reused in
  the 2D fallback (design system: docs/YANSHI_ATELIER_WORKER_DESIGN.md). Desk scenes; localized
  hover cards; Developer-only debug labels; reduced-motion static mode; the WebGL-context-leak
  reopen bug is fixed; context follows the chat (standalone ↔ project).
- **i18n:** en-US / zh-CN with compile-time parity; zh-CN product naming unified to 偃师 / 偃师工坊.
- **Error toasts (2026-06-12):** app-wide red toasts (~8s, stacking, accessible) with stable
  `YANSHI_<AREA>_<NNN>` codes + localized reasons for every user-facing failure
  (docs/ERROR_CATALOG.md, 24 codes); structured diagnostics to logs, no stack traces in UI.
  Inline red error text removed app-wide (2026-06-12 cleanup): components show neutral
  empty/retry states; toasts are the single error surface (form-validation hints and Developer
  diagnostics intentionally kept).
- **macOS close (2026-06-12):** the red close button always asks 退出偃师？(Cancel / Hide to
  menu bar / Quit); Quit fully terminates app + sidecar (no orphans, verified packaged).
- **Worker stations (2026-06-12):** formal home-station assignments + occupancy guard — task
  states pin workers to their own desks; only gated life actions move them (shared-area slots,
  never another worker's station); 10 unit tests.
- **Public docs site (2026-06-13):** VitePress site in `apps/docs/`, GitHub Pages workflow,
  configurable `DOCS_BASE_PATH` base path, custom product/docs homepage, public honesty status
  language, and final desktop/mobile preview smoke screenshots under `qa/docs-site-pass/SCREENSHOTS/`.
- **README/docs status reconciliation (2026-06-13):** public README updated from actual repo state;
  docs-site review passed; progress checkboxes reconciled so global release blockers no longer
  appear as unfinished current task work (`qa/codex-readme-update/`,
  `qa/codex-progress-reconciliation/`).

## Active known blockers (all external/human — no product bugs)

- Public **codesign / notarization** (Developer ID cert needed) + Gatekeeper second-machine
  verification.
- **Chromium provisioning** for the packaged Browser tool (`playwright install chromium`) —
  honest missing-dependency state until then.
- **macOS Accessibility / Screen Recording grants** for Computer Use click/type/shortcut/
  screenshot (honest permission-required state until granted).
- Human-only checks: packaged titlebar traffic-light glance, reduced-motion eyeball,
  tray/notifications/⌘Y/close-prompt interactive pass, real provider API key entry.
- Optional polish (deferred, tracked in NEXT_STEPS): richer Atelier worker assets, ACP prompt
  routing, MCP runtime client, more native providers, chat continuation.

## Build / run

- Distributable build: `pnpm desktop:release` →
  `apps/desktop/src-tauri/target/release/bundle/macos/Yanshi.app` and `.../dmg/Yanshi_0.1.0_aarch64.dmg`.
- Dev: `pnpm desktop:dev`. Web UI smoke: `pnpm --filter @yanshi/desktop dev --host 127.0.0.1`.
- Docs: `pnpm docs:dev`, `pnpm docs:build`, `pnpm docs:preview` →
  `http://localhost:4400/yanshi/` for built-site preview.

## Distribution

Functionally distributable local build exists. **Not publicly releasable yet** —
codesign/notarization pending (steps in docs/BUILD_AND_RELEASE.md).
