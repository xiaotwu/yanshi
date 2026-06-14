# Acceptance Checklist

_Updated 2026-06-13: **Yanshi v0.1 Local Final Candidate — FROZEN.** Codex global validation
returned PASS WITH MINOR ISSUES with **no active P0/P1/P2** (qa/codex-global-review/): error
toast system accepted, packaged smoke passed, no-mock + secret audits passed. Ready for local
final-candidate use; **not yet a public notarized release** — remaining blockers are
codesign/notarization/Gatekeeper and manual macOS permission grants. Sections: Passed · Needs
human verification · Blocked by external requirements · Deferred to later version · Archived
historical. Workflow: Claude Code implements, Codex validates; Junie reports are archived.
Progress reconciliation note (2026-06-13): active current-task progress lives in NEXT_STEPS.md
and should only contain completed task-list items for the current pass; human/external/deferred
items below are status categories, not unfinished current Progress._

## Passed (real, automated- or smoke-verified; no mocks)

- Packaged app: `.app`/`.dmg` build with bundled standalone sidecar; launch, health, clean quit,
  no orphan sidecar; adopt-healthy / fail-loud port guard.
- Runtime: REST + WebSocket (+ polling fallback), SQLite persistence, LangGraph runs,
  Action/Observation model, approvals interrupt/resume, multi-agent queue, reasoning levels,
  agent personas (prompt-injection-separated).
- Tools: File, Browser (Playwright; honest missing-Chromium state), Computer (bridge with
  bearer token; honest permission states), Terminal/Docker (validated settings, real smoke).
- Provider: OpenAI-compatible save/test; key in off-DB secret store — never in
  SQLite/responses/logs/events (re-audited 2026-06-11). Anthropic/Gemini honestly unimplemented.
- ACP foundation: real stdio launch + initialize handshake + live capabilities + honest
  lifecycle; connect/disconnect endpoints; live state never persisted. MCP: honest config-only.
- Chat-first UX: New Chat/Recents, conversation view from real events, Library + right-panel
  Files with real file names, collapsible persisted groups, project pages, Search, Workshop,
  Automations, Approvals.
- Settings: fixed-title two-pane layout, Profile (local identity), card+modal AI integrations,
  Save vs Set-as-preferred split, modal-stack ESC (one layer per ESC), honest Permissions
  bridge state, editable shortcuts with capture/conflict safety, GPU tier setting.
- Yanshi Atelier / 偃师工坊: six distinct chibi workers (design system doc), real-state poses,
  desk scenes, localized hover cards, Developer-only debug labels, reduced-motion static mode,
  WebGL fallback + retry, reopen-bug fixed (context leak), chat-scoped office context.
- i18n en-US/zh-CN compile-time parity; zh naming unified to 偃师/偃师工坊; locale-aware
  notifications. Light/Dark/System themes.
- Suites: pytest 79 · vitest 34 · cargo 11 · lint/typecheck/build · desktop:release.
- Public docs site: VitePress in `apps/docs/`, GitHub Pages workflow, configurable repository
  base path, public product/docs homepage, honest status language, `pnpm docs:build` green,
  simulated `/new-repo-name/` base-path build green, desktop/mobile preview smoke green.

## Needs human verification (honest states shipped; user machine required)

- Packaged titlebar traffic-light baseline glance; reduced-motion eyeball; dark Atelier
  brightness opinion.
- Computer Use click/type/shortcut/screenshot after Accessibility + Screen Recording grants.
- Real Browser navigation after `playwright install chromium`.
- Tray / notifications / ⌘Y / close-prompt / theme switch interactive pass in the packaged app.
- Live chat with a real provider API key.

## Blocked by external requirements

- Codesign (Developer ID) + notarization + staple + Gatekeeper second-machine verification.

## Deferred to later version (tracked in NEXT_STEPS.md; never stubbed)

- ACP prompt/session routing; MCP runtime client; multi-provider registry + native adapters;
  chat continuation; richer Atelier assets (GLB/Lottie, pathfinding); skill format; Library
  delete / rename APIs; avatar image upload; lifespan/chunking tech debt.

## Archived historical (pass-by-pass log; issues below are resolved or superseded)

## ✅ Global error-display cleanup (2026-06-12)

