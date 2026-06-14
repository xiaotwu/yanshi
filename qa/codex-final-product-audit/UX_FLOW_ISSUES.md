# UX Flow Issues

## Summary

Status: FAIL

Core chat-first flow is usable and clean. Final UX acceptance fails because several required workflows are incomplete, blocked, or not recoverable enough for a non-technical user.

## Findings

### UX1. Stale runtime state lets users create runs that never start

Status: FAIL
Severity: P1
Evidence:
- `LOGS/api-runs-after-ui-run.json`
- `LOGS/api-events-stuck-ui-run.json`
- `LOGS/phase9-runtime-log-after-ui-run-tail.log`

User impact:
- User sees "Working" or created state, but no task starts.
- No obvious recovery is presented in the UI.

Expected flow:
- If the runtime cannot bind/start, the user should see a blocking runtime error and a retry/restart path.
- New runs should not be accepted into a dead queue.

### UX2. Browser Agent setup requirement is surfaced only after failure

Status: BLOCKED
Severity: P1
Evidence:
- `LOGS/api-clean-runs-after-browser.json`

User impact:
- A user can request browser work, then the run fails because Chromium binaries are missing.

Expected flow:
- Browser Agent should show setup-required before use and offer the exact install/provision path.

### UX3. Computer Use permissions need a guided permission flow

Status: BLOCKED
Severity: P1
Evidence:
- `LOGS/api-clean-runs-after-computer-click.json`

User impact:
- Open-app works, but click/action tasks fail until Accessibility is granted.

Expected flow:
- Show an upfront permissions checklist with deep links/instructions for Accessibility and Screen Recording.
- Allow retry after permission grant.

### UX4. Project creation does not expose context-mode choice

Status: FAIL
Severity: P1
Evidence:
- `SCREENSHOTS/phase6-new-project-modal.png`
- `LOGS/api-clean-projects.json`

User impact:
- Users cannot understand or choose whether a project uses default/global context or project-only context.

Expected flow:
- Project creation/editing should expose context mode in plain language.

### UX5. Project page lacks first-class agent team management

Status: FAIL
Severity: P1
Evidence:
- `SCREENSHOTS/phase6-project-page.png`

User impact:
- The project does not yet feel like a persistent agent office with controllable staff/team state.

Expected flow:
- A project should let users inspect, edit, and reason about its agent team.

### UX6. Workshop import/export/validation is not fully proven

Status: NOT TESTED
Severity: P1
Evidence:
- `SCREENSHOTS/phase14-workshop-zh.png`

User impact:
- Users may see Workshop controls but final import/export reliability was not verified.

Expected flow:
- Import should validate real packs, reject unsafe packs, show errors, install successfully, and allow export/reimport.

### UX7. Search result containment needs cleanup

Status: FAIL
Severity: P2
Evidence:
- `SCREENSHOTS/phase5-search-modal.png`

User impact:
- Search can feel visually loose when result groups overflow the surface.

Expected flow:
- Search should have an internal scroll region and keyboardable result list.

### UX8. Composer plus-menu submenu can fall off-screen

Status: FAIL
Severity: P2
Evidence:
- `SCREENSHOTS/phase3-add-to-project.png`

User impact:
- Lower menu items may be hard to access on smaller windows.

Expected flow:
- Menus should stay on-screen.

## Passed UX Checks

- Status: PASS - Home composer is clean and concise.
- Status: PASS - Plus menu exposes Upload files, Plan first, Browser/Computer/Terminal, and Add to Project.
- Status: PASS - Effort menu exposes Low, Medium, High, Extra.
- Status: PASS - Permission menu exposes Default, Auto-review, Full access.
- Status: PASS - Account menu shows Profile, Personalization, Settings, Help, with no plan/upgrade/logout clutter.
- Status: PASS - New project creation persists a real project.
- Status: PASS - Settings theme/language changes persist and were restored after QA.
