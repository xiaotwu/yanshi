# Yanshi Current Status

_Last updated: 2026-06-23._

## What Works

- **Bounded ReAct loop** (`graph/runtime_graph.py`): provider decides one `answer` or one tool `assign`; tool observations feed the next decide step; finalizer handles answer / budget-exhaustion / failure / cancel.
- **Validated live** against a real Ollama provider (not just fakes): eval harness 3/3, multi-step observation feed-back, honest no-provider / tool-disabled / budget-exhaustion failures. See `docs/superpowers/notes/2026-06-22-loop-live-validation-results.md`. Two real robustness bugs found and fixed along the way (scalar-answer coercion `cc61c9d`; raw-response capture `fab6347`).
- **No-provider shortcuts removed**; missing provider surfaces `model_not_configured`. Disabled tools, worker-whitelist blocks, and invalid Docker settings fail runs honestly with structured observations (hard-gate `tool_failed`).
- **Per-action approval/blocked defense-in-depth** (`8859b4b`): the manager's actual assigned sub-action is risk-gated, not just the top-level task; escalation under a benign task is caught; `approved` is consumed per action.
- **MCP tools callable inside the loop** (`bfa3e7b`): `agent_mcp` assignments call `tools/call`; only live connected/ready tools are advertised; unavailable tool/transport = hard fail, MCP `isError` = soft (manager adapts).
- **ACP agents callable inside the loop** (`aefdd1f`): `agent_acp` delegates one sub-step via `new_session`/`prompt`; hard-gates on unavailable/transport/empty response. The existing whole-task external-agent route is untouched.
- **Release/owner plumbing scaffolded** (`48bac53`): release CI fails loudly without Apple signing/notarization secrets; updater check + crash reporter are present but **disabled until configured**, with payload scrubbing. No credentials stored.
- Follow-up runs pass conversation history into the manager decision.

## Test Status (green)

- Runtime Python: `166 passed` (`cd runtime/python && .venv/bin/python -m pytest -p no:cacheprovider -p no:warnings`).
- Desktop: `pnpm --filter @yanshi/desktop test` → 92 passed; `typecheck` → pass; `build` → pass (existing Vite chunk-size warning); `cargo check`/`cargo test` (src-tauri) → pass / 12 passed.

## What Does Not Work / Not Yet Done

- **Owner-credentialed runs only** (cannot be done by an agent — require the owner's secrets):
  - Apple Developer ID signing + notarization release run (scaffold + runbook ready in `release.yml` / `docs/BUILD_AND_RELEASE.md`).
  - Auto-update feed + updater keypair, and crash-reporting DSN — supply these to activate the scaffolded features.
- Deferred (out of scope, noted): per-偃师 MCP/ACP tool whitelist.
- Watch-item (no repro, instrumented): a `ReadTimeout` truncating long reasoning-model decisions can yield "Provider did not return a JSON object" — the captured `rawResponse` will reveal it if it recurs; the real fix would be on the provider timeout/streaming side.

## Current Branch

- `main`, ahead of `origin/main` (~71 commits), **not pushed** (per owner instruction).

## Current Blockers

- None in code. Remaining work is owner-credentialed (above).
