# Keyboard Shortcuts

Shortcuts are editable in **Settings → Keyboard Shortcuts**. Changes apply immediately — no
restart.

## Defaults

| Command | Default | Category |
|---|---|---|
| New chat | `⌘N` | General |
| Open search | `⌘K` | General |
| Open settings | `⌘,` | General |
| Open Projects | `⌘⇧O` | Projects |
| New project | `⌘⇧N` | Projects |
| Open Library | `⌘⇧L` | Navigation |
| Open Workshop | `⌘⇧W` | Navigation |
| Open current chat | `⌘D` | Navigation |
| Toggle progress panel | `⌘J` | Navigation |
| Toggle sidebar | `⌘B` | Navigation |
| Focus composer | `⌘E` | Composer |
| Submit | `⌘↩` / `↩` (in composer) | Composer |
| Upload file | `⌘U` | Composer |
| Open Yanshi Atelier | `⌘L` | Atelier |
| Pause all chats | `⌘⇧.` | Tools |
| Open Developer Mode | `⌘⇧D` | Developer |
| Show / hide Yanshi | `⌘Y` (OS-registered, read-only) | System |

## Editing

Per-command **edit** (press the new chord), **clear**, **reset**, plus **Reset all**, search, and
category grouping. Bindings with `⌘`/`⌃` also fire while typing in inputs; plain-key bindings do
not.

## Conflict detection — honest scope

- **In-app conflicts are detected reliably** — two commands on one binding are flagged on both
  rows, and the conflicting chord is not saved silently (you choose Replace or Cancel).
- **OS / other-app conflicts cannot be detected reliably**, and the page says so.
- The global `⌘Y` is registered with macOS through Tauri; a registration failure is surfaced
  honestly (`YANSHI_SHORTCUT_002`). A captured in-app conflict raises `YANSHI_SHORTCUT_001`.
