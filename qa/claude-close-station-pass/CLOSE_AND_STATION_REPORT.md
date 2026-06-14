# Close-Behavior + Station-Behavior + Error-Toast Pass Report (2026-06-12)

_Covers the two stacked requests of this pass: (1) app-wide error toast system + error catalog,
(2) macOS close confirmation/full quit + fixed worker stations._

## 1. Verdict

**PASS** (one human-click verification remains: the red close button in the packaged app —
see §10).

## 2. macOS close behavior implemented

- The red close button now **always** shows the confirmation prompt (Rust `CloseRequested`
  always emits `desktop:close-prompt`; the silent-hide branch is gone).
- Prompt (`CloseRunsModal`, `role="alertdialog"`): 退出偃师？/ Quit Yanshi? · 这会停止偃师以及
  所有后台 Agent 进程。/ This will stop Yanshi and all background agent processes. · active-chat
  warning line when count > 0 (正在运行的对话可能会停止。) · buttons **取消 / 隐藏到菜单栏 /
  退出** (Cancel / Hide to menu bar / Quit; Quit is the highlighted destructive default).
- Quit pauses active chats, then calls the canonical `quit_app` path. Repeat close presses
  re-emit into the same open modal (no duplicate prompts).

## 3. Full quit / sidecar cleanup

Unchanged canonical path, re-verified: every exit (prompt Quit, Cmd+Q, tray Quit, AppleScript)
goes through `stop_runtime` (process-group kill). Packaged smoke: launch healthy in 5s →
AppleScript quit → **no process and no listener on :8765 remained**; relaunch works.
(Note: long-lived *dev/QA* runtimes spawned by agent test sessions are outside the app's
lifecycle and were cleaned manually; not an app bug.)

## 4. Station assignment behavior

New pure module `packages/live-office/src/stations.ts`:

- `WorkerStationAssignment` + `buildStationAssignments` — exactly one owner per home station;
  duplicate/unknown roles go to the shared meeting area, never someone else's desk.
- Home stations: manager/browser/computer/file/reviewer/terminal (project layouts override
  positions; standalone uses defaults — existing project/standalone office scoping untouched).

## 5. Movement rules implemented

- `WorkerMovementReason`: `none | break_room | rest | shared_table | wander | return_home`.
- `movementReasonFor`: **every task state pins the worker home** (working, waiting approval,
  blocked, failed, done); only decorative life actions map to movement (coffee→break_room,
  nap→rest, chat→shared_table, walk→wander); stretching/phone happen in place.
- **Occupancy guard** (`resolveWorkerTarget`): shared areas hand out deterministic per-worker
  slots (keyed by home-station index — collision-free for the core team) so workers never
  overlap; any target within 0.45 of a *foreign* home station is rejected → the worker stays
  home; wander orbits the worker's own desk and is clamped the same way; return-home is the
  default resolution.
- Reduced-motion snap behavior preserved; hover cards/status ring/debug labels unchanged.
- 10 unit tests (`stations.test.ts`): assignment uniqueness, task-state pinning, life-action
  mapping, layout overrides, non-overlapping shared slots, foreign-home rejection (shared +
  wander), default-layout clearance sweep.

## 6. Error toast system

- Registry `apps/desktop/src/lib/errors.ts`: 24 stable codes (`YANSHI_<AREA>_<NNN>`) across
  Runtime/Provider/Browser/Computer/Docker/File/Workshop/Atelier/ACP/MCP/Shortcuts/Settings/
  Projects/Automations/UI/Unknown; unknown → `YANSHI_UNKNOWN_001`.
- Toast UI bottom-right: code chip + localized title + short reason + optional action
  (Open Settings → relevant section / Open logs); ~8s auto-dismiss; manual dismiss; dedupe
  window (5s) against spam; stack cap 4; soft red styling on light/dark tokens; reduced-motion
  safe. Accessibility: `aria-live="assertive"`, `role="alert"`, labeled dismiss, Escape
  dismisses the focused toast, code chip ≠ color-only.
- Wiring: all runtimeStore failure paths (hydrate, run/project CRUD, workshop import incl.
  unsafe-pack detection, provider save/test incl. ok=false results, settings save with
  optimistic rollback, integrations save, ACP connect/disconnect, restart, approvals, pause),
  event-stream unavailable transition (auto-clears on recovery), runtime missing-requirement
  events (Chromium/Accessibility/Screen Recording/Docker/provider), shortcut conflict +
  global-registration failure, library/file loads, composer upload, automations, Atelier render
  boundary, root UI boundary. Structured diagnostics go to the console/logs; no stack traces in
  normal mode.
- `docs/ERROR_CATALOG.md`: all 24 codes with cause / user action (en+zh) / developer notes.
- 7 unit tests (`errors.test.ts`): code format + uniqueness, en/zh key coverage for every code,
  unknown fallback, missing-requirement mapping, catalog completeness, auto-dismiss timing
  (fake timers), dedupe + manual dismiss + stack cap.

## 7. Real vs future work

Everything above is real and wired. Not implemented (documented): per-toast bespoke Retry
callbacks (actions are Open Settings / Open logs today), toast history view, backend-pushed
error events beyond missing-requirements.

## 8. Files changed

`src-tauri/src/lib.rs` · `components/modals.tsx` · `components/error-toasts.tsx` (new) ·
`components/error-boundary.tsx` (onError) · `lib/errors.ts` + `lib/errors.test.ts` (new) ·
`stores/runtimeStore.ts` · `features/{live-office,library,automations,shortcuts-settings}.tsx` ·
`components/composer.tsx` · `main.tsx` · `App.tsx` · `packages/live-office/src/stations.ts` +
`stations.test.ts` (new) · `packages/live-office/src/index.tsx` · i18n en/zh · styles.css.

## 9. Docs changed

`docs/ERROR_CATALOG.md` (new) · `docs/UI_INTERACTION_MODEL.md` ·
`docs/YANSHI_ATELIER_WORKER_DESIGN.md` · CURRENT_STATUS · NEXT_STEPS · ACCEPTANCE_CHECKLIST ·
IMPLEMENTATION_LOG · this report.

## 10. Commands run + smoke results

| Command | Result |
|---|---|
| pnpm lint / typecheck / test / build | PASS (41 + 10 package tests) |
| uv run --project runtime/python pytest | PASS (79) |
| cargo check / cargo test | PASS (11) |
| pnpm desktop:release | PASS |

Live smoke: real provider-test failure → red toast `YANSHI_PROVIDER_002` with zh reason +
打开设置 action, topmost above the modal overlay (elementFromPoint verified), still visible at
5.5s, gone after ~8s, second trigger stacks (2), manual dismiss 1→0, aria-live assertive,
labeled dismiss (关闭), structured console diagnostics, no stack traces. Stations: all six
puppets at their own desks; one worker on a gated break at the shared area slot; no overlap
(SCREENSHOTS/cs-04-stations.png). Packaged: launch healthy 5s, AppleScript/Cmd+Q-path quit with
zero orphans, relaunch works.

**Remaining human check:** click the red close button in the packaged app → prompt → Cancel
keeps it open → close → 退出 quits fully (the Rust diff is a one-branch change on the path that
was already verified when runs were active; programmatic clicking of the native close button
needs Accessibility grants my environment doesn't have).

## 11. Remaining issues

None known beyond §10's human click and the pre-existing human/external blockers in
CURRENT_STATUS.md.
