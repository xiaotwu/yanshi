# Yanshi UX Refinement QA Report

Date: 2026-06-10  
Reviewer: Codex QA  
Scope: Product UX Architecture Refinement review after Claude implementation.  
Source-code edits: NONE

## Overall Recommendation

**Needs Claude fixes before next QA.**

The refinement pass is broadly real and functional in the dev/runtime environment: Projects, Library, Add-to-Project, AI Integrations, theme/i18n, switches, context menus, and the requested command stack largely pass. However, the packaged app has a core smoke failure: the UI shows **“Event stream unavailable.”** even though the bundled runtime sidecar is healthy and `/events` responds. Shortcut editing also has a regression where capturing a conflicting shortcut can trigger the existing app action and persist the conflict.

## Product Readiness

- **Dev UX readiness:** ACCEPT WITH FIXES
- **Packaged app readiness:** FAIL
- **No-mock/secret posture:** PASS
- **Release recommendation:** Do not accept final RC until packaged event streaming and shortcut-edit capture are fixed.

## Command Results

| Check | Status | Evidence |
|---|---:|---|
| `pnpm lint` | PASS | `LOGS/01-pnpm-lint.log` |
| `pnpm typecheck` | PASS | `LOGS/02-pnpm-typecheck.log` |
| `pnpm test` | PASS | `LOGS/03-pnpm-test.log` (24 app tests passed) |
| `pnpm build` | PASS | `LOGS/04-pnpm-build.log` |
| `uv run --project runtime/python pytest` | PASS | `LOGS/05-python-pytest.log` (76 passed, 1 deprecation warning) |
| `cargo check --manifest-path apps/desktop/src-tauri/Cargo.toml` | PASS | `LOGS/06-cargo-check.log` |
| `cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml` | PASS | `LOGS/07-cargo-test.log` (11 passed) |
| `pnpm desktop:release` | PASS | `LOGS/08-pnpm-desktop-release.log`; produced `.app` and `.dmg` |

## Manual / UI Matrix

| Area | Status | Notes |
|---|---:|---|
| Sidebar IA | PASS | Runs absent from primary nav; Library present; Projects section present. |
| Projects UX | PASS | Project page, scoped composer, Tasks/Files tabs, project settings verified. |
| New Project modal | PASS | UI create flow verified via controlled input; created `QA Modal Project`. Close affordance has accessibility issue. |
| Library | PASS | Project-first grouping, Standalone section, artifacts/files, metadata, source-task action verified. No unsafe delete. |
| Add-to-Project | PASS | Actual projects only, no Standalone target, New Project row, Remove appears only after project selected; contained at 960x680, 1200x818, 1440x900. |
| AI Integrations | PASS | ACP/MCP configs persist and show Not implemented/Not configured honestly; no fake tools/capabilities. |
| LLM Providers | PASS | Provider catalog, configured OpenAI-compatible row, secret-hidden password field, failed test connection all verified. |
| Skills | PASS | Built-in agent instruction profiles shown; copy says skills are config/instructions, not executable plugins. |
| Modals/floating windows | FAIL | ESC/outside behavior works on sampled modals; Project Settings focus restore fails and Settings has no visible close button. |
| Responsive | PASS | 960x680, 1200x818, 1440x900, 1600x1000 sampled without page-level overflow. |
| Toggles/GPU | PASS | `role="switch"`, no checkbox inputs in Appearance, persisted GPU state, `data-fx` rich/reduced toggles. |
| Context menus | PASS | Sidebar project, Recent task, Library item, Workshop pack verified with relevant/honest actions. Atelier object context not practical/no menu surfaced. |
| Keyboard shortcuts defaults | PASS | After clean reload, New Task/Search/Library/Settings/Atelier/sidebar/progress/composer actions triggered. |
| Keyboard shortcut editing | FAIL | Conflict capture can trigger app action and persist conflicting shortcut. |
| i18n | PASS | en-US and zh-CN sampled; main nav and Settings surface translated. |
| Theme | PASS | Light/system and dark sampled; persisted through runtime settings. |
| Packaged build/launch | PASS | `.app` launched; bundled sidecar executable present and health OK. |
| Packaged event streaming/UI | FAIL | Packaged UI persistently showed “Event stream unavailable” despite healthy `/health` and `/events`. |
| macOS global shortcut/menu bar/tray/notifications | BLOCKED | Requires human/OS-level interaction and permission state beyond this automated pass. |
| Real external provider connectivity | BLOCKED | Requires valid provider API key and reachable provider. |
| Apple Developer ID/notarization | BLOCKED | Requires Apple Developer ID and notarization workflow. |

