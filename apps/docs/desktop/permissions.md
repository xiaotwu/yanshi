# macOS Permissions

Some tools need macOS privacy permissions. Yanshi shows an honest **permission-required** state
until you grant them — it never fakes success.

## Settings → Permissions

The Permissions page has tool toggles (Browser / Computer / Terminal) and system permission
status. When the desktop bridge is unavailable (for example, running outside the packaged app),
the page shows an explicit **"Desktop bridge unavailable / 桌面桥接不可用"** row rather than
silently omitting the status.

::: warning Status
Browser automation is <Badge type="warning" text="Setup required" /> until Chromium is installed.
Computer Use click/type/shortcut/screenshot is
<Badge type="warning" text="Blocked by macOS permission" /> until the user grants Accessibility
and Screen Recording.
:::

## Computer Use

| Capability | macOS permission | Status |
|---|---|---|
| `open-app` | none | <Badge type="tip" text="Works today" /> |
| click / type / shortcut | Accessibility | <Badge type="warning" text="Needs grant" /> |
| screenshot | Screen Recording | <Badge type="warning" text="Needs grant" /> |

To grant:

- **Accessibility** — System Settings → Privacy & Security → Accessibility → enable Yanshi.
- **Screen Recording** — System Settings → Privacy & Security → Screen Recording → enable Yanshi.

Until granted, the affected actions report `YANSHI_COMPUTER_001` / `YANSHI_COMPUTER_002`.

## Browser

The Browser tool needs Chromium provisioned for the runtime
(`playwright install chromium`); until then it reports `YANSHI_BROWSER_001`.

See [Tools and Permissions](/concepts/tools-permissions) for the bridge and tool model.
