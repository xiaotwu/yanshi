# Functional Issues

## Summary

Status: FAIL

The core runtime can work after a clean relaunch, but the product still has release-blocking functional issues and unverified paths.

## Functional Findings

### F1. Duplicate/stale runtime processes can break execution

Status: FAIL
Severity: P1
Evidence:
- `LOGS/pre-clean-relaunch-processes.txt`
- `LOGS/phase9-runtime-log-after-ui-run-tail.log`
- `LOGS/api-runs-after-ui-run.json`
- `LOGS/api-events-stuck-ui-run.json`

Observed:
- Runs created during stale sidecar state stayed at `created`.
- Clean relaunch fixed the path and produced completed runs.
- Quitting the packaged app left the runtime sidecar orphaned and still listening on port 8765 until manual termination.

Required fix:
- Make runtime ownership/relaunch idempotent.
- Detect incompatible existing runtime and fail loudly.
- Cleanly terminate or supervise the sidecar when the desktop app quits.
- Add watchdog/recovery for stuck `created` runs.

### F2. Browser Agent cannot execute in packaged app

Status: BLOCKED
Severity: P1
Evidence:
- `LOGS/api-clean-runs-after-browser.json`

Observed:
- Browser run failed because Chromium binaries were not installed/bundled.

Required fix:
- Bundle Chromium, run `playwright install chromium` during sidecar packaging, or add first-run provisioning.

### F3. Computer Use action path blocked by permissions

Status: BLOCKED
Severity: P1
Evidence:
- `LOGS/api-clean-runs-after-computer-click.json`

Observed:
- Computer open-app passed.
- Click/action path failed for missing Accessibility permission.

Required fix:
- Build a permission preflight and retry flow.

### F4. Provider runtime support incomplete

Status: FAIL
Severity: P1
Evidence:
- `SCREENSHOTS/phase16-providers.png`
- `LOGS/playwright-providers-snapshot.md`

Observed:
- Single stored provider config is available.
- Anthropic and Gemini are not implemented.
- No verified real provider health pass occurred during QA.

Required fix:
- Implement provider registry, health checks, default selection, model selection, and honest unavailable states.

### F5. Approval decision schema rejects intuitive `deny`

Status: FAIL
Severity: P2
Evidence:
- `LOGS/api-deny-approval.json`
- `LOGS/api-denied-approval-valid.json`

Observed:
- API rejected `decision:"deny"` with 422.
- API accepted `decision:"denied"`.

Required fix:
- Either support common aliases like `deny`/`approve`, or make API/UI contract explicit and tested.

### F6. JavaScript tests are effectively absent

Status: FAIL
Severity: P2
Evidence:
- `LOGS/phase1-04-pnpm-test.log`

Observed:
- `pnpm test` passed with no tests.

Required fix:
- Add meaningful tests for runtime client, settings, project creation, search, menus, provider form, and critical UI state.

### F7. Workshop import/export not functionally verified

Status: NOT TESTED
Severity: P1
Evidence:
- Workshop UI screenshot and snapshot only.

Required verification:
- Import valid pack.
- Reject invalid/traversal/executable/symlink pack.
- Enable/disable installed pack.
- Export and reimport a pack.

### F8. Packaged app macOS window shell behaviors not verified

Status: BLOCKED
Severity: P2
Evidence:
- `SCREENSHOTS/phase2-yanshi-first-launch.png`
- `SCREENSHOTS/phase2-yanshi-window-raised.png`
- `SCREENSHOTS/phase2-yanshi-exposed.png`

Observed:
- macOS automation repeatedly captured Codex instead of the Yanshi window.

Required verification:
- Human or stronger desktop automation should verify packaged window focus, traffic lights, titlebar hit areas, close behavior, tray/menu, notifications, and global shortcut.

## Functional Passes

- Status: PASS - Clean runtime health endpoint returned OK.
- Status: PASS - Clean packaged launch used bundled sidecar.
- Status: PASS - File Agent run completed and persisted artifacts.
- Status: PASS - Event stream was produced for a clean run.
- Status: PASS - Approval request and denial flow worked.
- Status: PASS - Docker sandbox command completed.
- Status: PASS - SQLite persistence held projects, runs, settings, approvals, artifacts.
- Status: PASS - Theme/language settings persisted and were restored.