## Bugs By Severity

### P1

1. **Packaged app shows “Event stream unavailable” while bundled runtime is healthy.**  
   Evidence: `SCREENSHOTS/30-packaged-app-screen.png`, `SCREENSHOTS/31-packaged-app-after-wait.png`, `LOGS/14-packaged-app-launch.log`; `/health` and `/events` responded on port 8765.

2. **Shortcut edit capture persists a conflicting binding and triggers the existing shortcut action.**  
   Evidence: `SCREENSHOTS/18-shortcut-edit-triggered-search-bug.png`; runtime temporarily saved `{"new-task":"Meta+K"}` before reset in `LOGS/12-reset-shortcuts-after-bug.json`.

### P2

3. **Project Settings modal does not restore focus to the opener after close.**

4. **Settings modal has no visible close button; New Project close icon lacks an accessible close label.**

### P3

5. **Some modal/project inputs use “Copenhagen Trip” as a generic placeholder, which feels oddly domain-specific in production.**

## Screenshots

- `01-baseline-home-1200x818.png`
- `02-project-workspace-1200x818.png`
- `03-project-more-menu-1200x818.png`
- `04-project-settings-modal-1200x818.png`
- `05-library-by-project-1200x818.png`
- `06-library-context-menu-1200x818.png`
- `07-add-to-project-submenu-1200x818.png`
- `08-add-to-project-remove-selected-1200x818.png`
- `09-add-to-project-submenu-960x680.png`
- `10-add-to-project-submenu-1440x900.png`
- `11-settings-external-agents-1440x900.png`
- `12-add-agent-dialog-1440x900.png`
- `13-settings-mcp-servers-1440x900.png`
- `14-settings-skills-1440x900.png`
- `15-settings-llm-provider-expanded-1440x900.png`
- `16-provider-health-failed-1440x900.png`
- `17-keyboard-shortcuts-1440x900.png`
- `18-shortcut-edit-triggered-search-bug.png`
- `19-dark-zh-settings-appearance-1440x900.png`
- `20-new-project-modal-1440x900.png`
- `21-new-project-created-1440x900.png`
- `22-sidebar-project-context-menu.png`
- `23-recent-task-context-menu.png`
- `24-workshop-installed-pack.png`
- `25-workshop-pack-context-menu.png`
- `26-atelier-modal-canvas.png`
- `27-library-960x680.png`
- `28-settings-960x680.png`
- `29-library-large-desktop-1600x1000.png`
- `30-packaged-app-screen.png`
- `31-packaged-app-after-wait.png`

## No-Mock / Secret Audit

Status: **PASS**

- Static scan found only tests, docs, honest “not implemented yet” copy, placeholders, and no user-facing fake execution claims.
- ACP/MCP statuses are recomputed by runtime and clear tools/capabilities instead of faking readiness.
- Provider API key is not displayed in the UI and `/settings/provider` returns only `apiKeyConfigured`.
- SQLite stores `apiKeyRef`, not the raw key: see `LOGS/19-settings-sqlite-provider.txt`.
- Seeded raw key appeared only in `runtime-data/secrets/provider_api_key.secret` and QA audit logs, which is expected.

## Blockers

- Real provider connectivity requires valid credentials and reachable provider.
- macOS global shortcut/tray/notification/Finder reveal flows require human/macOS interaction and permissions.
- Apple Developer ID signing/notarization was not available.
- Normal packaged Cmd+Q lifecycle cleanup was not fully validated because the app was launched as a direct executable from QA; direct SIGTERM cleanup was manually handled.

## Final Verdict

**Needs Claude fixes.** Most UX architecture changes are valid, but packaged event streaming is a release blocker and shortcut editing needs correction before the next QA pass.
