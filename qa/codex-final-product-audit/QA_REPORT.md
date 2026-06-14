# Yanshi Final Product QA Report

Audit time: 2026-06-09 19:44 PDT
Scope: final product QA/design acceptance for `/Users/xiaotwu/Code/yanshi`
Constraint followed: no product source files were modified. QA artifacts were written only under `qa/codex-final-product-audit/`.

## Verdict

Status: FAIL

Final product acceptance is not met.

Yanshi passed the automated build/test/release commands that were run, and the cleanly relaunched packaged runtime can create real runs, persist data, stream events, request approvals, execute the File Agent path, execute Docker sandbox commands, and open an app through the macOS Computer bridge. It is not final-acceptance ready because several required product areas remain incomplete, blocked, or unstable: stale sidecar lifecycle can leave runs stuck, the app is unsigned/unnotarized, Browser Use is blocked by missing Chromium binaries in the packaged runtime, macOS Computer Use actions need permissions, provider support is still partial, Workshop/i18n/project agent-office flows are incomplete, and several macOS shell behaviors still need manual verification.

## Evidence Locations

- Logs: `qa/codex-final-product-audit/LOGS/`
- Screenshots: `qa/codex-final-product-audit/SCREENSHOTS/`
- Primary screenshots: `phase3-home-shell.png`, `phase6-project-page.png`, `phase7-atelier-open.png`, `phase14-workshop-zh.png`, `phase16-providers.png`, `phase17-zh-home.png`, `phase18-dark-zh-home.png`

## Command Matrix

| Item | Status | Evidence |
| --- | --- | --- |
| `pnpm install` | PASS | `phase1-01-pnpm-install.log`; warning: ignored build scripts for `esbuild` |
| `pnpm lint` | PASS | `phase1-02-pnpm-lint.log` |
| `pnpm typecheck` | PASS | `phase1-03-pnpm-typecheck.log` |
| `pnpm test` | PASS | `phase1-04-pnpm-test.log`; command passed via Vitest `--passWithNoTests`, so JS test coverage is weak |
| `pnpm build` | PASS | `phase1-05-pnpm-build.log`; large chunk warning remains |
| `uv run --project runtime/python pytest` | PASS | `phase1-06-uv-pytest.log`; 73 passed, 1 deprecation warning |
| `cargo check --manifest-path apps/desktop/src-tauri/Cargo.toml` | PASS | `phase1-07-cargo-check.log` |
| `cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml` | PASS | `phase1-08-cargo-test.log`; 10 passed |
| `pnpm desktop:release` | PASS | `phase1-09-pnpm-desktop-release.log`; built `.app` and `.dmg` |
| Packaged sidecar present and executable | PASS | `.app` contains `Contents/Resources/resources/yanshi-runtime-sidecar` |
| Code signing | BLOCKED | Release log says signing identity `None`; requires Apple Developer ID cert |
| Notarization/stapling | BLOCKED | Requires Apple Developer ID account/cert and notarization credentials |

## Product Acceptance Matrix

