# Manual Blockers

Manual/human or external prerequisites identified during QA.

## Blockers

### M1. Apple Developer ID signing and notarization

Status: BLOCKED
Required:
- Apple Developer ID Application certificate.
- Notarization credentials.
- Signed `.app`/`.dmg`.
- Stapled notarization ticket.
- Gatekeeper verification on a clean Mac.

Evidence:
- `LOGS/phase1-09-pnpm-desktop-release.log`

### M2. Browser Use Chromium provisioning

Status: BLOCKED
Required:
- Install or bundle Playwright Chromium for the packaged Python sidecar.
- Verify browser navigation, screenshot, DOM extraction, and error handling from the packaged app.

Evidence:
- `LOGS/api-clean-runs-after-browser.json`

### M3. macOS Accessibility permission

Status: BLOCKED
Required:
- Grant Accessibility permission to the packaged `Yanshi.app`.
- Re-run Computer Agent click/type/shortcut tasks.

Evidence:
- `LOGS/api-clean-runs-after-computer-click.json`

### M4. macOS Screen Recording permission

Status: BLOCKED
Required:
- Grant Screen Recording permission to the packaged `Yanshi.app`.
- Verify Computer Agent screenshot/observe flow.

Evidence:
- Screenshot path not executed after permission preflight failed.

### M5. Notifications permission

Status: NOT TESTED
Required:
- Human must allow/deny macOS notifications.
- Verify notification trigger, copy, click behavior, and settings toggle.

### M6. Global shortcut

Status: NOT TESTED
Required:
- Human must verify `Cmd+Y` registration, conflict handling, and action while app is backgrounded.

### M7. Menubar/tray and close behavior

Status: NOT TESTED
Required:
- Human must verify app menu, tray/menubar behavior, close/minimize/quit behavior, and active-run close prompt.

### M8. Packaged app foreground/window visual QA

Status: BLOCKED
Required:
- Human or stronger desktop automation must inspect the actual packaged Yanshi window.
- Verify traffic lights/titlebar, window drag regions, focus behavior, first-run shell, and deep-link/menu behavior.

Evidence:
- macOS screenshot attempts captured Codex instead of Yanshi in `SCREENSHOTS/phase2-*.png`.

### M9. Real provider credentials

Status: BLOCKED
Required:
- Provide a real OpenAI-compatible provider endpoint and API key.
- Run provider health and at least one model-backed Manager/Reviewer flow.

Evidence:
- Provider UI observed; configured endpoint was a closed local port.

### M10. QA fake provider secret cleanup

Status: BLOCKED
Required:
- Replace the local provider API key before real use.

Context:
- QA intentionally wrote a fake provider key to verify secret storage and leak behavior.
- Visible provider fields were restored, but the original secret value cannot be recovered because the app intentionally does not expose stored secrets.
