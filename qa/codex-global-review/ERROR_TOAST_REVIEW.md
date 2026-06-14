# Error Toast Review

Date: 2026-06-12

## Verdict

**PASS**

## Static Checks

| Check | Result | Evidence |
|---|---:|---|
| `Load Failed` visible normal UI | PASS, not rendered | `LOGS/18-home-dom-audit.json`, `LOGS/38-library-dom-audit.json` |
| `Event Stream Unavailable` visible normal UI | PASS, not rendered | `LOGS/18-home-dom-audit.json`, `LOGS/35-zh-naming-dom-audit.json` |
| `Failed to load` visible normal UI | PASS, not rendered | `LOGS/18-home-dom-audit.json`, `LOGS/38-library-dom-audit.json` |
| Duplicate inline red error classes | PASS | only intentional create-project form validation in source scan |
| Catalog coverage | PASS | `docs/ERROR_CATALOG.md`, `LOGS/12-error-code-coverage-scan.log` |

## Tested Error Cases

| Case | Result | Toast | Code | Reason | Duplicate Inline Error | Evidence |
|---|---:|---:|---|---|---:|---|
| Provider test failure with bad configured endpoint | PASS | Yes | `YANSHI_PROVIDER_002` | “Provider test failed” + short provider reason | No | `LOGS/32-provider-toast-retry-audit.json`, `SCREENSHOTS/06-provider-toast-retry-accepted-en.png` |
| Direct toast smoke through error registry | PASS | Yes | `YANSHI_FILE_002` | File/output load reason | No | `LOGS/31-direct-toast-push.json` |
| Toast auto-dismiss | PASS | Gone after ~9s | `YANSHI_PROVIDER_002` / direct smoke | N/A | No | `LOGS/26-provider-toast-autodismiss.json` |
| zh-CN/dark normal UI duplicate check | PASS | No stale toast | N/A | N/A | No | `LOGS/35-zh-naming-dom-audit.json` |
| Runtime unavailable / event disconnect | NOT TESTED live in UI | N/A | `YANSHI_RUNTIME_002` documented | N/A | Static/source only | `LOGS/09-error-text-static-scan.log` |
| ACP bad command | NOT TESTED live | N/A | `YANSHI_ACP_001` documented | N/A | Static/source only | `LOGS/12-error-code-coverage-scan.log` |
| MCP bad config | NOT TESTED live | N/A | `YANSHI_MCP_001` documented | N/A | Static/source only | `LOGS/12-error-code-coverage-scan.log` |
| Atelier render fallback | NOT TESTED failure injection | N/A | `YANSHI_ATELIER_001` documented | N/A | Canvas rendered normally | `LOGS/39-atelier-dom-audit.json` |
| File operation failure | PARTIAL | Direct toast only | `YANSHI_FILE_002` | File/output load reason | No | `LOGS/31-direct-toast-push.json` |

## Toast Requirements

- Error code shown: PASS.
- Short reason shown: PASS.
- Dismiss control: PASS.
- Auto-dismiss about 8 seconds: PASS.
- Stacking/live region: PASS for direct smoke; not exhaustively stress-tested.
- en-US: PASS.
- zh-CN: PASS for UI/no stale text; provider toast not repeated in zh-CN.
- Dark/light: PASS for screens inspected.
- Accessibility live region: PASS (`aria-live="assertive"`, `role="alert"` in DOM).
- Developer Mode details: NOT TESTED in UI; source/docs preserve Developer diagnostics.
