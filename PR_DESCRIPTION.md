# Yanshi Runtime Loop + Release Scaffold

## Summary

- Rewrites the runtime executor around the bounded ReAct loop: `decide -> act -> decide -> finalizer`, with honest terminal states instead of scaffolded success.
- Validates the loop live against a real local provider, including observation feed-back, no-provider failure, disabled-tool hard gates, and step-budget exhaustion.
- Fixes two live-validation bugs: scalar `answer.text` coercion and raw provider response capture for malformed manager decisions.
- Adds per-assigned-action approval/blocking so escalated sub-actions are checked, not only the top-level chat request.
- Wires MCP tool calls and ACP agent delegation into the ReAct loop with live-only advertisement and hard failure for unavailable integrations.
- Adds owner-only release scaffolding: fail-loud Apple signing/notarization secret guard, manual unsigned workflow dry run, env-driven updater config, and disabled-until-configured crash reporting.

## Credential Boundary

- No Apple credentials, updater private key, or crash DSN are committed.
- The release workflow dry run uses `workflow_dispatch` with `dry_run=true` to build and validate unsigned artifacts before the owner adds secrets.
- Real signing/notarization, updater private key, feed hosting, crash DSN setup, push, and PR creation remain owner actions.

## Test Gates

- `cd runtime/python && .venv/bin/python -m pytest -p no:cacheprovider -p no:warnings` -> `166 passed`
- `pnpm --filter @yanshi/desktop test` -> `21 passed`, `94 tests passed`
- `pnpm --filter @yanshi/desktop typecheck` -> passed
- `pnpm --filter @yanshi/desktop build` -> passed; Vite reported existing dynamic-import/chunk-size warnings
- `cd apps/desktop/src-tauri && cargo check` -> passed
- `cd apps/desktop/src-tauri && cargo test` -> `12 passed`
- `node --test scripts/write-tauri-release-config.test.mjs` -> `4 passed`
- `.github/workflows/release.yml` parsed successfully with Ruby/Psych
- Dry-run generated Tauri config smoke passed with no macOS signing identity
