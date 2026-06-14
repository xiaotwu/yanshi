# Troubleshooting

Yanshi surfaces problems as red [error toasts](/reference/error-catalog) with a code and short
reason. Here are the common ones and what to do.

## The app can't reach the runtime

`YANSHI_RUNTIME_001` — restart Yanshi. If it persists, use **Open logs** from the toast or
**Settings → Developer → Runtime** and check the sidecar process and port `8765` binding.

## Live updates stopped

`YANSHI_RUNTIME_002` — the event stream dropped. Yanshi reconnects automatically (WebSocket with
an HTTP-polling fallback); the toast appears once on the transition and clears on recovery. No
action is usually needed.

## Chats won't run

`YANSHI_PROVIDER_001` — no provider is configured. Open **Settings → LLM Providers**, add a
provider and API key, and Test. If a test fails (`YANSHI_PROVIDER_002`), check the base URL,
model, and key.

## Browser tool does nothing

`YANSHI_BROWSER_001` — Chromium isn't provisioned. Run `playwright install chromium` for the
runtime.

## Computer Use is blocked

`YANSHI_COMPUTER_001` / `002` — grant Accessibility and/or Screen Recording in System Settings.
See [macOS Permissions](/desktop/permissions).

## The Atelier is blank

`YANSHI_ATELIER_001` — a render/WebGL failure. Use the fallback's **Retry** or **Simplified view**,
or reopen the window. The app contains the failure and never blanks the whole UI.

## Gatekeeper warns on launch

The build is unsigned. Right-click → Open, or `xattr -dr com.apple.quarantine Yanshi.app`. See
[Installation](/getting-started/installation).

## Developer Mode

Enable **Developer Mode** (Settings → General, or `⌘⇧D`) for raw events, runtime details, and
structured diagnostics. Normal mode never shows stack traces.
