# Yanshi — Spec Alignment Matrix

_Audit date 2026-06-13. Baseline: `docs/Yanshi_Product_Design_Spec.md` (original Codex build spec,
2220 lines). Overlaid with the **latest product decisions** (which override older terminology/IA),
then compared against the current repository implementation._

**Status legend:** PASS · PARTIAL · MISMATCH · DEFERRED (roadmap) · BLOCKED (external/human) ·
OBSOLETE (old spec superseded by a latest decision — **do not revert**).

**Headline:** the implementation already reflects **every** latest product decision. No P0/P1/P2
mismatches were found. Old-spec terminology survives only in the spec/data-model layer (internal)
and in four now-removed dead i18n keys. Verified by source inspection + a live web smoke
(sidebar terms, Atelier open/close/reopen, right panel, error toast, zh-CN 偃师 naming, dark mode).

| # | Area | Original spec | Latest override | Current implementation | Status | Action |
|---|---|---|---|---|---|---|
| 1 | App shell / macOS desktop | §5, §24 Tauri macOS shell, titlebar | white/black + mint; aligned titlebar | Tauri shell; traffic lights aligned to toolbar (`trafficLightPosition`); collapsible sidebar/panel | PASS | none |
| 2 | Runtime sidecar lifecycle | §5 start/stop with app, fail loud | — | Bundled sidecar; adopt-healthy / fail-loud port guard; process-group kill on quit (no orphan on :8765) | PASS | none |
| 3 | New Chat / composer | §9 "New Task", §10 composer | **New Chat / 新对话**; no Standalone option | `nav.newTask`="New Chat"; composer with +menu, compact config, honest voice state; no Standalone listed | PASS | none |
| 4 | Chat / conversation view | §11 "Run View" | **Chat** view; runs internal | Recents open a Claude-style conversation from real events; selected recent highlighted; honest "Start a new chat" | PASS | none |
| 5 | Right Progress panel | §16 mini-office in right panel | **contextual Progress/Files/Approvals/Agents** utility; Atelier is its own window | Panel sections = progress/files/approvals/agents (verified live); Files show real names | PASS | none |
| 6 | Search modal | §8 search | centered floating surface | `SearchModal` on shared `Modal` | PASS | none |
| 7 | Projects | §12 project pages/tabs | ChatGPT-style; secondary surfaces behind "…" | Project page = header + scoped composer + Tasks\|Files; Agents/Automations/Atelier/Activity/Settings behind "…" modals | PASS | none |
| 8 | Library / Files | §13 Runs page, §14 Artifacts page | **Library replaces Runs/Artifacts; Files/Outputs** | Top-level Library (Project→chat grouping, real names/paths, Web source, collapsible groups); no user-facing Runs/Artifacts | PASS / OBSOLETE | none |
| 9 | Yanshi Atelier | §16-17 "Live Office" | **Yanshi Atelier / 偃师工坊**, centered floating window | Centered modal; live canvas; reopen ×N (verified); single toolbar button; dev chips hidden in normal mode; chat-scoped state | PASS / OBSOLETE | none |
| 10 | Workers / stations / movement | §18-19 actors/behavior | fixed home stations, behavior-gated movement, no fake progress | `stations.ts` home-station assignment + occupancy guard + movement reasons; runtime-driven poses | PASS | none |
| 11 | Workshop | §15 packs/editors | centered floating window | Workshop modal: Installed / Agent Editor / Office Editor / Create-Export; pack validation; unsafe rejected | PASS | none |
| 12 | Settings | §25 settings | centered modal, fixed title, no profile metadata rows, toggles | Two-pane modal, fixed title + independent scroll; Profile (avatar/name, no metadata rows); toggles; nested-ESC stack | PASS | none |
| 13 | AI Integrations | §15-ish (provider settings) | compact rows + config modals; honest | Card rows + centered config modals; server-computed honest statuses | PASS | none |
| 14 | LLM Providers | §6/§25 provider | OpenAI-compatible real; native planned | Real OpenAI-compatible save/test; Anthropic/Gemini honestly "not implemented" | PASS | none |
| 15 | ACP External Agents | (not in original spec) | **foundation only**, described honestly | stdio launch + `initialize` handshake; honest lifecycle; live state never persisted as connected | PASS | DEFERRED (prompt/tool routing) |
| 16 | MCP Servers | (not in original spec) | config only; runtime client future | Config persists; status `not_implemented`/`not_configured`; tools never faked; no fake test button | PASS | DEFERRED (runtime client) |
| 17 | Skills | (not in original spec) | config/instruction layer, not plugins | Honest aggregation of agent instructions + Workshop packs; states it's not executable plugins | PASS | none |
| 18 | Browser tool | §11/§23 tools | honest missing-Chromium state | Real Playwright path; `playwright_browser_binaries` → `YANSHI_BROWSER_001` honest state | PASS | BLOCKED (Chromium provisioning) |
| 19 | Computer Use | §23 computer-use rules | honest permission-required | Token-auth localhost bridge (401 on bad token, token not logged); honest Accessibility/Screen states | PASS | BLOCKED (macOS grants) |
| 20 | Terminal / Docker | §11 tools | honest Docker state | Sandboxed exec with validated image/mem/cpu/pid; `YANSHI_DOCKER_001` honest state | PASS | none |
| 21 | File tool | §11 tools | — | Traversal-safe workspace read/list/scan; uploads copied in safely | PASS | none |
| 22 | Permissions / approvals | §23 approvals | honest bridge-unavailable state | Real interrupt/resume approvals; Permissions page shows "Desktop bridge unavailable" honestly | PASS | none |
| 23 | Automations | (light) | — | CRUD + run-now + interval scheduler; failures → `YANSHI_AUTOMATION_001` | PASS | none |
| 24 | Error toast system | §11 error handling | **app-wide red toasts, codes, ~8s, no inline dupes** | 24-code registry; bottom-right toasts; `YANSHI_PROVIDER_002` verified live (zh, assertive live region); inline reds removed | PASS | none |
| 25 | i18n en-US / zh-CN | §29 copy rules | zh product name **偃师** | Compile-time parity; sidebar 新对话/资料库/创意工坊; Atelier 偃师工坊 (verified live) | PASS | none |
| 26 | Theme / visual design | §20 **warm ivory** default | **white/black + mint-green glow** | `--background` #ffffff / #0d0f10; "No beige/ivory backgrounds"; mint accent | PASS / OBSOLETE | none |
| 27 | Right-click context menus | (light) | real actions only | `useContextMenu`; impossible actions disabled with reason | PASS | none |
| 28 | Keyboard shortcuts | §24 global shortcut | editable in-app + ⌘Y OS-registered | 17 editable commands; honest in-app conflict detection; ⌘Y system-registered | PASS | none |
| 29 | Developer Mode | §26 dev mode | raw detail in Dev mode only | Raw events, runtime details, debug labels; normal mode never shows stack traces | PASS | none |
| 30 | Docs site / GitHub Pages | (not in spec) | VitePress, base-path-safe, Pages workflow | `apps/docs` builds (default + `DOCS_BASE_PATH`); `.github/workflows/deploy-docs.yml` | PASS | none |
| 31 | README / public docs | (not in spec) | public-facing, honest, no QA tone/Junie | README rewritten (hero/badges/honest status); no Junie; links resolve | PASS | none |
| 32 | Build / release / signing | §6/§24 build | **public release pending signing/notarization** | `desktop:release` builds .app/.dmg with sidecar; unsigned/un-notarized | PARTIAL | BLOCKED (Apple Developer ID) |
| 33 | No-mock / secret safety | §0 core principle | honest states; keys never returned | apiKeyRef off-DB; key never returned/logged/in SQLite; honest tool/integration states throughout | PASS | none |

