# UX Issues

## P1

### Shortcut capture does not isolate editing from app shortcuts

Status: FAIL  
Evidence:
- `SCREENSHOTS/18-shortcut-edit-triggered-search-bug.png`

Capturing `Cmd+K` for New task triggered Search and persisted the conflicting value. This makes shortcut editing feel unsafe and unpredictable.

Suggested fix: while a shortcut row is capturing, stop propagation to app-level shortcut handlers and validate/display conflicts before saving.

## P2

### Modal focus restoration fails for Project Settings

Status: FAIL

Closing Project Settings after opening it from the More menu returned focus to the page/body instead of the opener.

Suggested fix: store the active opener from real click/focus events and restore it after modal close.

### Settings modal requires implicit dismissal

Status: FAIL

Settings closes via ESC, but it lacks a visible close control. This is especially awkward on a large modal that can stay open over most of the app.

Suggested fix: add the same close affordance used by other modals.

### New Project close icon is not accessible enough

Status: FAIL

The X icon is title-only and was not discoverable as an accessible close button.

Suggested fix: add localized `aria-label` and keep visible tooltip/title if desired.

## NOT TESTED / BLOCKED

- Real macOS global shortcut registration behavior: BLOCKED by OS-level interaction and permissions.
- Tray/menu bar/notification flows: BLOCKED by macOS interactive state.
- Finder reveal from Library context menu: BLOCKED in web dev shell; the action honestly says it is available in desktop app.
- Atelier object context menus: NOT TESTED. The canvas rendered, but no practical DOM/object context target surfaced during QA.
