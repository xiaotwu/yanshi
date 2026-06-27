# Important Notes

## Real States Only

Yanshi should show real runtime, provider, tool, permission, and release states. Missing setup must
appear as not-configured, setup-required, blocked, or failed.

## Provider Keys

Provider API keys are stored outside the main SQLite database. Settings APIs should expose whether
a key is configured, not the raw key itself.

## macOS Permissions

Computer Use needs macOS Accessibility and Screen Recording permission. Until those permissions are
granted, related actions should remain blocked or permission-required.

## Browser Setup

Browser automation depends on Playwright Chromium. If Chromium is missing, Yanshi should show the
setup requirement clearly.

## Docker

Docker-backed terminal work requires Docker to be installed and running. Without Docker, the app
should show the missing daemon or unavailable sandbox state.

## Local Release Status

The app can be built locally from source. Public distribution requires signing, notarization,
stapling, and Gatekeeper verification.

## Developer Mode

Technical logs, event details, runtime diagnostics, and raw execution information belong in
Developer Mode or logs, not the normal chat surface.

See [ERROR_CATALOG.md](ERROR_CATALOG.md) for the concise list of user-facing error codes.
