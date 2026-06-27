# Error Catalog

Yanshi user-facing failures use stable `YANSHI_<AREA>_<NNN>` codes. The normal UI should show the
code with a short reason, while technical detail belongs in Developer Mode or logs.

## YANSHI_RUNTIME_001

Runtime connection failed. Restart Yanshi and check logs if the sidecar cannot start.

## YANSHI_RUNTIME_002

Runtime event stream is unavailable. Yanshi should retry or fall back where possible.

## YANSHI_RUNTIME_003

Runtime restart failed. Quit and relaunch the app, then inspect logs if it persists.

## YANSHI_PROVIDER_001

No model provider is configured. Open Settings and save a provider, model, and API key.

## YANSHI_PROVIDER_002

Provider test failed. Check the base URL, model, key, and provider availability.

## YANSHI_PROVIDER_003

Provider settings could not be saved. Retry after checking runtime connectivity.

## YANSHI_BROWSER_001

Browser engine is missing. Install or provision Playwright Chromium for browser automation.

## YANSHI_COMPUTER_001

Accessibility permission is required for computer control.

## YANSHI_COMPUTER_002

Screen Recording permission is required for screenshots.

## YANSHI_DOCKER_001

Docker is unavailable or misconfigured. Start Docker or adjust sandbox settings.

## YANSHI_FILE_001

File upload failed. Retry with a valid file and check workspace access.

## YANSHI_FILE_002

Files or outputs could not be loaded. Check runtime connectivity and project state.

## YANSHI_WORKSHOP_001

Workshop import failed. Verify the pack file and retry.

## YANSHI_WORKSHOP_002

Unsafe Workshop pack rejected. Only import trusted packs that pass validation.

## YANSHI_ATELIER_001

Yanshi Atelier could not render. Retry the view or use a simpler display mode.

## YANSHI_ACP_001

External agent failed to start or connect. Check command, arguments, and environment.

## YANSHI_MCP_001

MCP server configuration could not be saved. Retry after checking runtime connectivity.

## YANSHI_SHORTCUT_001

Shortcut conflict. Choose a different shortcut or replace the existing binding.

## YANSHI_SHORTCUT_002

Global shortcut could not be registered by macOS. Free the combination or use in-app shortcuts.

## YANSHI_SETTINGS_001

Settings save failed. Retry after checking runtime connectivity.

## YANSHI_PROJECT_001

Project could not be created or updated. Check the input and retry.

## YANSHI_AUTOMATION_001

Automation could not be saved or run. Retry after checking runtime connectivity.

## YANSHI_UI_001

Interface error. Reload the view if it stays broken; data should remain persisted.

## YANSHI_UNKNOWN_001

Unexpected error without a more specific registered code. Check logs if it persists.
