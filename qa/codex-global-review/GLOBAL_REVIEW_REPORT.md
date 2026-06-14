# Codex Global Review Report

Date: 2026-06-12

## 1. Overall Verdict

**PASS WITH MINOR ISSUES**

Yanshi is acceptable for the next freeze / manual release step, with the already-known external release blockers still open: signing/notarization, human packaged-app checks, real provider key entry, Browser Chromium provisioning, and macOS permissions for Computer Use.

Product readiness: **92%** for v0.1 local final-candidate validation.

## 2. Automated Results

| Check | Result | Evidence |
|---|---:|---|
| `pnpm lint` | PASS | `LOGS/01-pnpm-lint.log` |
| `pnpm typecheck` | PASS | `LOGS/02-pnpm-typecheck.log` |
| `pnpm test` | PASS | `LOGS/03-pnpm-test.log` |
| `pnpm build` | PASS | `LOGS/04-pnpm-build.log` |
| `uv run --project runtime/python pytest` | PASS, 79 passed | `LOGS/05-uv-pytest.log` |
| `cargo check --manifest-path apps/desktop/src-tauri/Cargo.toml` | PASS | `LOGS/06-cargo-check.log` |
| `cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml` | PASS, 11 passed | `LOGS/07-cargo-test.log` |
| `pnpm desktop:release` | PASS | `LOGS/08-pnpm-desktop-release.log` |

Known non-blocking warnings: Vite large chunk warning; FastAPI/Starlette deprecation warnings in pytest.

## 3. Error Toast Summary

**PASS.** Provider failure, direct toast smoke, source coverage, live-region behavior, and auto-dismiss were validated. No duplicate normal-mode red inline `Load Failed`, `Event Stream Unavailable`, or `Failed to load` was found in rendered normal UI. Static scan found only intentional CSS/form-validation and docs/test references.

Evidence: `ERROR_TOAST_REVIEW.md`, `LOGS/09-error-text-static-scan.log`, `LOGS/28-provider-toast-configured-audit.json`, `LOGS/31-direct-toast-push.json`, `LOGS/32-provider-toast-retry-audit.json`.

## 4. UI Regression Summary

**PASS.** Reviewed Home/New Chat, Composer, Sidebar, Search, Library, Workshop, Settings/Providers, Yanshi Atelier, dark/light, en-US/zh-CN, and packaged-app runtime behavior. No blank screens, duplicate chrome, modal overflow, or harsh search rectangle observed. Atelier rendered a nonblank canvas with visible workers.

Screenshots: `SCREENSHOTS/01-home-light-en.png` through `SCREENSHOTS/11-atelier-dark-zh.png`.

## 5. Packaged App Smoke

**PASS.** Fresh `Yanshi.app` launched, started the bundled sidecar on `127.0.0.1:8765`, reported healthy, created and completed a real file-scan run, persisted real events, served a WebSocket event, and quit with no remaining Yanshi process or port listener.

Evidence: `LOGS/42-packaged-health.json`, `LOGS/43-packaged-create-run.json`, `LOGS/44-packaged-run-status.json`, `LOGS/47-packaged-events-filtered-api.json`, `LOGS/49-packaged-websocket-smoke-correct.json`, `LOGS/51-post-packaged-quit-processes.txt`.

Note: packaged smoke uses the normal app data directory (`~/Library/Application Support/com.yanshi.desktop`), so the packaged smoke run was created there. I did not hand-edit or delete user app data.

## 6. No-Mock / Secret Audit

**PASS.** Source scan showed honest not-configured / not-implemented states rather than fake readiness. Provider API response did not return the dummy key used in isolated QA runtime. SQLite scans found no literal dummy key or obvious API-key/token patterns in the QA DB or packaged app DB.

Evidence: `NO_MOCK_SECRET_AUDIT.md`, `LOGS/10b-no-mock-source-only.log`, `LOGS/11b-secret-literal-source-only.log`, `LOGS/52-sqlite-secret-scan.txt`.

## 7. Bugs By Severity

No active P0/P1/P2 product bugs found in this pass.

Tracked residual risk / NOT TESTED: human-only packaged traffic-light glance, native close-button click path, tray/notifications/global shortcut, reduced-motion eyeball, real provider API key, real Browser navigation after Chromium provisioning, and Computer Use after macOS permissions.

## 8. Recommendation

Proceed to next freeze / manual release step. Keep the candidate blocked from public distribution until codesign/notarization and the human-only packaged checks are complete.
