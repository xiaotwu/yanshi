# macOS App

Yanshi is a native-feeling **Tauri** desktop app for macOS with a bundled Python runtime sidecar.

![Yanshi home](/screens/home.png)

## The shell

- A custom title bar with the macOS traffic lights aligned to the toolbar controls (sidebar
  toggle, back/forward) and right-side controls (Atelier, progress panel).
- A collapsible sidebar (`⌘B`), a right Progress panel (`⌘J`), and the Atelier window (`⌘L`).
- Light / Dark / System themes with a tokenized mint-green accent.

## Bundled runtime sidecar

The packaged app launches the runtime in `mode=bundled-sidecar` — a standalone PyInstaller binary
embedded in the app. No `uv`, virtualenv, or repo checkout is needed at runtime. The shell:

- adopts a healthy runtime or fails loudly on a port conflict (no stuck state), and
- terminates the sidecar by process group on every quit path, so nothing orphans on `:8765`.

## Quitting

Pressing the red close button always asks **Quit Yanshi? / 退出偃师？** with Cancel / Hide to menu
bar / Quit (plus a warning when chats are active). Quit pauses active chats and fully terminates
the app and sidecar. `⌘Q` and the tray Quit use the same canonical full-quit path. The app never
silently hides on close.

## Tray, notifications, shortcuts

A menu-bar tray (Open / Current Tasks / Open Atelier / Pause All / Quit), desktop
[notifications](/desktop/notifications), and a `⌘Y` global show/hide shortcut. In-app
[keyboard shortcuts](/desktop/shortcuts) are editable.

## Errors

All user-facing errors appear as accessible red toasts with a code and short reason. See the
[Error Catalog](/reference/error-catalog).
