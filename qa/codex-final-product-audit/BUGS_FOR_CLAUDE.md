# Archived / Resolved

This report is historical. All issues below were fixed and verified (see the matching
CLAUDE_FIX_RESULTS.md). Do not use as current active bugs — current QA state lives in
qa/CURRENT_QA_STATUS.md.

---

# Bugs For Claude

These are the implementation-facing defects from the final product QA audit. Source was not modified during QA.

## P0/P1 Release Blockers

### 1. Runtime sidecar lifecycle can strand runs after stale launches

Status: FAIL
Area: desktop/runtime lifecycle
Evidence:
- `LOGS/pre-clean-relaunch-processes.txt`
- `LOGS/phase9-runtime-log-after-ui-run-tail.log`
- `LOGS/api-runs-after-ui-run.json`
- `LOGS/api-agent-tasks-stuck-ui-run.json`
- `LOGS/sqlite-stuck-runs.txt`

Observed:
- Multiple stale `yanshi-runtime`/`yanshi-desktop` processes were present.
- Runtime logs showed repeated address-in-use failures on `127.0.0.1:8765`.
- UI/API-created runs `run_87b6c22b3ffe487ca3` and `run_53eced4c19144fcaab` remained at `created`.
- Events for stuck runs contained `run.created` only, with no `run.started` or `agent_tasks`.
- After killing stale processes and cleanly relaunching the packaged app, a new run completed correctly.
- Quitting packaged `Yanshi.app` via AppleScript removed the desktop process but left the sidecar listening on port 8765 until it was manually terminated.

Expected:
- Packaged app should own exactly one runtime instance or reliably attach to an existing compatible runtime.
- If startup fails because the port is occupied, the UI/runtime status must show a blocking error and must not accept runs that cannot execute.
- Quit should terminate the owned sidecar or intentionally transfer ownership to a supervised daemon.
- Relaunch should not leave runs permanently stuck at `created`.

### 2. Packaged app is unsigned and unnotarized

Status: BLOCKED
Area: release/distribution
Evidence:
- `LOGS/phase1-09-pnpm-desktop-release.log`

Observed:
- Tauri release built `.app` and `.dmg`, but signing identity was `None`.

Expected:
- Final macOS release needs Developer ID signing, notarization, stapling, and Gatekeeper verification.

Required external input:
- Apple Developer ID Application certificate and notarization credentials.

### 3. Browser Use fails in packaged runtime because Chromium binaries are missing

Status: BLOCKED
Area: Browser Agent / runtime packaging
Evidence:
- `LOGS/api-clean-create-browser-run.json`
- `LOGS/api-clean-runs-after-browser.json`

Observed:
- Browser task failed with missing Chromium browser binaries.

Expected:
- Packaged Yanshi should either bundle/provision Playwright Chromium or show a setup-required state with a one-click/install command path.
- Browser Agent should not appear ready if required browser binaries are absent.

### 4. Computer Use actions block on macOS permissions

Status: BLOCKED
Area: Computer Agent / macOS permissions
Evidence:
- `LOGS/api-clean-runs-after-computer-open-app.json`
- `LOGS/api-clean-runs-after-computer-click.json`

Observed:
- Opening TextEdit completed.
- Click/action task failed with missing macOS Accessibility permission.
- Screenshot path was not verified and likely requires Screen Recording permission.

Expected:
- Permission-required state should guide the user to grant Accessibility and Screen Recording to the packaged app, then let the user retry.
- Actions should be disabled or clearly blocked until permissions are granted.

Required external input:
- Human must grant macOS Accessibility and Screen Recording permissions for Yanshi.app.

### 5. Provider implementation is still partial

Status: FAIL
Area: Settings / runtime providers
Evidence:
- `SCREENSHOTS/phase16-providers.png`
- `LOGS/playwright-providers-snapshot.md`
- `LOGS/api-clean-provider-settings.json`

Observed:
- OpenAI Compatible/OpenAI are available.
- Anthropic and Google Gemini are visibly "Not implemented yet".
- Several providers require custom endpoint setup.
- UI behaves like a single provider config rather than full provider registry/default/per-run selection.

