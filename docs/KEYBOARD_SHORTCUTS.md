# Yanshi Keyboard Shortcuts

_Editable in Settings → Keyboard Shortcuts (设置 → 键盘快捷键). Updated 2026-06-10._

## Defaults

| Command | Default | Category |
| --- | --- | --- |
| New task | ⌘N | General |
| Open search | ⌘K | General |
| Open settings | ⌘, | General |
| Open Projects | ⌘⇧O | Projects |
| New project | ⌘⇧N | Projects |
| Open Library | ⌘⇧L | Navigation |
| Open Workshop | ⌘⇧W | Navigation |
| Open current task details | ⌘D | Navigation |
| Toggle progress panel | ⌘J | Navigation |
| Toggle sidebar | ⌘B | Navigation |
| Focus composer | ⌘E | Composer |
| Submit task | ⌘↩ / ↩ (in composer) | Composer |
| Upload file | ⌘U | Composer |
| Open Yanshi Atelier | ⌘L | Yanshi Atelier |
| Pause all tasks | ⌘⇧. | Tools |
| Open Developer Mode | ⌘⇧D | Developer |
| Show / hide Yanshi | ⌘Y (OS-registered, read-only) | System |

## How it works

- Defaults live in `apps/desktop/src/lib/shortcuts.ts`; user overrides persist in
  `AppSettings.shortcuts` (command id → binding; empty string = cleared). Changes apply
  immediately — no restart.
- The settings page supports per-command **edit** (press the new chord), **clear**, per-command
  **reset**, **Reset all**, search, and category grouping.
- Bindings with ⌘/⌃ also fire while typing in inputs; plain-key bindings do not.

## Conflict detection — honest scope

- **In-app conflicts are detected reliably:** two commands on one binding are flagged on both rows
  ("Conflicts with …") the moment the second binding is set.
- **OS / other-app conflicts cannot be detected reliably.** The page states: "macOS or another app
  may already use a shortcut — conflicts outside Yanshi cannot be detected reliably."
- The global ⌘Y show/hide shortcut is registered with macOS through Tauri; if its registration
  fails, the failure is surfaced in settings. Full system-wide conflict detection is not claimed.
