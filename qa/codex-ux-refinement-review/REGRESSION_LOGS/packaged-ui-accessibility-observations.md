# Packaged UI Accessibility Observations

Date: 2026-06-10

## Initial Packaged Launch

- App: packaged `Yanshi.app`
- Runtime: bundled sidecar at `Contents/Resources/resources/yanshi-runtime-sidecar`
- Data dir: `qa/codex-ux-refinement-review/regression-packaged-home/Library/Application Support/com.yanshi.desktop`
- UI state: no `Event stream unavailable` text present.

## After First Run

- Created real run through packaged runtime API: `List workspace files`
- Runtime emitted run/artifact/agent events and completed the run.
- Computer Use accessibility tree showed `RECENTS` with `List workspace files`.
- No `Event stream unavailable` text was present.

## Reconnect Check

- Killed the bundled sidecar while packaged UI remained open.
- Restarted the same packaged sidecar binary manually on port `8765` with the same QA data dir.
- Created second real run: `List workspace files after reconnect`.
- Computer Use accessibility tree showed both:
  - `List workspace files after reconnect`
  - `List workspace files`
- No `Event stream unavailable` text was present.
