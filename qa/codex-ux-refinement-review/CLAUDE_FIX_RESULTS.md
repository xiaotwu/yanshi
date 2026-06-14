# Claude Fix Results — Codex UX Review Fix Pass

Date: 2026-06-10. Scope: the three issues from BUGS_FOR_CLAUDE.md (P1 packaged event stream,
P1 shortcut capture/conflict, P2 modal UX/a11y) + the P3 placeholder. No new features, no mocks,
no runtime architecture changes (the existing real `GET /events?after=` endpoint already existed).

## 1. Issues fixed

### P1-1 — Packaged "Event stream unavailable" (FIXED, verified in the packaged app)

**Root cause:** the old client made exactly **one** `new WebSocket(...)` attempt with no retry —
`socket.onerror` set the error string permanently. At packaged launch the UI connects before the
PyInstaller-onefile sidecar finishes booting (and the tauri:// secure-context origin makes ws:// to
loopback fragile in WKWebView), so the single attempt failed and the error stuck forever despite a
healthy runtime.

**Fix (`stores/runtimeStore.ts`, `api/client.ts`):**
- WebSocket primary with **exponential-backoff reconnect** (1s → 15s cap, never stops).
- **HTTP-polling fallback** through the existing real `GET /events?after=seq` (identical
  `{seq, event}` rows; the server's own WS loop is a 250ms poll, so the transports are equivalent —
  no mock). Polling runs whenever WS is down and stops when WS opens; a shared `seq` cursor
  dedups across transports.
- Honest status machine `connecting | connected | polling | reconnecting | unavailable`
  (shown in Developer → Runtime). The error string appears **only** after ≥3 consecutive poll
  failures while WS is down, and **clears automatically on recovery**. Real errors are not
  suppressed — "unavailable" is still reported when the runtime is truly down.

**Packaged verification (this machine):** launched `Yanshi.app`; `/health` ok; runtime log shows
the new client polling once during sidecar warmup (`GET /events?after=0`) then the WebSocket
connecting (`WebSocket /events` … `connection open`); created a run → **completed**, and the log
shows **3 full UI hydrate bursts** (one per `run.created/started/completed` event) — the packaged
UI is receiving and reacting to live events, which makes a persistent "Event stream unavailable"
impossible (it requires repeated failures of both transports). AppleScript quit → **no orphan**,
no sidecar process remains. (Window screenshot blocked by the un-grantable Screen Recording
permission — log evidence above is the proof.)

**Dev verification:** WS connects normally (no error); killing the runtime mid-session → honest
"Event stream unavailable." after repeated failures; restarting the runtime → **automatic
recovery, error cleared**, new run streamed live updates.

### P1-2 — Shortcut capture triggers command / persists conflict (FIXED)

**Fix (`lib/shortcuts.ts`, `features/shortcuts-settings.tsx`, `App.tsx`):**
- **Capture suspension:** while capturing, `setShortcutCaptureActive(true)` and the app-level
  dispatcher early-returns; the capture listener also uses capture-phase
  `stopImmediatePropagation` + `preventDefault` (belt and braces).
- **Pre-save validation (`validateBinding`):** a conflicting chord is **never persisted**. It
  becomes a pending state on the row: "⌘K conflicts with Open search — not saved" with explicit
  **Replace** (assigns the chord here and unbinds the conflicting command — result is
  conflict-free) or **Cancel** (nothing changes). Previous binding stays intact until resolved.
- Clear / per-command reset / Reset all / live-apply unchanged and re-verified.

**Verified with the exact Codex repro (real Cmd+K keystroke during capture of New task):**
Search did **not** open; conflict message shown; `settings.shortcuts` stayed `{}` (nothing
persisted); Replace produced `{"new-task":"Meta+K","open-search":""}` with zero conflicts;
a unique chord (⌘⇧9) saved, displayed, and persisted instantly.

### P2-3/4/5 — Modal UX / accessibility (FIXED)

- **Settings modal:** visible close button (top-right X, `aria-label`/`title` = Close/关闭).
- **Project Settings focus restore:** the "…" menu refocuses its trigger before the panel modal
  opens, so the shared Modal captures the More button as the restore target. Verified: closing
  Project Settings returns focus to the "…" button.
- **Accessible close labels:** `aria-label={t("common.close")}` (en "Close" / zh "关闭") on every
  modal X — ModalHeader (all panel/integration dialogs), New Project, Search, Settings, Atelier,
  Progress panel. Focus trap / ESC (window-level) / backdrop close re-verified on Search,
  Settings, New Project, Project panels, Atelier.

### P3-6 — Placeholder (FIXED)

`project.namePlaceholder`: "Copenhagen Trip"/"哥本哈根之旅" → neutral "Project name"/"项目名称".

## 2. Files changed

`apps/desktop/src/stores/runtimeStore.ts` (+ new `runtimeStore.test.ts`), `api/client.ts`,
`lib/shortcuts.ts` + `lib/shortcuts.test.ts`, `features/shortcuts-settings.tsx`, `App.tsx`,
`components/modal.tsx`, `components/create-project-modal.tsx`, `features/settings.tsx`,
`features/projects.tsx`, `features/search.tsx`, `features/live-office.tsx`,
`features/progress-panel.tsx`, `i18n/en.ts` + `zh.ts`, `styles.css`. No Python/Rust changes.

## 3. Tests run

- `pnpm lint` PASS · `pnpm typecheck` PASS · `pnpm test` PASS (**29**, +4 shortcut
  capture/validation/resolution, +1 backoff) · `pnpm build` PASS
- `uv run --project runtime/python pytest` PASS (**76**)
- `cargo check` PASS · `cargo test` PASS (**11**)
- `pnpm desktop:release` PASS (`.app` + `.dmg` rebuilt)

## 4. Packaged smoke result

**PASS** — health ok; event stream connected (warmup poll → WS; 3 live hydrate bursts on a real
run's events); run completed; clean quit, no orphaned sidecar.

## 5. Remaining blockers (unchanged, human/external)

Codesign/notarization (Apple Developer ID); Browser Chromium provisioning; Computer-Use
Accessibility/Screen-Recording grants; macOS tray/notifications/global-shortcut interactive QA;
real provider credentials.

## 6. Ready for Codex focused regression QA?

**Yes.** Re-test: (1) packaged launch → no "Event stream unavailable", live progress on a run,
clean quit; (2) shortcut capture of a conflicting chord → no command fires, explicit
Replace/Cancel, nothing persisted silently; (3) Settings close button, Project Settings focus
restore, `aria-label="Close"`/「关闭」on all modal X buttons; (4) dev-mode stream
kill/restart → reconnect + error lifecycle.
