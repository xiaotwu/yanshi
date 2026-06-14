# Archived / Resolved

This report is historical. All issues below were fixed and verified (see the matching
CLAUDE_FIX_RESULTS.md). Do not use as current active bugs — current QA state lives in
qa/CURRENT_QA_STATUS.md.

---

# Bugs For Claude

## P1

### 1. Packaged app shows “Event stream unavailable” even though runtime is healthy

Status: FAIL  
Evidence:
- `SCREENSHOTS/30-packaged-app-screen.png`
- `SCREENSHOTS/31-packaged-app-after-wait.png`
- `LOGS/14-packaged-app-launch.log`

Steps:
1. Run `pnpm desktop:release`.
2. Launch `apps/desktop/src-tauri/target/release/bundle/macos/Yanshi.app/Contents/MacOS/yanshi-desktop`.
3. Verify `http://127.0.0.1:8765/health` returns OK.
4. Verify `http://127.0.0.1:8765/events` returns event JSON.
5. Observe packaged app UI.

Expected: packaged UI connects to event stream and does not show an unavailable-stream warning.

Actual: packaged UI persistently shows `Event stream unavailable.`

Notes: sidecar launches from `Contents/Resources/resources/yanshi-runtime-sidecar`, so this appears to be a packaged frontend/runtime event-stream connection issue rather than missing sidecar.

### 2. Shortcut edit capture triggers existing app action and persists conflicting binding

Status: FAIL  
Evidence:
- `SCREENSHOTS/18-shortcut-edit-triggered-search-bug.png`
- `LOGS/12-reset-shortcuts-after-bug.json`

Steps:
1. Open Settings -> Keyboard Shortcuts.
2. Click the New task shortcut binding.
3. Capture `Cmd+K`, which conflicts with Open search.

Expected:
- Capture stays inside the shortcut editor.
- Existing `Cmd+K` Search action does not fire.
- Conflict is shown before accepting or persisted with clear warning.

Actual:
- `new-task` was saved as `Meta+K`.
- Search opened during capture.
- No conflict warning was visible in the resulting state.

## P2

### 3. Project Settings modal does not restore focus to opener

Status: FAIL  
Evidence: Project Settings was opened from the project More menu using real browser clicks; after closing, focus fell back to the page/body rather than the More button.

Expected: focus returns to the invoking More button.

Actual: focus target became the page/body text container.

### 4. Settings modal lacks a visible close button

Status: FAIL  
Evidence:
- `SCREENSHOTS/28-settings-960x680.png`

Expected: Settings modal should have an obvious close affordance, consistent with other large modals.

Actual: Settings closes with ESC, but no close button is present in the dialog DOM.

### 5. New Project close icon is title-only, not accessible as Close

Status: FAIL  
Evidence:
- `SCREENSHOTS/20-new-project-modal-1440x900.png`

Expected: top-right X button should expose an accessible close/cancel label such as `aria-label="Close"` or localized equivalent.

Actual: the icon button is title-only and did not appear as `button[aria-label="Close"]`.

## P3

### 6. “Copenhagen Trip” placeholder feels product-specific and unpolished

Status: FAIL  
Evidence:
- New Project modal name input placeholder.
- Project Settings name input placeholder/accessibility value observed during QA.

Expected: neutral placeholder such as `Project name` or a Yanshi-relevant example.

Actual: `Copenhagen Trip` appears as the generic project-name placeholder.