- All duplicate inline red error text removed from normal mode (composer store-error/upload,
  Library load, Automations, Workshop import/export, Shortcuts global-failure paragraph,
  ACP lastError + Provider health paragraphs -> badge + muted detail); Project Files gained a
  neutral retry state + YANSHI_FILE_002 toast; Workshop export now toasts.
- Kept: form-validation hints, chat-content failures, Developer diagnostics, honest setup badges.
- Smoke: runtime kill -> single RUNTIME_002 transition toast, zero inline reds, clean recovery
  (no stale text/toast); provider failure -> toast + badge + muted detail; zh-CN verified.
- Suite: pytest 79 / vitest 41+10 / cargo 11 / lint / build / desktop:release.
  Evidence: qa/claude-error-toast-cleanup/.

## ✅ Close-behavior + station-behavior + error-toast pass (2026-06-12)

- App-wide error toasts: 24-code registry (YANSHI_<AREA>_<NNN>), red bottom-right toasts ~8s
  with code + localized reason + Open Settings/logs actions; dedupe, stack cap, aria-live,
  Escape/manual dismiss; wired across store/stream/events/UI boundaries; docs/ERROR_CATALOG.md;
  7 unit tests; live-verified with a real provider failure in zh-CN (incl. topmost-above-modal
  and 8s expiry).
- macOS close: red close button always prompts (退出偃师？ Cancel/Hide-to-menu-bar/Quit, active-
  chat warning); Quit pauses chats then fully terminates app + sidecar; packaged quit verified
  orphan-free (human click of the native button still pending).
- Worker stations: stations.ts module — one owner per home station, task states pin home,
  movement-reason gating, occupancy guard (foreign-home rejection + per-worker shared-area
  slots), project/standalone scoping preserved; 10 unit tests; visual smoke shows all six
  puppets at their own desks.
- Suite: pytest 79 / vitest 41 + 10 / cargo 11 / lint / build / desktop:release.
  Evidence: qa/claude-close-station-pass/.

## ✅ Yanshi Puppets worker redesign (2026-06-11)

- New worker visual identity: authored 2D chibi SVG art (Endfield-adjacent mood, original to
  Yanshi — puppet-ear fins + red mechanism-seal pin), one master design + six unified role
  variants (Manager antenna/board · Reviewer monocle/stamp · Browser twin fins/compass ·
  Computer headset/cursor · File hairpin/folder · Terminal hood/console) × six runtime-driven
  expressions (content/focused/sleepy/panic/proud/slack); 36 combinations proofed on a grid.
- Integration: generated SVGs rasterized to cached billboard standee sprites in the 3D office
  (alpha-tested depth vs. desks, toneMapped off for palette fidelity, sway/bob motion,
  reduced-motion static); same art as img chips in the 2D fallback; hover raycast + localized
  cards verified; light + dark verified.
- Honesty: registry assetType "svg" (generated/embedded, path null); no animation or 3D
  modelling claimed; expressions from real runtime state only.
- Suite: pytest 79 / vitest 34 / cargo 11 / lint / build / desktop:release; packaged launch
  (healthy 4s) + clean quit. Evidence: qa/atelier-worker-redesign-pass/.

## ✅ Worker Character Design System pass (2026-06-11)

- Design spec created: docs/YANSHI_ATELIER_WORKER_DESIGN.md (product role, principles, anatomy,
  6 archetypes with poses, state catalog, runtime mapping + precedence, asset architecture,
  fallback rules, Workshop integration — future work clearly separated).
- Six distinct procedural chibi roles implemented (antenna/monocle/visor/headset/cap/beanie +
  per-role palettes); pose variants for working/blocked/waiting/done/sleepy; desk scenes.
- Normal mode tooltip-only (floating labels removed; hover cards localized en/zh — verified all
  6 workers in zh-CN); Developer Mode debug labels + meta chips verified.
- prefers-reduced-motion → static poses + demand frameloop (human eyeball check pending);
  GPU setting still gates DPR/shadows; WebGL-failure 2D fallback (localized) intact.
- WorkerCharacterAsset registry all-procedural (honest; no fake asset claims); assets/workers/
  README documents the future layout.
- Suite: pytest 79 / vitest 34 / cargo 11 / lint / build / desktop:release; packaged launch +
  clean quit; reopen cycles re-verified. Evidence: qa/atelier-worker-design-pass/.

## ✅ UI/UX + naming + Atelier reliability refinement (2026-06-11)

