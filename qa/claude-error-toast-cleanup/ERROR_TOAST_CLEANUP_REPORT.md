# Global Error-Display Cleanup Report (2026-06-12)

## 1. Verdict

**PASS.**

## 2. Inline red errors removed (normal mode)

| Surface | Before | After |
|---|---|---|
| Composer (`composer.tsx`) | global store `error` (incl. persistent "Event stream unavailable.") + `uploadError` as red inline text | removed — both already surface as toasts (`YANSHI_RUNTIME_002`, `YANSHI_FILE_001`); composer stays clean |
| Project Files (`projects.tsx`) | whole list replaced by red `inline-error` | toast `YANSHI_FILE_002` + neutral empty state with a **Retry** button |
| Library (`library.tsx`) | red `loadError` line (duplicate of toast) | removed — neutral empty state; toast carries the error |
| Automations (`automations.tsx`) | red local error line (duplicate) | removed — toast `YANSHI_AUTOMATION_001` only |
| Workshop (`workshop.tsx`) | store error rendered red beside import; export failure as red status | import errors toast-only (`YANSHI_WORKSHOP_001/002`); export failure now toasts; success feedback stays muted |
| Shortcuts (`shortcuts-settings.tsx`) | persistent red "global shortcut failed" paragraph | neutral status badge (toast `YANSHI_SHORTCUT_002` already fires once) |
| ACP agent modal (`ai-integrations.tsx`) | red `lastError` paragraph | red **Error** status badge (existing) + muted one-line detail (`.error-detail`) |
| Provider modal (`ai-integrations.tsx`) | red health-failure paragraph | concise status badge (Ready/Error) + muted detail line; toast `YANSHI_PROVIDER_001/002` |

**Intentionally kept:** create-project modal inline validation (duplicate-name hint — contextual
form feedback, not an app error); chat-transcript failure messages (runtime conversation
content); Developer Mode raw events/diagnostics and the Developer → Runtime stream-status row;
honest setup states (Not implemented / permission badges — already neutral badges).

## 3. Error toast coverage

Unchanged 24-code registry from the previous pass covers every listed source; this pass added
routing for: project-files load (`YANSHI_FILE_002`) and workshop export (`YANSHI_WORKSHOP_001`).
All §3 codes from the brief exist or map: provider-test → `YANSHI_PROVIDER_002` (documented),
view-load failure → `YANSHI_UI_001`/`YANSHI_FILE_002` (catalog updated to say so). No new codes
needed; en/zh strings already present (偃师 in zh copy).

## 4. Accessibility

Unchanged from the toast system: `aria-live="assertive"` region, `role="alert"`, labeled
dismiss (关闭/Dismiss), Escape-dismiss, code chip ≠ color-only. Removing inline text does not
remove screen-reader access — the live region announces every error.

## 5. Files changed

`components/composer.tsx`, `features/projects.tsx`, `features/library.tsx`,
`features/automations.tsx`, `features/workshop.tsx`, `features/shortcuts-settings.tsx`,
`features/ai-integrations.tsx`, `styles.css` (`.load-retry`, `.error-detail`).

## 6. Docs changed

`docs/ERROR_CATALOG.md` (UI_001 view-load note), `docs/UI_INTERACTION_MODEL.md` (Errors section
already present — unchanged wording holds), CURRENT_STATUS / NEXT_STEPS / ACCEPTANCE_CHECKLIST /
IMPLEMENTATION_LOG, this report.

## 7. Commands run

`pnpm lint` PASS · `pnpm typecheck` PASS · `pnpm test` 41/41 (+10 live-office) · `pnpm build`
PASS · pytest 79/79 · cargo check / cargo test 11 PASS · `pnpm desktop:release` PASS (frontend
bundle changed, packaged artifact refreshed).

## 8. Manual smoke results

- Runtime killed mid-session: **no inline red anywhere** (`.inline-error`/`.status-text` count
  0; no "Event stream unavailable / 事件流不可用" text in the DOM); `YANSHI_RUNTIME_002`
  reported exactly once on the transition (structured console log confirmed; visible 8s toast
  rendering was demonstrated in the prior pass's provider smoke).
- Runtime restarted: stream recovered with **no stale red text and no stale toast**.
- Provider test failure (real dead endpoint): toast `YANSHI_PROVIDER_002` (zh) + concise 错误
  badge + muted detail in the modal; red paragraph gone.
- zh-CN verified throughout; Developer Mode diagnostics (console codes, raw events, runtime
  stream-status row) intact.

## 9. Remaining inline error displays

Only the intentional ones listed in §2 ("Intentionally kept"). No red page/component-level
error banners remain in normal mode.

## 10. Ready for Codex global review

**Yes** — suggested focus: error-toast UX coverage across surfaces, the removed-inline areas
(composer/library/automations/workshop/project-files neutral states + retry), provider/ACP
modal badge+detail pattern, stream kill/recovery behavior.
