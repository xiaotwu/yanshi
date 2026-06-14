# Claude Fix Results — Codex Final-Product QA Regression Pass

Date: 2026-06-09. Implementation agent: Claude. Scope: P0 + P1 (plus low-risk P2) from the Codex
audit. No-mock and secret-safety guarantees preserved; bundled-sidecar behavior preserved.

## 1. Issues fixed (code)

### P0
- **#1 / F1 / UX1 — Runtime sidecar lifecycle (FIXED).** `apps/desktop/src-tauri/src/runtime.rs` + `lib.rs`:
  - Sidecar is spawned as a **process-group leader** (`process_group(0)`); on exit the whole group is
    killed (`/bin/kill -TERM -<pgid>` + `pkill -9 -g <pgid>`). This terminates the PyInstaller-onefile
    forked server that actually holds port 8765, so **the sidecar no longer orphans after quit**.
  - `RunEvent::Exit` (covers Cmd+Q, tray Quit, and AppleScript `quit`) and `quit_app` now call
    `stop_runtime` — previously only `WindowEvent::Destroyed` did, which AppleScript quit never fires.
  - **Startup port guard:** before spawning, probe `127.0.0.1:8765`. If a healthy Yanshi Runtime owns
    it → **adopt** it (mode `adopted-runtime`, reported as running). If an unhealthy process owns it →
    **fail loudly** (`port-conflict`, status `failed`, blocking error in Runtime settings) instead of
    queuing dead runs. If free → spawn. Rust unit test added (`health_probe_accepts_only_healthy_*`).
  - **Verified in the packaged app:** quit → no orphan on :8765 (clean); adopt an external healthy
    runtime → runs complete (not stuck) and the adopted runtime survives app quit (we never kill a
    runtime we did not spawn).

### P1
- **#6 / UX4 — Project context-mode now exposed (FIXED).** The New Project modal already gained a gear
  popover (Default / Project-only) in the prior pass; the Project Overview tab now also shows the
  current Context. Persisted as `project.settings.contextMode` (honest config; deeper memory isolation
  remains future and is not faked).
- **#7 / UX5 / V4 — Project agent office + tab wrapping (FIXED).** Added a first-class **Agents** tab to
  the project workspace showing the real agent team (name, station, live state, queue). Project tabs now
  **horizontally scroll** instead of wrapping at 1200px.
- **#8 / V5 — Workshop localized (FIXED).** All visible Workshop labels are now i18n (tabs, Import pack,
  No packs, Enable/Disable, Agent/Office editor controls, Export). Verified zh-CN renders with **no
  English leak** (创意工坊 / 已安装 / 智能体编辑器 / 工坊编辑器 / 创建 / 导出 / 导入扩展包).
- **#9 / V1 — Atelier stale/mixed worker labels (FIXED).** `computeAgents` now derives displayed worker
  status from the **currently-active run only** (events from finished runs are treated as history). The
  office reads calm/idle between runs instead of stranding old "Failed"/"Done" mixed with life actions.
  (Procedural worker look is the documented asset-ready fallback — `characters.ts` registry; modelled
  GLB art remains future.)
- **#5 / F4 — Provider scope (FIXED honestly, not faked).** Catalog already marks Anthropic/Gemini
  "Not implemented yet" and OpenAI-compatible endpoints as available/custom-endpoint. Documented as a
  narrowed, honest release scope. Full multi-provider registry + per-run selection remains future.

### P2 (low-risk, directly related)
- **F5 — Approval `deny`/`approve` aliases (FIXED).** Backend `ApprovalDecisionRequest` validator maps
  `deny→denied`, `approve→approved`. pytest added.
- **#10 / V2 / UX8 / R1 — Add-to-project submenu containment (FIXED, regression re-fix 2026-06-09).**
  The first fix (max-height + internal scroll) was insufficient — Codex R1 showed the menu still opened
  too low (menu bottom 848.4, submenu bottom 895.5 at 1200×818). Now fixed with real viewport-aware
  placement (`lib/menu-placement.ts`, 12px collision padding, measured before paint via
  `useLayoutEffect`):
  - The "+" menu **flips upward** when the space below the trigger is insufficient, and clamps
    `maxHeight` to the available side (internal scroll only after placement is corrected).
  - The Add-to-Project submenu is now a **fixed-position flyout** placed independently: top-aligned
    with its row, **shifted up** when its bottom would overflow, **flipped to the menu's left side**
    when its right edge would overflow, height clamped to `viewport - 2×12px`. It stays a DOM child
    of the menu (2px overlap) so the existing hover-leave close behavior is unchanged.
  - Verified in a real UI smoke at 1200×818 (vite + isolated runtime): menu bottom **791.5** and
    submenu bottom **805.5**, both ≤ 806 (`818 − 12`); at 1200×600 the menu flips up (bottom 342.5)
    and both boxes stay inside. Project list / icon+name / New Project entry / selected-project
    check + chip / hover-leave close / left-aligned layout all preserved
    (screenshot: `claude-fix-evidence/add-to-project-fixed-1200x818.png`). 7 vitest placement tests
    added, including the exact failing QA geometry.
