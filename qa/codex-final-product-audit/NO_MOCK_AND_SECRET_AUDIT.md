# No-Mock And Secret Audit

## Summary

Status: PASS

No user-facing fake success path or raw provider secret leak was confirmed during this audit. The product uses honest missing-requirement states for Browser Use, Computer Use permission, and unsupported providers. However, several final-product features are still incomplete or blocked, so this no-mock pass should not be read as final product acceptance.

## No-Mock Checks

| Item | Status | Evidence |
| --- | --- | --- |
| Static mock/demo keyword scan | PASS | `LOGS/static-no-mock-keyword-scan.txt` |
| User-facing fake browser success | PASS | Browser task failed honestly with missing Chromium; `LOGS/api-clean-runs-after-browser.json` |
| User-facing fake computer action success | PASS | Click task failed honestly for missing Accessibility permission; `LOGS/api-clean-runs-after-computer-click.json` |
| User-facing fake provider health | PASS | Provider settings mark unavailable providers as not implemented/setup-required; `SCREENSHOTS/phase16-providers.png` |
| User-facing fake approval completion | PASS | Denied approval made the run fail honestly; `LOGS/api-denied-approval-run-after-valid.json` |
| Runtime event persistence | PASS | Clean run created real event stream; `LOGS/api-clean-events-after-create.json` |
| Workshop fake install/import avoidance | NOT TESTED | Workshop UI observed, but import/export end to end was not run |
| Live Office real-state consumption | FAIL | Atelier opens, but status presentation can look stale/mixed; see `VISUAL_DESIGN_ISSUES.md` |

## Secret Storage Checks

| Item | Status | Evidence |
| --- | --- | --- |
| Provider API key stored outside SQLite raw setting | PASS | `LOGS/sqlite-settings-after-fake-secret.txt` |
| Raw fake key grep in app data | PASS | `LOGS/secret-grep-results.txt` found raw key only in expected secret-store file |
| Raw fake key leak scan excluding secret store | PASS | `LOGS/secret-leak-scan-excluding-secret-store.txt` was empty |
| Static secret keyword scan | PASS | `LOGS/static-secret-keyword-scan.txt`; no hardcoded production secret confirmed |
| Tauri CSP present | PASS | `LOGS/static-tauri-csp-scan.txt` |
| Path safety/static upload guards | PASS | `LOGS/static-path-safety-scan.txt` |

## Important QA Side Effect

Status: BLOCKED

QA intentionally wrote a fake provider API key to verify that raw keys are not stored in SQLite/logs. Visible provider fields were restored to:

- `baseUrl`: `http://127.0.0.1:9/v1`
- `model`: `m`

The previous secret value cannot be restored because the product intentionally never exposes stored secrets. Before real model use, replace the provider API key in Settings.

## Caveats

- `runtime/python/build/` and `dist/` style build outputs appeared in static scans; this audit did not delete generated files.
- Browser Use and Computer Use blocked paths behaved honestly, but they are still product blockers.
- Unsupported provider catalog entries are honest, but final acceptance still requires implementation or explicit release-scope reduction.
