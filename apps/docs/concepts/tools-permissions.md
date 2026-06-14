# Tools and Permissions

Yanshi agents act through real tools. Each tool has an honest availability state — when a
dependency or OS permission is missing, the tool reports a *not-configured* or
*permission-required* state instead of pretending to succeed.

## Tools

| Tool | What it does | Status |
|---|---|---|
| **File** | Read/list/scan the project workspace (traversal-safe) | <Badge type="tip" text="Available now" /> |
| **Browser** | Web navigation via Playwright | <Badge type="warning" text="Setup required" /> (Chromium) |
| **Computer** | Screenshot + click/type/shortcut/open-app via a token-auth localhost bridge | <Badge type="warning" text="Blocked by macOS permission" /> |
| **Terminal / Docker** | Sandboxed command execution | <Badge type="tip" text="Available now" /> (Docker daemon setup required) |

## Permission model

- **Browser** needs Chromium provisioned for the runtime (`playwright install chromium`). Until
  then it reports `playwright_browser_binaries` honestly — surfaced as `YANSHI_BROWSER_001`.
- **Computer Use** needs macOS **Accessibility** (click/type/shortcut) and **Screen Recording**
  (screenshot). The `open-app` path needs no permission and works today; the rest show a
  permission-required state until granted (`YANSHI_COMPUTER_001/002`).
- **Docker** needs a running daemon; invalid sandbox config or a missing daemon reports
  `YANSHI_DOCKER_001`.

## The Computer bridge

Computer Use runs through a localhost bridge on a random port with a bearer token. The token is
never logged, and the bridge rejects missing/invalid tokens with `401`. See the
[Security Model](/reference/security).

## Tool toggles

Browser / Computer / Terminal can be enabled or disabled in **Settings → Permissions**. Disabled
tools report `tool_disabled` rather than silently doing nothing. Granting macOS permissions is a
manual step in System Settings — see [macOS Permissions](/desktop/permissions).