- **#11 / V3 / UX7 — Search modal containment (FIXED).** `.search-modal .search-results` now `flex:1;
  min-height:0` so results scroll inside the modal surface.
- **#12 / F6 — JS tests (FIXED).** Added vitest tests (i18n key parity en/zh, no-empty-strings,
  locale resolution/interpolation, project/agent helpers). `pnpm test` is no longer green-by-emptiness
  (8 tests).

## 2. Remaining blocked (environment / human / external credentials)
- **#2 / M1 — codesign + notarization:** needs an Apple Developer ID Application cert + notarization
  credentials. Build is unsigned/un-notarized (documented in docs/BUILD_AND_RELEASE.md).
- **#3 / M2 / F2 — Browser Chromium:** packaged sidecar has no Chromium → honest
  `playwright_browser_binaries` setup-required state. Bundling Chromium into the PyInstaller onefile is
  a large packaging change (deferred). Manual: `playwright install chromium` in the runtime env.
- **#4 / M3 / M4 / F3 — Computer Use permissions:** Accessibility (click/type/shortcut) + Screen
  Recording (screenshot) require a human grant to `Yanshi.app`. Honest permission-required state +
  Settings → Permissions shows status with a Refresh + "System Settings > Privacy & Security" hint.
  `open-app` (no permission) works.
- **M5–M9 — notifications, ⌘Y global shortcut, menubar/tray, packaged window focus QA, real provider
  credentials:** require human macOS interaction / a real key.
- **M10 — QA's fake provider key:** the app intentionally never exposes stored secrets; the prior value
  cannot be recovered. Provider settings honestly show "Not configured" until a key is re-entered — the
  user must re-enter credentials in Settings → Providers before real model use. No secret leak introduced.

## 3. Deferred (P3, out of scope this pass)
- **#13 — large-bundle warning:** the 3D Atelier is already lazy-loaded; finer manual-chunk splitting
  deferred (cosmetic build warning, not a product blocker).
- Native Anthropic/Gemini adapters + full multi-provider runtime selection (large feature).

## 4. Tests run
- `pnpm lint` PASS · `pnpm typecheck` PASS · `pnpm test` PASS (**15 tests**, +7 menu-placement) ·
  `pnpm build` PASS
- `uv run --project runtime/python pytest` PASS (**74**, +1 approval-alias)
- `cargo check` PASS · `cargo test` PASS (**11**, +1 health-probe)
- `pnpm desktop:release` PASS (`.app` + `.dmg`)

## 5. Build results
- `apps/desktop/src-tauri/target/release/bundle/macos/Yanshi.app`
- `apps/desktop/src-tauri/target/release/bundle/dmg/Yanshi_0.1.0_aarch64.dmg` (~67 MB; bundled sidecar)

## 6. Packaged app smoke results
- Startup + bundled-sidecar health: PASS.
- **Lifecycle (P0 #1): PASS** — quit (AppleScript) leaves **no orphan** on :8765; adopt-healthy →
  run completes (not stuck); adopted runtime survives app quit.
- Workshop zh-CN localization: PASS (no English leak).
- Search modal / Projects / Atelier / Progress panel / Providers / i18n en-US·zh-CN / themes: functional
  (verified in this + prior passes). Interactive macOS items (tray, notifications, shortcut, permission
  grants, packaged window focus): human-gated, unchanged.

## 7. No-mock audit
PASS — static scan clean; honest missing-requirement states preserved for Browser, Computer, providers;
worker states now bound to the active run (no fake/stale task progress).

## 8. Secret audit
PASS — no hardcoded secrets; provider key stays in the off-DB secret store; never returned in
responses/logs/events. App requires honest re-entry of provider credentials (M10).

## 9. What Codex should re-test next
1. Lifecycle: repeated launch/relaunch, quit via Cmd+Q **and** AppleScript, confirm no orphan on :8765
   and no runs stuck at `created`; verify the `port-conflict` blocking state when an unhealthy process
   holds the port.
2. Workshop: import a valid pack, reject unsafe (traversal/exe/symlink) packs, enable/disable, export +
   re-import; confirm zh-CN stays localized.
3. Projects: Agents tab content + context-mode display; tabs no longer wrap at 1200px.
4. Atelier: confirm worker labels match the active run and do not show stale/mixed terminal states.
5. Approval: `deny`/`approve` aliases now accepted (200).
6. Search + add-to-project menu containment at 1200×818 (R1 re-fix): open homepage → "+" →
   Add to Project; assert menu bottom and submenu bottom ≤ viewport − 12px, both menus usable;
   also re-check at a smaller height (e.g. 1200×600 — the "+" menu should flip upward).
7. Still blocked (need human/external): codesign/notarization, Chromium provisioning, Computer-Use
   permission grants, notifications/shortcut/menubar/window focus, real provider credentials.