- Atelier reopen bug FIXED: WebGL-probe context leak (new context per render, never released,
  WKWebView cap exhaustion) — probe cached + released, canvas context freed on close; verified
  6/6 reopen cycles, project↔standalone switches, packaged relaunch.
- First-pass chibi worker design: 3-archetype design system (Coordinator/Scout/Maker) in
  characters.ts driving procedural chibi figures (sleepy/focused eyes, accent scarf, blush) at
  per-station mini desks; CSS face chips in the simplified view; honest scope — GLB/animation
  future (registry slots still null, never faked).
- zh-CN naming unified to 偃师 (`brand` key: account block, profile preview, chat authors, ACP
  copy, locale-aware notification titles); en unchanged.
- Profile page: metadata rows (workspace/version/runtime) removed — identity-only.
- ACP/MCP add buttons icon-only with tooltip + aria-label.
- Titlebar: trafficLightPosition {14,14} geometry-correct; packaged pixel check = human glance
  (agent env lacks screen-capture grant).
- Suite: pytest 79 / vitest 34 / cargo 11 / lint / build / desktop:release; evidence in
  qa/atelier-refinement-pass/.

## ✅ Junie global-acceptance fix pass (2026-06-11)

- BUG-01 (P1): right-panel Files shows real file names (basename primary; artifact title + path
  secondary; shared `outputFileName` helper + 5 unit assertions; Library refactored onto the
  same helper, behavior preserved).
- BUG-02 (P2): modal stack (`lib/modal-stack.ts`) — ESC closes only the topmost dialog; verified
  for provider + ACP config modals (ESC #1 child only, focus restored to trigger; ESC #2
  Settings); backdrop nesting re-verified; unit tests for stack semantics.
- BUG-05 (P2): Permissions page shows "System permissions — Desktop bridge unavailable /
  系统权限 — 桌面桥接不可用" with hint when the Tauri bridge is absent; packaged badge path
  unchanged; en/zh verified.
- P3 deferred (lifespan/chunking, spec divergence, recents titles) → NEXT_STEPS.
- Suite: pytest 79 / vitest 34 / cargo 11 / lint / build / desktop:release; packaged launch +
  clean quit. (Historical Junie evidence directory removed in repository cleanup.)

## ✅ Manual UI/UX + Settings + ACP refinement pass (2026-06-11)

- Settings: "设置" title fixed (nav column header) while the section list and content scroll
  independently; verified en/zh at 960×680 and 1200×818 with no horizontal overflow; content
  column 680px calm / full width on dense pages.
- Profile: editable display name, emoji/preset avatar + background swatches, workspace label —
  persisted in `AppSettings.profile`, shown in the account block. Honest copy: local workspace
  identity, no account/login/subscription. (Race-safe: optimistic settings merge so name + avatar
  edits in quick succession both persist — verified live.)
- LLM Providers: compact card rows (status/local-cloud/preferred badges + icon-only configure) +
  centered config modal (capability badges, one field per row, icon-only Test/Save). **Save and
  Set-as-preferred are split**; preferred-for chips (chat/coding/everyday) persist in
  `preferredActions`. Real save/test flow preserved; secret audit re-verified (raw key absent
  from SQLite + runtime log).
- **ACP foundation (real):** `acp.py` stdio JSON-RPC client — launch, `initialize` handshake,
  capability flattening, lifecycle configured/starting/connected/error(+lastError), no
  persistence of live state, processes killed on disconnect/removal/shutdown. Connect/disconnect
  endpoints + UI (plug/unplug icons). Verified against a real ACP-speaking fixture process in
  pytest and in the live UI (Connected badge + agent-reported capabilities). Prompts/tools not
  routed — stated in-app; endpoint/custom stay `not_implemented`.
- MCP + Skills: same card + modal pattern; MCP honest statuses unchanged (no fake test button);
  Skills detail modal (source/version/applies-to/instructions preview) with real pack
  enable/disable.
- Permissions: icon-only refresh (aria-label + tooltip), permission states as status badges.
- Shortcuts: full-width panel, icon-only reset-all; capture/conflict behavior re-verified
  (Cmd+K during capture does not open Search).
- Atelier: pop-out button removed; meta counts + agent chips Developer-only; modal near
  full-window (1180×840 max); blank-render root cause fixed — drei `<Environment>` preset (network
  HDR fetch that suspends the scene offline/packaged) replaced with a local hemisphere light.
  State lifecycle: standalone chat resets to the global office, project chat inherits the
  project's office/team, opening a recent chat switches context accordingly.