Expected:
- Final product needs real provider registry behavior or explicitly narrowed release scope.
- No provider should look selectable as a final supported runtime if it cannot execute.

## P1 Product Completeness Bugs

### 6. Project creation hides context-mode choice

Status: FAIL
Area: Projects
Evidence:
- `SCREENSHOTS/phase6-new-project-modal.png`
- `LOGS/playwright-new-project-modal-snapshot.md`
- `LOGS/api-clean-projects.json`

Observed:
- API stores `settings.contextMode`.
- New Project UI only asks for icon and name.

Expected:
- Project creation/editing should expose the documented Default vs Project-only context behavior, or remove the unexposed concept.

### 7. Project page is not a complete agent office

Status: FAIL
Area: Projects / Agent teams
Evidence:
- `SCREENSHOTS/phase6-project-page.png`
- `LOGS/playwright-project-page-snapshot.md`

Observed:
- Project page has Overview/Runs/Files/Artifacts/Automations/Atelier/Activity/Settings.
- No dedicated Agents tab/team editor was visible.
- Settings tab wraps onto a second row at 1200px width.

Expected:
- Project should expose agent team composition, agent state, and project office controls in a first-class, usable way.

### 8. Workshop is not final-complete and leaks English in zh-CN

Status: FAIL
Area: Workshop / localization
Evidence:
- `SCREENSHOTS/phase14-workshop-zh.png`
- `LOGS/playwright-workshop-zh-snapshot.md`

Observed:
- In zh-CN, Workshop still shows English labels such as Installed, Agent Editor, Office Editor, Create, Export, Import pack, Enable.
- Discover/validation style flows are not visibly complete in the captured UI.

Expected:
- Workshop should be localized and support real import/export/validation flows with clear status.

### 9. Atelier/Live Office looks procedural and can show stale/mixed agent states

Status: FAIL
Area: Live Office / visual product
Evidence:
- `SCREENSHOTS/phase7-atelier-open.png`
- `LOGS/playwright-atelier-modal-snapshot.md`
- `LOGS/api-clean-agent-instances.json`

Observed:
- Workers look like fallback/procedural shapes.
- Status labels included mixed states such as Browser Failed, Computer Failed, Terminal Chatting while lower status chips showed other states.
- Atelier is usable, but not final-polished.

Expected:
- Live Office should consume current real runtime state, avoid stale/mismatched labels, and meet the final visual spec.

## P2 UI/UX Bugs

### 10. Add-to-project submenu overflows below the viewport

Status: FAIL
Area: Composer menu layout
Evidence:
- `SCREENSHOTS/phase3-add-to-project.png`
- `LOGS/playwright-add-to-project-snapshot.md`

Observed:
- At 1200x818, the submenu extends below the viewport; "New project..." lands partially off-screen.

Expected:
- Menus should flip, constrain height, or scroll to remain visible.

### 11. Search modal results can overflow the modal bounds

Status: FAIL
Area: Search
Evidence:
- `SCREENSHOTS/phase5-search-modal.png`
- `LOGS/playwright-search-modal-snapshot.md`

Observed:
- Search result groups extend below the visual modal container.

Expected:
- Results should scroll inside the modal without visually escaping the surface.

### 12. JavaScript test command passes with no tests

Status: FAIL
Area: test coverage
Evidence:
- `LOGS/phase1-04-pnpm-test.log`

Observed:
- Command passed via `--passWithNoTests`.

Expected:
- Add meaningful frontend/package tests for core UI state, runtime clients, menus, project creation, settings, and provider flows.

### 13. Release build has large bundle warnings

Status: FAIL
Area: frontend performance/release polish
Evidence:
- `LOGS/phase1-05-pnpm-build.log`
- `LOGS/phase1-09-pnpm-desktop-release.log`

Observed:
- Vite reports large chunks.

Expected:
- Split the 3D/Live Office and heavy routes so first-load performance is bounded.
