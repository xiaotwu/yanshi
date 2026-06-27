# Important Notes

## Real States

Yanshi should report real states. Missing keys, missing browser binaries, missing Docker, denied
macOS permissions, runtime startup failures, and release blockers should be visible as setup,
blocked, or failed states.

## Provider Keys

Provider keys are stored outside the main SQLite database. Settings APIs should expose only whether
a key is configured.

## Permissions

Computer Use requires Accessibility and Screen Recording permission. Until granted, related actions
remain permission-required.

## Browser And Docker

Browser tools require Playwright Chromium. Docker-backed terminal tools require Docker to be
installed and running.

## Public Release

Local source builds are useful for development and testing. Public macOS distribution requires
Developer ID signing, notarization, stapling, and Gatekeeper verification.
