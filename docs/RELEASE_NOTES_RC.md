# Yanshi — Release Candidate Notes

> **Status update (2026-06-12): Yanshi v0.1 Local Final Candidate — FROZEN.** Codex global
> validation passed (PASS WITH MINOR ISSUES, no active P0/P1/P2; qa/codex-global-review/).
> Ready for local final-candidate use on the build machine. **Not yet a public notarized
> release** — remaining blockers: Developer ID codesign, notarization + stapling, Gatekeeper
> second-machine verification, and manual macOS permission grants (Accessibility / Screen
> Recording) for Computer Use. See CURRENT_STATUS.md for the live snapshot; the RC record
> below is kept for history.

- **Version:** 0.1.0 (RC → Local Final Candidate, frozen 2026-06-12)
- **Date:** 2026-06-09 (RC); refinements through 2026-06-11
- **Platform:** macOS (Apple Silicon, aarch64)
- **Status:** Final-candidate local build complete — public notarized release pending Apple Developer ID signing/notarization.

## What Yanshi is

A macOS-first AI Agent desktop workspace with animated virtual workers. A Tauri shell hosts a
React UI and bundles a standalone Python "Yanshi Runtime" sidecar (LangGraph + Action/Observation
model, SQLite, REST + WebSocket). Multiple agents plan, execute real tools, and visualize work in a
2.5D/3D Live Office.

## Major features in this RC

- Bundled standalone runtime sidecar — packaged app launches `mode=bundled-sidecar` with no
  uv/repo/venv dependency.
- Multi-agent execution (Manager, Browser, Computer, File, Reviewer, Terminal) with persisted
  agent_tasks, queue, approval interrupt/resume, and reasoning levels.
- Real tools: File, Browser (Playwright), Computer Use (screenshot + click/type/shortcut/open-app
  via a token-auth localhost bridge), Terminal/Docker sandbox.
- AgentProfile personas injected into execution (advisory, prompt-injection-separated).
- Projects (tabbed workspace), Runs (Hybrid Transcript), Search, Artifacts (+ Reveal in Finder),
  Automations (with interval scheduler), file upload.
- Workshop: install/enable/disable + Agent Editor + visual 2D Office Editor (stations, areas,
  draggable furniture) + Create/Export (re-importable pack).
- Live Office: Q-style mechanical workers, role props, hover cards, queue bubbles, fatigue,
  behavior modes, status green glow; persisted AgentInstance/AgentActor3D; mini/full/pop-out;
  project-scoped state surviving restart.
- macOS: tray/menu, notifications, global shortcut, close-with-active-runs prompt.
- System/Light/Dark theme (tokenized, mint-green accent, no beige); secure provider key storage
  (`apiKeyRef` + off-DB secret store; never in responses/logs/events).

## Post-RC refinement (2026-06-11)

- **ACP foundation (real):** External Agents can launch over stdio and complete the Agent Client
  Protocol `initialize` handshake; live status (configured/starting/connected/error) and
  agent-reported capabilities, never persisted as connected. Prompts/tools not routed yet —
  stated in-app ("ACP foundation", not "ACP complete").
- Settings rework: fixed title + independent scroll panes, wider content, Profile (display name +
  emoji avatar, local identity only), card+modal AI-integration sections, split Save vs
  Set-as-preferred with preferred-for chips, icon-only actions throughout.
- Atelier: blank-render fix (no more network HDR dependency), near-full-window modal, no pop-out
  duplicate, dev-only meta, chat-scoped office context.
- Library real file names + collapsible persisted groups; macOS traffic-light baseline alignment.
- Suite: pytest 79 / vitest 29 / cargo 11; packaged `.app` re-built and launch/quit re-verified.

## Verification status (2026-06-09)

Automated: `pnpm lint/typecheck/test/build` green; `pytest` 73 passed; `cargo test` 10 passed.

