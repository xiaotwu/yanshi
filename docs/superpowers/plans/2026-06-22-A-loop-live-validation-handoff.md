# Handoff A — Validate the ReAct loop live + run the eval harness

**For:** Codex, in `/Users/xiaotwu/Code/yanshi` on `main`. **Do not push to origin.**
**venv:** `runtime/python/.venv/bin/python` · **trailer:** `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`

## Why
The new bounded-ReAct executor (`runtime/python/yanshi_runtime/graph/runtime_graph.py`,
`decide → act → decide … → finalizer`) is unit-complete (152 pytest pass) but has only ever run
against *fake* providers. The design spec required validating it against the now-fixed eval baseline
with a **real** provider (the `net_guard` `::1` loopback bug that broke localhost Ollama is fixed in
commit `3531713`). This handoff is that end-to-end proof. It is **validation, not feature work** — if it
surfaces a real bug, write it up and stop; don't paper over it.

## Preconditions (owner must have these running)
- A local provider reachable, e.g. **Ollama** at its default localhost endpoint, with at least one model
  pulled. Yanshi reads provider config from `~/.yanshi` (provider key, if any, lives in the SecretStore,
  never in SQLite/logs).
- If no provider is configured/reachable, the eval runner exits honestly ("No model provider is
  configured…") — that's expected, not a pass.

## Steps
1. **Eval harness (deterministic baseline).**
   `cd runtime/python && .venv/bin/python evals/run_evals.py`
   - Cases: `runtime/python/evals/cases.jsonl`. Scorer: `evals/scorer.py` (`score_case`, status-driven —
     checks `agentUsed`/`toolUsed`/expected text, never keyword-guesses success). Report written to
     `evals/last_report.json`.
   - Record passed/total and any failed case (case id + why). A failed case = a real loop regression to
     investigate with systematic-debugging, not to silence.
2. **Live multi-step run (proves tool result feed-back).** With the server running against the real
   provider, POST a task that *requires a tool then a synthesis*, e.g.
   `{"task": "List the files in my workspace, then tell me how many there are."}`.
   Confirm via the run/events API: `run.started` → a `decide` provider call → an `agent_file` action +
   `FileObservation` (the `act` step) → a second `decide` that **sees that observation** → an `answer`
   → `run.completed` with a sensible `resultSummary`. The key property to confirm is **observation
   feed-back**: step-2's decision was made with step-1's observation in context.
3. **Honest-failure spot checks (no fakes).**
   - No-provider run → status `failed` with the `model_not_configured` observation.
   - A `tool_disabled` task (e.g. terminal while `terminalToolEnabled=false`) → status `failed` (hard
     gate), `tool_disabled` observation present.
   - A budget-exhaustion task (set `maxAgentSteps` low, give a task the model keeps assigning on) →
     status `completed` with an honest "step limit" note (best-effort), not a fake success.
4. **Cancel mid-loop** (optional): start a multi-step run, hit the cancel endpoint, confirm the run is
   left `cancelled` (not overwritten to completed/failed) and no further `act` steps ran.

## Done
- A short `docs/superpowers/notes/2026-06-22-loop-live-validation-results.md` capturing: eval
  passed/total, the live-run event trace summary (proving feed-back), and the honest-failure checks.
- If everything holds: state plainly that the loop is validated end-to-end against a real provider.
- If a real bug appears: capture the repro + the failing trace and stop for the owner — do not work
  around it. Commit only the notes file (+ any genuine fix, TDD'd) with the trailer; no push.
