# Functional Issues

## P1

### Packaged app event stream is unavailable in UI

Status: FAIL  
Evidence:
- `SCREENSHOTS/30-packaged-app-screen.png`
- `SCREENSHOTS/31-packaged-app-after-wait.png`
- `LOGS/14-packaged-app-launch.log`

The packaged sidecar starts and `/health` plus `/events` respond, but the packaged UI shows `Event stream unavailable.` This blocks final packaged acceptance because event streaming is a core product requirement.

### Shortcut conflict capture persists bad state

Status: FAIL  
Evidence:
- `SCREENSHOTS/18-shortcut-edit-triggered-search-bug.png`
- `LOGS/12-reset-shortcuts-after-bug.json`

The shortcut editor saved `new-task: Meta+K` and fired Search while capturing. Runtime persistence works, but the edit/capture flow is unsafe.

## Passed Functional Checks

- Runtime seed created real projects, uploads, runs, artifacts, integrations, and provider settings through public APIs.
- Project-scoped and standalone file-scan runs created real artifacts.
- Library source-task action opened the real run detail.
- New Project UI creation works and navigates into the created project.
- ACP/MCP settings persist and statuses remain honest.
- Provider settings persist, hide the raw key, and failed health check reports `ConnectError`.
- Workshop export/import produced a real validated pack.
- GPU setting persisted and changed `data-fx`.
- Default keyboard shortcuts triggered after clean reload.

## NOT TESTED / BLOCKED

- Real external LLM health success: BLOCKED by missing valid provider/API key.
- Native ACP/MCP execution: NOT TESTED because runtime honestly does not implement live clients yet.
- Native Computer Use permissions and Browser Use permissions: BLOCKED by macOS/browser permission state.
- Notarized/distributable release install: BLOCKED by Apple Developer ID/notarization requirements.