Packaged app QA (this machine): bundled-sidecar launch, health, clean-env launch, project/standalone
runs, multi-agent plan, file upload (+ traversal/size safety), **Docker command smoke (real, daemon
up)**, Computer `open-app`, bridge 401 + no token in logs, approvals (request/persist/deny/resume),
Workshop export/re-import + unsafe-pack rejection, Agent Editor save, Office Editor furniture
persist + export, AgentInstance/AgentActor3D persistence, automations run + history, secret audit
(no API key in settings/SQLite/events/logs). Browser shows the honest `playwright_browser_binaries`
missing-dependency state in the packaged sidecar.

## Known limitations

- **Computer `click`/`type`/`shortcut`/`screenshot`**: require a one-time macOS Accessibility /
  Screen Recording grant to `Yanshi.app`; not grantable in this CI environment. The honest
  permission-required state is verified; `open-app` (no permission needed) is verified working.
- **Browser**: packaged sidecar lacks Chromium binaries → honest missing-dependency state
  (`playwright install chromium` enables it).
- **Tray / notifications / global shortcuts / close-prompt / theme switch**: functional in dev;
  need a human interactive pass in the packaged app.
- Office Editor has no path/collision editing or agent pathfinding yet; workers are procedural
  (no modelled art assets).
- **Not codesigned or notarized** — Gatekeeper will warn on another Mac.

## Install / run

- Local (unsigned): open `Yanshi.app`. On first launch, right-click → Open to bypass Gatekeeper,
  or `xattr -dr com.apple.quarantine Yanshi.app`.
- Build: `pnpm desktop:release` → `apps/desktop/src-tauri/target/release/bundle/macos/Yanshi.app`
  and `.../dmg/Yanshi_0.1.0_aarch64.dmg`.

## Signing / notarization (pending)

No Apple Developer ID Application certificate is available in this environment, so the build is
unsigned/un-notarized. Steps to complete a public release are in `docs/BUILD_AND_RELEASE.md`
(Codesign & Notarization + Public Distribution Checklist).

## Codex QA regression fixes (2026-06-09)

Runtime sidecar lifecycle hardened (no orphaned process on quit; adopt-healthy / fail-loud port guard,
verified in the packaged app). Project Agents tab + Workshop zh-CN localization + Atelier active-run
worker labels + approval `deny`/`approve` aliases + menu/modal containment + first JS test suite.
Tests: pnpm 8, pytest 74, cargo 11. Still pending for public release: codesign/notarization, Browser
Chromium provisioning, Computer-Use permission grants, and a human packaged interactive pass. Replace
the provider API key in Settings before real model use. See qa/codex-final-product-audit/CLAUDE_FIX_RESULTS.md.

## Product UX Architecture Refinement (2026-06-10)

- **Projects, ChatGPT-style:** selecting a project opens a focused page — icon/name header with a
  "…" menu, a project-scoped composer ("New task in …"), and Tasks | Files pills. Agents,
  Automations, Artifacts, Atelier, Activity, and Project settings moved behind the "…" menu as
  centered windows. Clicking "Projects" opens a light selector (New Project + filterable list).
- **Library replaces the Runs page:** files and artifacts across Projects and standalone tasks,
  grouped Project → task, with all-files/all-artifacts views and sorting. Task details (incl.
  Hybrid Transcript) open from Recents, project task lists, and Library.
- **AI Integrations settings (AI 集成):** External Agents (ACP) and MCP Servers can be configured
  and saved — statuses are honest (`Not implemented yet`; no fake connections or tool lists);
  Skills lists real agent instructions + Workshop packs; LLM Providers is a Zed-style expandable
  list preserving the real OpenAI-compatible configure/test flow.
- **Interaction polish:** all major surfaces are centered floating windows (ESC, focus trap,
  clamped to the window); every menu/popover is viewport-collision-safe; checkboxes became toggle
  switches; right-click context menus (real actions only); editable keyboard shortcuts with
  in-app conflict detection (⌘Y stays system-registered); GPU Acceleration setting controls the
  visual-effect tier + Atelier render quality; subtle motion throughout honoring reduced-motion;
  Add to Project no longer lists "Standalone".
- Tests: pnpm 24, pytest 76, cargo 11. en-US/zh-CN updated for all new UI.
