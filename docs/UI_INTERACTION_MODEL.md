# Yanshi UI Interaction Model

_How the desktop UI is organized (updated 2026-06-11)._

## Chat is the user-facing concept

Users create and revisit **Chats** (新对话 / 最近对话). Internally each chat is still a runtime
*run* with tasks/actions/observations — schemas, APIs and Developer Mode keep that terminology.
Opening a Recent shows a Claude-style conversation: the user message bubble, Yanshi message blocks
built from real observations, plan + approval cards, output file cards, a working indicator, and a
real "Start a new chat" action (the runtime cannot continue a finished run, so no follow-up
composer is faked). **Artifacts are not a user-facing concept** — generated outputs appear as
files (Library + right panel Files, with Web source links from artifact metadata); the runtime's
artifact records are unchanged. The Workshop opens as a centered floating window; the right
Progress panel is a compact dropdown-driven utility (Progress / Files / Approvals / Agents) with
no duplicate chrome. The Atelier and the app root are wrapped in error boundaries with a WebGL
pre-check — render failures show a fallback (retry / simplified worker list), never a blank app.

## Information architecture

```txt
Sidebar
  New Task · Search · Library · Workshop      (primary nav; + Approvals/Developer when relevant)
  PROJECTS: New Project · project list        (click "PROJECTS" label → lightweight selector)
  RECENTS: newest tasks first (standalone + project, with project context)
  Account block (bottom)
```

- **Library replaces the top-level "Runs" page.** Run records still exist in the runtime; the
  Library organizes their files/artifacts Project → task (+ a Standalone section) with All-files /
  All-artifacts views and time/name/size/type sorting. Task details (Hybrid Transcript, approvals,
  Developer raw events) open from Recents, project task lists, and Library items.
- **Projects are focused workspaces, not dashboards.** A project page = header (icon · name ·
  compact status · "…" menu) + project-scoped composer ("New task in X") + Tasks | Files pills.
  Agents / Automations / Artifacts / Atelier / Activity / Project settings live behind the "…"
  menu as centered modals.
- **Add to Project lists real projects only** (+ "New project…"); no "Standalone" pseudo-project —
  no selection = standalone. "Remove from Project" appears only while a project is selected.

## Floating surfaces

All large surfaces are **centered floating windows** built on one `Modal` component
(`components/modal.tsx`): Search, Settings, New Project, Project settings/panels, Yanshi Atelier,
AI-integration config dialogs. Uniform behavior: centered + viewport-clamped, responsive max
sizes, internal scrolling, ESC + backdrop close (backdrop opt-out for destructive flows), focus
trapped while open and restored on close.

## Settings (updated 2026-06-11)

The Settings window is a two-pane modal: the "设置/Settings" title is a fixed header in the nav
column; the section list scrolls under it and the content pane scrolls independently. The content
column is 680px for calm pages and full-width (`settings-panel.wide`) for dense pages
(integrations, shortcuts). **Profile** edits a local workspace identity (display name,
emoji/preset avatar + background, workspace label — `AppSettings.profile`), reflected in the
account block; no account/login/subscription exists or is implied.

All four AI-integration sections share one pattern: **compact card rows** (icon, name, one-line
detail, status/type badges, icon-only configure button, enable switch) opening a **centered
config modal** with one field per row and icon-only footer actions (save / test / connect /
delete — all with tooltips and aria-labels). Providers split **Save** from **Set as preferred**
(preferred-for chips: chat/coding/everyday). External Agents expose the real ACP foundation
(connect/disconnect with live status + agent-reported capabilities); see
`docs/AI_INTEGRATIONS.md`.

The Atelier window has no pop-out button (the titlebar button is the single entry point) and no
meta chips or floating worker labels in normal mode — worker state lives in the **hover card**
(localized); Developer Mode shows floating debug labels plus active/approval counts + worker
queue chips. Workers follow the design system in `docs/YANSHI_ATELIER_WORKER_DESIGN.md` —
since the 2026-06-11 redesign they are the **Yanshi Puppets (偃师傀)**: authored 2D chibi art
(generated SVG, six role variants with mechanical puppet-ear fins + seal pin) rendered as
billboard standees in the 3D office and reused in the 2D fallback; expressions mirror real
runtime state (focused/panic/proud/sleepy…), decorative life states only when idle;
`prefers-reduced-motion` switches to static poses. **Atelier context follows the chat**: a
standalone chat resets to the global office; a chat in a Project inherits that project's office
state and agent team; opening a recent chat switches context to its project. The Library shows
real file names with the artifact title as secondary context, and Project/chat groups collapse
(state persisted locally).

All menus/popovers use one **viewport-safe placement layer** (`lib/menu-placement.ts` +
`lib/floating.tsx`): 12px collision padding, vertical flip when space below is insufficient,
horizontal shift/flip on edge overflow, max-height + internal scroll only after placement is
corrected. Applied to the composer "+" menu, the Add-to-Project flyout, account menu, project "…"
menu, and all right-click context menus (which also support arrow-key navigation).

## Errors

Every user-facing failure surfaces as a **red toast** (bottom-right, ~8s, stacking, manually
dismissible, `aria-live`) showing a stable error code (`YANSHI_<AREA>_<NNN>`) + a short
localized reason and, where useful, an Open Settings / Open logs action. Codes are documented
in `docs/ERROR_CATALOG.md`; unknown failures map to `YANSHI_UNKNOWN_001`. Structured detail
goes to the console/runtime logs (Developer Mode); normal mode never shows stack traces.

## macOS window close

The red close button always asks **退出偃师？/ Quit Yanshi?** (Cancel / Hide to menu bar /
Quit, plus an active-chat warning when runs are live). Quit pauses active chats and fully
terminates the app and the bundled sidecar — no orphan processes, no silent hide. Cmd+Q and
tray Quit use the same canonical full-quit path.

## Right-click context menus

`components/context-menu.tsx` (`useContextMenu`). Real actions only; impossible actions are either
omitted or disabled with a reason (e.g. task delete — the runtime has no run-delete API).
Current menus: sidebar project (Open / New task here / Open Atelier / Rename / Project settings /
Delete), sidebar recents (Open / Copy task text / Show in Library), Library items (Reveal in
Finder / Copy path / Copy summary / Show source task), Workshop packs (Enable–Disable / Export).

## Keyboard shortcuts

In-app commands with editable bindings (Settings → Keyboard Shortcuts); see
`docs/KEYBOARD_SHORTCUTS.md`. The ⌘Y show/hide shortcut stays OS-registered through Tauri.

## Motion & effects

CSS transform/opacity animations only: modal/menu pop, toggle slide, hover/press, composer focus
glow, running-status pulse. Fixed-placed panels animate **fade-only** so no transform overshoot
ever moves a box past the collision padding. `prefers-reduced-motion` is honored, and the
**GPU Acceleration** setting (Settings → Appearance) switches `data-fx` between `rich` (glow,
backdrop blur, full Atelier DPR + shadows) and `reduced` (no blur/glow, lower Atelier render
quality). It controls the app's visual-effect tier — not the OS GPU.

## Responsive strategy

The desktop window enforces a 960×680 minimum (`tauri.conf.json`), and the CSS floor matches.
Within real sizes: modals clamp to the viewport, the settings nav narrows ≤1000px, the right
Progress panel overlays the workspace below 860px (web/dev only), headlines/spacing compress at
low heights, and no surface scrolls horizontally. Sidebar and Progress panel are collapsible
(⌘B / ⌘J); the central workspace always keeps priority.