| Product area | Status | Evidence / Notes |
| --- | --- | --- |
| Artifact scope compliance | PASS | Only `qa/codex-final-product-audit/` was created/updated |
| Packaged app launches runtime | PASS | `post-clean-launch-health.json`, `post-clean-launch-processes.txt`, `post-clean-launch-port-8765.txt` |
| Runtime lifecycle on repeated/stale launches and quit | FAIL | Stale processes caused port bind errors and runs stuck at `created`; quitting the packaged app also left the sidecar listening until manually terminated. See `pre-clean-relaunch-processes.txt`, `phase9-runtime-log-after-ui-run-tail.log`, `api-runs-after-ui-run.json`, `final-yanshi-processes-after-quit.txt`, `final-yanshi-processes-after-runtime-term.txt` |
| Runtime health endpoint | PASS | `post-clean-launch-health.json` |
| Real run creation after clean relaunch | PASS | `api-clean-create-project-run.json`, `api-clean-runs-after-create.json` |
| Real event streaming | PASS | `api-clean-events-after-create.json` contains run lifecycle/tool events |
| Persistence | PASS | Runs/projects/settings/artifacts persisted in SQLite; see API and SQLite evidence logs |
| File Agent path | PASS | Clean run completed and created file-scan artifact metadata |
| Approval request creation | PASS | `api-clean-approvals-after-risky-run.json` |
| Approval denial/resume behavior | PASS | `api-denied-approval-valid.json`, `api-denied-approval-run-after-valid.json` |
| Approval approval path | NOT TESTED | Denial was verified; approve/resume success needs another manual/API pass |
| Docker sandbox | PASS | `api-clean-create-docker-run.json`, `api-clean-runs-after-docker.json` |
| Browser Use | BLOCKED | `api-clean-runs-after-browser.json`; packaged runtime reports missing Chromium browser binaries |
| Computer Use open app | PASS | `api-clean-runs-after-computer-open-app.json`; TextEdit open-app completed |
| Computer Use click/type/shortcut actions | BLOCKED | `api-clean-runs-after-computer-click.json`; requires macOS Accessibility permission |
| Computer Use screenshot | BLOCKED | Requires macOS Screen Recording permission and manual permission grant verification |
| Native terminal agent | NOT TESTED | Docker command path was verified; native terminal task was not separately exercised |
| Providers settings UI/API | FAIL | UI is honest, but provider support is still single OpenAI-compatible config plus catalog statuses; Anthropic/Gemini not implemented |
| Provider connection health | NOT TESTED | Configured endpoint was local closed port; no real API key/provider available |
| Workshop installed pack view | PASS | `phase14-workshop-zh.png`, `playwright-workshop-zh-snapshot.md` |
| Workshop import/export/validation end to end | NOT TESTED | UI controls observed, but pack import/export was not executed in this audit |
| Workshop final product completeness | FAIL | Discover/validation flows are not visibly complete, and zh-CN view leaks English labels |
| Settings real state | PASS | `api-restore-theme-language.json`, settings UI screenshots |
| Theme switching | PASS | Dark theme verified; settings restored to `system`; see `phase18-dark-zh-home.png` and restore log |
| Language switching | PASS | zh-CN shell verified; settings restored to `system`; see `phase17-zh-home.png` and restore log |
| Localization completeness | FAIL | Workshop and some secondary surfaces still show English in zh-CN |
| Search modal | PASS | Search opens and filters real project/run data; screenshots and snapshots captured |
| Search modal layout | FAIL | Results can overflow the modal bounds; see UX issues |
| New project creation | PASS | Created `Codex QA Project`; persisted and appeared in sidebar/API |
| Project context-mode selection in UI | FAIL | API has `contextMode`, but modal does not expose Default vs Project-only choice |
| Project agent office/team management | FAIL | Project page lacks a dedicated Agents/team editor; required "project as agent office" is incomplete |
| Live Office/Atelier opens | PASS | `phase7-atelier-open.png` |
| Live Office final visual acceptance | FAIL | Procedural/fallback-looking workers and stale/mixed state presentation need design/product fixes |
| Account menu contents | PASS | Profile, Personalization, Settings, Help only; no plan/upgrade/logout text observed |
| Composer clean normal mode | PASS | Home shell is clean, concise, and mostly icon-driven |
| Add-to-project submenu layout | FAIL | Submenu extends below the visible viewport at 1200x818 |
| Onboarding/first-run flow | NOT TESTED | Current profile already had `onboarded=true`; reset would alter user data |
| Menubar/tray behavior | NOT TESTED | Requires manual macOS interaction |
| Global shortcut `Cmd+Y` | NOT TESTED | Requires manual macOS interaction |
| Notifications | NOT TESTED | Requires manual macOS notification permission/path verification |
| Close with active runs prompt | NOT TESTED | Requires packaged app window interaction |
| Packaged app foreground/window UX | BLOCKED | macOS automation repeatedly captured Codex instead of Yanshi; requires human verification or stronger desktop automation |

## Top Release Blockers

1. FAIL: stale sidecar/runtime process lifecycle can leave the app apparently healthy while new runs stay stuck at `created`.
2. BLOCKED: app is unsigned and unnotarized.
3. BLOCKED: Browser Use cannot run in the packaged app without Chromium browser binaries.
4. BLOCKED: Computer Use click/type/screenshot require macOS Accessibility and Screen Recording permissions.
5. FAIL: provider support is not final multi-provider runtime selection.
6. FAIL: Workshop and project agent-office flows are still incomplete for final product acceptance.
7. FAIL: zh-CN localization is incomplete on Workshop and secondary controls.
8. FAIL: Atelier/Live Office is functional enough to open, but not visually/product-complete.

## QA Side Effects

- Created QA artifacts under `qa/codex-final-product-audit/`.
- Created a project named `Codex QA Project` through the product UI/API.
- Created several QA runs, approvals, artifacts, and automation evidence in the local Yanshi SQLite app data.
- Temporarily changed theme/language for QA and restored both to `system`; see `api-restore-theme-language.json`.
- Wrote a fake provider API key to verify secret storage. Visible provider fields were restored to their pre-audit values, but the prior secret value could not be recovered because the product intentionally never exposes it. Replace the provider API key before real use.

## Recommendation

Do not mark the final product accepted yet. Send `BUGS_FOR_CLAUDE.md` and `CLAUDE_FIX_PROMPT.md` to the implementation agent, then rerun this audit after lifecycle, signing, Browser Use packaging, Computer Use permission UX, provider support, Workshop, Project agents, localization, and Atelier polish are addressed.
