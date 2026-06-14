# Focused Regression QA Report

Date: 2026-06-10  
Reviewer: Codex QA  
Scope: Latest Claude fixes for packaged event stream, shortcut editor, and modal accessibility.  
Source-code edits: NONE

## Final Verdict

**PASS**

All three focused regression areas were verified fixed. No focused issue remains FAIL. No new `BUGS_FOR_CLAUDE.md` was written for this regression pass because no failures reproduced.

## Automated Checks

| Check | Status | Evidence |
|---|---:|---|
| `pnpm lint` | PASS | `LOGS/regression-01-pnpm-lint.log` |
| `pnpm typecheck` | PASS | `LOGS/regression-02-pnpm-typecheck.log` |
| `pnpm test` | PASS | `LOGS/regression-03-pnpm-test.log` (29 app tests passed across 5 files) |
| `pnpm build` | PASS | `LOGS/regression-04-pnpm-build.log` |

## 1. Packaged App Event Stream

| Requirement | Status | Evidence |
|---|---:|---|
| Launch packaged `Yanshi.app` | PASS | `REGRESSION_LOGS/packaged-app-launch.log` |
| Verify bundled sidecar health | PASS | `/health` returned OK; sidecar path in process list was inside `Yanshi.app/Contents/Resources/resources/` |
| Verify UI does not show persistent `Event stream unavailable` | PASS | `REGRESSION_SCREENSHOTS/01-packaged-initial.png`; accessibility observations |
| Verify event stream receives live task/run progress | PASS | Created real `List workspace files` run; runtime emitted events; packaged UI Recents updated without reload |
| Verify reconnect behavior if practical | PASS | Killed sidecar, restarted packaged sidecar binary, created second run; open UI showed post-reconnect run |

Important evidence:

- `REGRESSION_LOGS/packaged-create-run.json`
- `REGRESSION_LOGS/packaged-events-after-create.tail.json`
- `REGRESSION_LOGS/packaged-reconnect-kill-sidecar.log`
- `REGRESSION_LOGS/packaged-reconnect-manual-sidecar.log`
- `REGRESSION_LOGS/packaged-create-run-after-reconnect.json`
- `REGRESSION_LOGS/packaged-runs-after-reconnect.json`
- `REGRESSION_LOGS/packaged-ui-accessibility-observations.md`
- `REGRESSION_SCREENSHOTS/05-packaged-after-reconnect-run.png`

Notes:

- The clean packaged QA profile showed onboarding after the first run, which obscured the center of the UI in screenshots. Computer Use accessibility inspection still verified that Recents updated and no warning text was present.
- macOS System Events click was blocked with `-25208`, but this did not block event-stream verification.

## 2. Shortcut Editor

| Requirement | Status | Evidence |
|---|---:|---|
| Open Settings -> Keyboard Shortcuts | PASS | DOM-driven Settings path verified |
| Edit New Task shortcut | PASS | Capture state entered |
| Press `Cmd+K` during capture | PASS | Simulated `Meta+K` keydown |
| Confirm Search does not open during capture | PASS | No Search dialog opened |
| Confirm conflict with Search is detected | PASS | UI showed `⌘K conflicts with Open search — not saved` |
| Confirm conflicting shortcut is not silently persisted | PASS | Runtime settings remained `shortcuts: {}` |
| Confirm valid shortcut edit persists and applies | PASS | `Meta+Shift+P` persisted and immediately activated New Task without restart |

Evidence:

- `REGRESSION_SCREENSHOTS/06-shortcut-conflict-capture.png`
- Runtime result: conflict state did not persist `Cmd+K`; valid edit persisted `{ "new-task": "Meta+Shift+P" }`
- Reset after test: `REGRESSION_LOGS/dev-reset-shortcuts.json`

## 3. Modal Accessibility

| Requirement | Status | Evidence |
|---|---:|---|
| Settings has visible close button | PASS | Close button has `aria-label="Close"`, `title="Close"`, class `settings-close` |
| New Project close button has accessible label | PASS | New Project close icon has `aria-label="Close"` and `title="Close"` |
| Project Settings restores focus after close | PASS | Focus returned to the invoking `More` button |
| ESC behavior remains correct | PASS | Settings and New Project closed via ESC |
| Click-outside behavior remains correct where expected | PASS | Settings and New Project closed on outside click |

Evidence:

- `REGRESSION_SCREENSHOTS/07-settings-close-button.png`
- `REGRESSION_SCREENSHOTS/08-project-settings-focus-restored.png`

## Cleanup

Status: PASS

- Stopped packaged app and sidecar.
- Stopped dev Vite server and isolated runtime.
- Confirmed ports `5178`, `18766`, and `8765` were no longer listening after cleanup.

## Residual Risk

- This was a focused regression pass only. It did not re-run the full final product QA matrix.
- Packaged UI verification used screenshots plus Computer Use accessibility tree; DOM-level assertions for shortcut/modal fixes used the dev UI because Tauri webview DOM is not directly inspectable from Playwright.