- Library: real file names (e.g. `latest-file-scan.json`) with artifact title as secondary
  context; collapsible Project/chat/workspace-file groups persisted in localStorage; Web source
  link, sorting/filtering intact.
- Titlebar: `trafficLightPosition {x:14, y:14}` centers macOS traffic lights on the same baseline
  as the titlebar buttons (40px bar, buttons centered at y=20).
- i18n en/zh for all new strings (compile-time parity); suite green: pytest 79 / JS 29 / cargo 11 /
  lint / typecheck / build; UI smoke screenshots in qa/manual-uiux-acp-pass/.

## ✅ Manual UI bugfix + conversation UX pass (2026-06-11)

- Atelier white screen fixed: root + Atelier error boundaries, WebGL pre-check, fallback with
  retry/simplified real worker list (verified by simulated WebGL failure; app survives, close works).
- Chat IA: Recents open a Claude-style conversation (bubble/blocks/cards from real events); Task→Chat
  user-facing terminology (en/zh); selected recent highlighted; no fake chat continuation.
- Right panel simplified: dropdown selector, no duplicate title/close/Atelier buttons; outputs under
  Files with Web source links; user-facing Artifacts removed app-wide (Library "By Project / All files",
  search filter "Outputs", project "…" menu without Artifacts); runtime artifact data untouched.
- Workshop is a centered floating window (tabs in header, roomier layout, functionality intact).
- New Project modal rebuilt: inline pickers, white default icon background, custom color, honest
  duplicate hint, in-modal error display; ProjectGlyph chips consistent in sidebar/search/menus.
- Settings redesigned: Personal / Workspace / AI / Tools / System / Developer, calm 560px content
  column, no per-row dividers, no About/Help; account menu updated.
- Search input focus is a subtle accent treatment (no hard green rectangle); a11y preserved.
- Suite green (pnpm 29 / pytest 76 / cargo 11 / lint / typecheck / build / desktop:release); live
  smoke evidence qa/ux-refinement-pass/fix2-chat-view.png.

## ✅ Product UX Architecture Refinement (2026-06-10)

- Projects: lightweight selector (Projects label) + ChatGPT-style project page (header + "…" menu,
  project-scoped composer, Tasks|Files pills, specced empty state); Agents/Automations/Artifacts/
  Atelier/Activity/Settings behind "…" as centered modals; project settings modal edits
  name/icon/color/description/context-mode; duplicate/trim/empty name handling.
- IA: top-level **Library (资料库)** replaces Runs (Project → task grouping, standalone section,
  all-files/all-artifacts views, newest/oldest/name/size/type sort, open/reveal/copy-path —
  no fake delete); task details (Hybrid Transcript + Developer raw events) reachable from
  Recents/project tasks/Library.
- Add-to-Project lists projects only (+ New project…, + Remove-from-Project while selected);
  no "Standalone" row.
- All major surfaces are centered floating modals via shared `Modal` (focus trap, ESC-on-window,
  backdrop close, clamped sizes, internal scroll, open animation): Search, Settings, New Project,
  project panels, Atelier (+ pop-out), integration dialogs.
- Viewport-safe floating layer (`placeFloatingPanel`/`useFloatingPanel`) for account menu, "…"
  menus, context menus; composer "+"/flyout already covered; fixed panels animate fade-only so
  animation never violates collision padding.
- AI Integrations settings group: External Agents (ACP) + MCP Servers persisted via
  `/settings/integrations` with **server-computed honest statuses** (`not_implemented` /
  `not_configured`; tools/capabilities never faked — pytest-enforced); Skills = real config
  aggregation (agent instructions + packs, honest copy); LLM Providers as expandable rows
  (status/local-cloud/capability badges) preserving the real OpenAI-compatible save/test.
- Toggle switches replace all checkboxes (settings, packs, automations) — keyboard operable,
  role=switch, green glow.
- Keyboard shortcuts: 16 editable in-app commands (defaults in lib/shortcuts.ts; overrides in
  AppSettings.shortcuts), settings editor (edit/clear/reset/search/categories), reliable in-app
  conflict detection + honest OS-conflict warning; ⌘Y stays OS-registered.
- Right-click context menus (projects, recents, library items, workshop packs) — real actions
  only; unsupported actions disabled with reason.