## Obsolete old-spec items (overridden — intentionally NOT reverted)

- §9 "New Task" → **New Chat** (`nav.newTask` value is "New Chat" / 新对话).
- §13 "Runs" page → **Library** (no user-facing Runs surface; runtime run records stay internal).
- §14 "Artifacts" first-class page → **Files / Outputs** (Library + right-panel Files).
- §16-17 "Live Office" → **Yanshi Atelier / 偃师工坊** (centered floating window).
- §20 warm-ivory default palette → **white / near-black + mint-green glow**.

## Internal terms that legitimately remain (not user-facing)

- Runtime schema / data model: `Run`, `Artifact`, `LiveOfficeState`, package name `live-office`,
  i18n namespaces `tasks.*` / `project.tab*` — these are internal identifiers (the latest
  decisions explicitly keep runtime run/artifact records internal). Not changed.

## Dead keys removed this pass

`nav.runs`, `project.tabRuns`, `project.tabArtifacts`, `progress.tabArtifacts` — 0 UI references
in either locale; removed from `en.ts` + `zh.ts` (i18n parity test green).

## Deferred (roadmap) and Blocked (external/human)

- **DEFERRED:** ACP prompt/tool/session routing; MCP runtime client + tool discovery; native
  Anthropic/Gemini adapters + multi-provider routing; chat continuation; richer Atelier
  sprite/Lottie/3D + pathfinding.
- **BLOCKED:** public release (Developer ID signing/notarization/stapling/Gatekeeper second
  machine); Browser Chromium provisioning; Computer Use macOS Accessibility/Screen Recording
  grants; real provider API key for live chats; packaged human interactive pass.
