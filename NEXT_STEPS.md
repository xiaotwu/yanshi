# Next Steps

_Updated 2026-06-13 (progress reconciliation). This file intentionally separates **current
task progress** from **human verification**, **external release blockers**, and **deferred
roadmap work**. Only current-task work should appear as checked task-list items; long-term
blockers use status tables so they do not show up as unfinished current Progress._

## Current Task Progress

- [x] GitHub Pages documentation site pass complete (`qa/docs-site-pass/DOCS_SITE_REPORT.md`).
- [x] Codex docs-site review complete (`qa/codex-docs-site-review/DOCS_SITE_REVIEW.md`).
- [x] README update pass complete (`qa/codex-readme-update/README_UPDATE_REPORT.md`).
- [x] Progress reconciliation pass complete (`qa/codex-progress-reconciliation/PROGRESS_RECONCILIATION_REPORT.md`).

## Current Product State

| Item | Status | Notes |
| --- | --- | --- |
| v0.1 Local Final Candidate | Complete | Ready for local final-candidate use; not a public notarized release. |
| Codex global validation | Complete | PASS WITH MINOR ISSUES; no active P0/P1/P2 product bugs. |
| Public docs site | Complete | VitePress site, base-path checks, docs review, and README instructions are complete. |
| README/docs reconciliation | Complete | README and QA reports reflect current app/docs state. |

## Human Verification / External Setup

These items are legitimate remaining release checks, but they are **not unfinished current
chat/task work** and should not be shown as active Progress.

| Item | Classification | Why it remains open |
| --- | --- | --- |
| Manual packaged-app pass by the user | External blocker / human verification | Requires user-visible macOS interaction and final product judgment. |
| Packaged titlebar traffic-light baseline glance | External blocker / human verification | Requires visual inspection of the packaged macOS window. |
| Native red close-button click path | External blocker / human verification | Programmatic native-button clicking requires permissions the agent does not have; packaged quit path is otherwise verified. |
| Reduced-motion visual check and dark Atelier brightness opinion | External blocker / human verification | Requires OS setting change and subjective visual acceptance. |
| macOS Accessibility + Screen Recording grants for Computer Use | External blocker | Requires user-granted macOS privacy permissions. |
| Browser Chromium provisioning and real Browser navigation | External setup | Requires Chromium installation/provisioning in the runtime environment. |
| Tray actions, notifications, global shortcut, close prompt, theme switch | External blocker / human verification | Requires interactive packaged-app checks on the user machine. |
| Real provider API key entry and live chat | External blocker | Requires a real user/provider credential; Yanshi must not ship or fake one. |

## Public Release Blockers

| Item | Classification | Required owner/action |
| --- | --- | --- |
| Developer ID signing | External blocker | Apple Developer ID Application certificate. |
| Notarization + stapling | External blocker | Apple notarization credentials and successful notarization. |
| Gatekeeper verification on a second Mac | External blocker / human verification | Clean-machine acceptance check after signing/notarization. |

## Deferred Roadmap

These are honest future features, not v0.1 current-progress tasks.

| Item | Classification | Notes |
| --- | --- | --- |
| ACP prompt/session routing | Deferred roadmap | Foundation exists: stdio launch + initialize handshake. |
| MCP runtime client and tool discovery | Deferred roadmap | Config persistence exists; tools are never faked. |
| Multi-provider registry and native Anthropic/Gemini adapters | Deferred roadmap | OpenAI-compatible path exists today. |
| Per-action/per-run provider routing | Deferred roadmap | Preferences persist; runtime still uses the saved provider config. |
| Chat continuation | Deferred roadmap | Finished runs reopen as history; follow-up turns on an existing run are future. |
| Richer Atelier animation/3D/pathfinding | Deferred roadmap | Current generated SVG standees and fallback are real. |
| First-class skill format | Deferred roadmap | Current skills are instructions/configuration, not executable plugins. |
| Library delete / chat rename / recents title summarization | Deferred roadmap | Needs runtime/API/provider-backed work. |
| Profile avatar image upload | Deferred roadmap | Requires validated file-path/image handling. |
| Tech debt: FastAPI lifespan, Vite chunking, Starlette deprecation, settings spec alignment | Deferred roadmap | Non-blocking for v0.1 local final candidate. |

## Workflow

- **Claude Code** implements design, feature, and bug-fix work.
- **Codex** validates independently, reconciles status, and performs regression QA.
- **The user** makes final product/release decisions and performs human-only verification.
- **Junie** is archived/historical and is not part of the active workflow.