- GPU Acceleration setting → `data-fx` rich/reduced (glow/blur/animation tier) + Atelier
  DPR/shadows (`lowPower`); honest copy; WebGL info in Developer runtime section.
- Animations: modal/menu pop, switch slide, hover/press, composer focus glow, running pulse;
  `prefers-reduced-motion` honored.
- i18n: all new surfaces en-US + zh-CN (compile-time parity); verified zh-CN dark visually.
- Verified by UI smoke (vite + isolated runtime): project task creation→completion on the project
  page, Library shows real artifact + workspace file, MCP config persists with honest status,
  provider rows expand with real form, shortcut edit→conflict→reset→live ⌘⇧L navigation,
  GPU toggle flips fx tier live, ESC/centering on all modals, containment at 1200×818 and
  960×680 (the real window minimum).

## ✅ Product-detail polish pass (2026-06-10)

- Visual consistency: last beige remnant removed (dead `.office-full-view` CSS deleted along with
  legacy `.live-office` blocks and the duplicate early `.app-shell` grid); tokenized theme intact.
- Keyboard focus baseline: accent `:focus-visible` ring on all interactive controls (buttons, nav,
  menu rows, list rows, inputs/selects); composer keeps its container glow.
- i18n: normal-mode sweep complete — task detail (groupings, plan, working/result/stopped, approval
  card, artifact cards, "Details"), Automations, Workshop Agent Editor, Artifacts/Approvals,
  composer upload error (~30 en/zh keys; compile-time parity). English by design: Developer raw
  traces, runtime-produced content, agent product names.
- Settings nav: spec order Personal / Tools / AI Integrations / Shortcuts / Developer (no About).
- Motion: sidebar collapse/expand animates (grid-column transition, contents fade, `inert` when
  collapsed); right Progress panel slides in; one-shot success pulse on completed results
  (fx-rich tier); all transform/opacity, `prefers-reduced-motion` honored.
- Layout: task-list grouping pills wrap instead of clipping; smoke at 960×680 / 1200×818 /
  1440×900 in zh-CN dark — no overflow, modals contained, Progress panel leaves 868px main at 1440.
- Suite: pnpm test 29 / pytest 76 / cargo 11 / lint / typecheck / build / desktop:release.

## ✅ Codex QA regression fixes (2026-06-09)

- Runtime lifecycle: sidecar killed by process-group on every quit path → **no orphan on :8765**
  (verified packaged); startup adopts a healthy runtime or fails loudly on port conflict (no stuck runs).
- Project Agents tab added; project tabs horizontal-scroll (no wrap); project Context shown.
- Workshop fully localized (zh-CN verified, no English leak).
- Atelier worker labels bound to the active run only (no stale/mixed terminal states).
- Approval API accepts `deny`/`approve` aliases.
- Add-to-project menu + search modal contained/scrolled. Codex R1 re-fix: viewport-aware placement
  (`lib/menu-placement.ts`) — "+" menu flips upward when space below is insufficient; submenu is an
  independently placed flyout (vertical shift + horizontal flip); verified contained at 1200×818
  and 1200×600.
- First real JS test suite (vitest, 15 tests incl. 7 menu-placement). pytest 74 / cargo 11.

## ✅ Packaged verification baseline (2026-06-09, RC build)

- App/Runtime: `.app` launch, `mode=bundled-sidecar`, health, clean-env launch (no repo/uv dep), logs accessible.
- Provider/Secrets: settings save/load; settings/SQLite/events/runtime-log contain **no** raw API key.
- Project/Runs: create project, project-scoped run, standalone run, Hybrid-Transcript events.
- Multi-agent: Manager plan + persisted agent_tasks; File assignment executes; no fake activity.
- File upload: copied into workspace, traversal-safe path, scannable by File Agent.
- **Docker (real, daemon up):** approved command completed, stdout captured, settings applied
  (image/memory/cpus/pids), terminal log artifact created.
- Computer Use: `open-app` works through the bridge; bridge rejects no/bad token → 401; token not logged.
- Approvals: request (direct path), persist/visible, deny stops honestly, approve resumes.
- Workshop: export → re-import (`Yanshi Team Export`); unsafe pack rejected (400); Agent Editor save;
  Office Editor furniture persist + export includes furniture.
- Live Office: AgentInstance + AgentActor3D persist (≥6 each).
- Automations: create + Run now + run history persists.
- Browser: honest `playwright_browser_binaries` missing-dependency state (no fake success).
