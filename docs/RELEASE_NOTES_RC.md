# Yanshi — Release Candidate Notes

- **Version:** 0.1.0 (RC)
- **Date:** 2026-06-09
- **Platform:** macOS (Apple Silicon, aarch64)
- **Status:** Final RC local build complete — public notarized release pending Apple Developer ID signing/notarization.

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
