# Error Catalog

Every user-facing failure in Yanshi maps to a stable code in the format
`YANSHI_<AREA>_<NNN>` and appears as a red toast (~8 seconds, dismissible, accessible) with the
code and a short reason. Unknown failures map to `YANSHI_UNKNOWN_001`. Normal mode never shows
stack traces — structured detail goes to the console and runtime logs for Developer Mode.

## Codes

| Code | Area | Meaning | Typical action |
|---|---|---|---|
| `YANSHI_RUNTIME_001` | Runtime | Runtime connection failed | Restart Yanshi; check logs |
| `YANSHI_RUNTIME_002` | Runtime | Event stream unavailable | Auto-reconnects; no action |
| `YANSHI_RUNTIME_003` | Runtime | Runtime restart failed | Quit and relaunch; check logs |
| `YANSHI_PROVIDER_001` | Provider | No model provider configured | Add a provider + key in Settings |
| `YANSHI_PROVIDER_002` | Provider | Provider test failed | Check base URL / model / key |
| `YANSHI_PROVIDER_003` | Provider | Provider save failed | Retry; check runtime |
| `YANSHI_BROWSER_001` | Browser | Browser engine missing | `playwright install chromium` |
| `YANSHI_COMPUTER_001` | Computer | Accessibility permission required | Grant in System Settings |
| `YANSHI_COMPUTER_002` | Computer | Screen Recording permission required | Grant in System Settings |
| `YANSHI_DOCKER_001` | Terminal/Docker | Docker unavailable / misconfigured | Start Docker; check sandbox config |
| `YANSHI_FILE_001` | File | File upload failed | Retry with a valid file |
| `YANSHI_FILE_002` | File/Library | Files/outputs could not load | Reopen; check runtime |
| `YANSHI_WORKSHOP_001` | Workshop | Pack import/op failed | Verify the pack; retry |
| `YANSHI_WORKSHOP_002` | Workshop | Unsafe pack rejected | Use trusted packs only |
| `YANSHI_ATELIER_001` | Atelier | Atelier render failed | Retry / simplified view |
| `YANSHI_ACP_001` | ACP | Agent failed to start/connect | Check command / args / env |
| `YANSHI_MCP_001` | MCP | MCP config save failed | Retry; check runtime |
| `YANSHI_SHORTCUT_001` | Shortcuts | Shortcut conflict | Replace or cancel |
| `YANSHI_SHORTCUT_002` | Shortcuts | Global shortcut registration failed | Free the combination |
| `YANSHI_SETTINGS_001` | Settings | Settings save failed | Retry; check runtime |
| `YANSHI_PROJECT_001` | Projects | Project create/update failed | Adjust input and retry |
| `YANSHI_AUTOMATION_001` | Automations | Automation save/run failed | Retry; check runtime |
| `YANSHI_UI_001` | UI | View failed to load / render | Continue; reload if needed |
| `YANSHI_UNKNOWN_001` | Unknown | Unregistered failure (fallback) | Check logs if it persists |

## Behavior

- Toasts appear bottom-right, stack cleanly (capped), de-duplicate repeats, and auto-dismiss after
  ~8 seconds; you can also dismiss manually or with `Esc` on the focused toast.
- The toast region is an assertive ARIA live region; each toast is a `role="alert"` with a labeled
  dismiss button. The code chip means color is never the only signal.
- Honest setup states (Not configured, Permission required, Browser engine missing) are shown as
  neutral badges where they belong, not as harsh inline errors.

The authoritative source is `docs/ERROR_CATALOG.md` in the repository and the registry in
`apps/desktop/src/lib/errors.ts`.
