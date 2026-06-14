# Yanshi Regression QA Report

Audit time: 2026-06-09 21:57-22:14 PDT
Scope: P0/P1 fixes plus touched flows from `qa/codex-final-product-audit/CLAUDE_FIX_RESULTS.md`
Constraint followed: no product source code was modified. QA evidence/scripts were written under this regression folder only.

## Verdict

Status: FAIL

Most P0/P1 regressions passed, including packaged runtime lifecycle, Workshop localization/import validation, Projects context/Agents tab, Atelier stale-state cleanup, and provider honesty. The regression is not fully accepted because the touched add-to-project submenu containment fix still fails at the previously failing 1200x818 viewport.

## Evidence

- Regression folder: `qa/codex-final-product-audit/regression-2026-06-09_21-57-56_PDT/`
- Logs: `LOGS/`
- Screenshots: `SCREENSHOTS/`
- QA scripts: `SCRIPTS/`

## Automated Checks

| Item | Status | Evidence |
| --- | --- | --- |
| `pnpm test` | PASS | `LOGS/01-pnpm-test.log`; desktop Vitest has 8 passing tests |
| `uv run --project runtime/python pytest` | PASS | `LOGS/02-uv-pytest.log`; 74 passed, 1 warning |
| `cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml` | PASS | `LOGS/03-cargo-test.log`; 11 passed |
| `pnpm typecheck` | PASS | `LOGS/04-pnpm-typecheck.log` |
| `pnpm desktop:release` | PASS | `LOGS/06-pnpm-desktop-release.log`; `.app` and `.dmg` rebuilt |

## Regression Matrix

| Fix / flow | Status | Evidence / notes |
| --- | --- | --- |
| P0 runtime clean packaged launch | PASS | `LOGS/07-lifecycle-regression.log`, `LOGS/10-clean-launch-run-status.txt`; run completed |
| P0 quit kills owned sidecar | PASS | `LOGS/10-clean-launch-after-quit-port-8765.txt`, `LOGS/20-relaunch-after-quit-port-8765.txt`; no listener remained |
| P0 repeated relaunch | PASS | `LOGS/20-relaunch-run-status.txt`; run completed after relaunch |
| P0 adopt healthy external runtime | PASS | `LOGS/30-adopt-survives-health.json`, `LOGS/30-after-app-adopt-run-status.txt`; adopted runtime survived app quit |
| P0 unhealthy port conflict process behavior | PASS | `LOGS/40-after-conflict-app-port-8765.txt`, `LOGS/40-conflict-sidecar-matches.txt`; Python server kept port, no sidecar spawned |
| P0 unhealthy port conflict visible blocking UI | NOT TESTED | Tauri packaged window state was not introspected; process-level behavior only was verified |
| P1 Project context-mode UI | PASS | `LOGS/31-project-context-popover-check.json`; Default and Project-only visible |
| P1 Project context persists/displayed | PASS | `LOGS/32-project-overview-tabs-check.json`; overview shows Context / Project-only |
| P1 Project Agents tab | PASS | `LOGS/33-project-agents-tab-check.json`, `SCREENSHOTS/34-project-agents-regression.png`; 6 agent rows |
| P1 Project tab wrapping | PASS | `LOGS/32-project-overview-tabs-check.json`; all tabs share one row at 1200x818 |
| P1 Workshop zh-CN localization | PASS | `LOGS/19-workshop-zh-text-check.json`, `SCREENSHOTS/18-workshop-zh-regression.png`; old English strings absent |
| P1 Workshop valid import/export/reimport | PASS | `LOGS/20-workshop-regression.log`, `LOGS/29-workshop-regression-summary.json` |
| P1 Workshop unsafe traversal/executable/symlink rejection | PASS | `LOGS/27-workshop-*-validate.json`, `LOGS/28-workshop-*-import-reject.json` |
| P1 Atelier stale/mixed worker labels | PASS | `LOGS/54-atelier-stale-label-check.json`, `SCREENSHOTS/55-atelier-regression.png`; no Failed/Done/Working labels between runs |
| P1 Provider honesty / narrowed scope | PASS | `LOGS/60-provider-honesty-check.json`, `SCREENSHOTS/61-providers-regression.png`; Anthropic/Gemini not implemented; custom endpoints setup-required |
| Approval `deny` / `approve` aliases | PASS | `LOGS/40-approval-alias-regression.log`, `LOGS/48-approval-alias-regression-summary.json` |
| Search modal containment | PASS | `LOGS/37-search-containment-check.json`, `SCREENSHOTS/38-search-regression.png`; results stay inside modal |
| Add-to-project submenu containment | FAIL | `LOGS/35-add-to-project-containment-check.json`, `SCREENSHOTS/36-add-to-project-regression.png`; menu bottom 848.4 and submenu bottom 895.5 exceed viewport height 818 |
| No fake success in retested Browser approval path | PASS | Approved Browser run reached honest Chromium setup-required failure; see approval summary logs |
| Static no-mock keyword scan | PASS | `LOGS/63-static-no-mock-keyword-scan.txt`; no fake success path found in scoped retest |

## New / Still Failing

### R1. Add-to-project submenu still overflows viewport

Status: FAIL
Severity: P2 touched-flow regression
Evidence:
- `LOGS/35-add-to-project-containment-check.json`
- `SCREENSHOTS/36-add-to-project-regression.png`

Observed at 1200x818:
- Menu bottom: `848.4140625`
- Submenu bottom: `895.5`
- Viewport height: `818`
- `menuWithinViewport=false`
- `submenuWithinViewport=false`

The menu is now internally scrollable, but it still opens too low and does not flip or reposition to stay on-screen.

## Remaining External Blockers Not Re-Tested

| Item | Status | Notes |
| --- | --- | --- |
| Codesign/notarization | BLOCKED | Requires Apple Developer ID cert and notarization credentials |
| Browser Chromium provisioning | BLOCKED | Browser approval path still fails honestly because Chromium is not bundled/provisioned |
| Computer Use Accessibility / Screen Recording | BLOCKED | Requires human macOS permission grants |
| Notifications, global shortcut, menubar/tray, packaged window-focus QA | NOT TESTED | Requires manual macOS interaction |
| Real model provider credentials | BLOCKED | Isolated runtime has no API key configured |

## QA Side Effects

- Rebuilt release artifacts with `pnpm desktop:release`.
- Created isolated runtime data under this regression folder.
- Created QA-only Workshop ZIP fixtures under `workshop-fixtures/`.
- Created QA-only runs, approvals, packs, and project records inside the isolated regression runtime database.
- Stopped the packaged/test runtimes after regression cleanup.

## Notes

- `onboarding.tryDemo` remains user-facing copy, but the inspected path starts a real `List workspace files` run and opens real Atelier/progress surfaces. Treat as a wording-policy observation, not a fake-execution failure in this scoped retest.
