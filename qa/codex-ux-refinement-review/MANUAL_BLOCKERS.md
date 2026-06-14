# Manual Blockers

| Area | Status | Required To Unblock |
|---|---:|---|
| Real provider connectivity | BLOCKED | Valid API key and reachable provider endpoint. |
| Apple Developer ID signing/notarization | BLOCKED | Developer ID certificate, notarization credentials, and notarized install validation. |
| macOS global shortcut behavior | BLOCKED | Human/manual packaged-app interaction with macOS shortcut registration and conflicts. |
| Menu bar/tray/notifications | BLOCKED | Manual macOS interaction and notification permissions. |
| Finder reveal | BLOCKED | Packaged desktop interaction with Finder, plus manual confirmation. |
| Computer Use permissions | BLOCKED | macOS Accessibility and Screen Recording permission state. |
| Browser Use real browser automation | BLOCKED | Browser/Playwright permission and target-site state where applicable. |
| Normal packaged app quit lifecycle | NOT TESTED | Launch app as a normal app, quit via Cmd+Q/Menu, verify owned sidecar cleanup. QA direct SIGTERM was cleaned manually and is not equivalent. |

## Notes

- The packaged app launch itself was not blocked; `.app` launched and sidecar health passed.
- Packaged UI event-stream failure is not a manual blocker; it is a functional FAIL.
