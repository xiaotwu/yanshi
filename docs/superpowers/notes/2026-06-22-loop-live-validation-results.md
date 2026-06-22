# 2026-06-22 Loop Live Validation Results

Status: failed validation; stopped after the eval harness failure.

## Environment

- Repo: `/Users/xiaotwu/Code/yanshi` on `main`.
- Command: `cd runtime/python && .venv/bin/python evals/run_evals.py`.
- Configured provider from `~/.yanshi/yanshi.db`: `http://localhost:11434/v1`.
- Configured model: `qwen3.5:latest`.
- Ollama was reachable at `127.0.0.1:11434`; `/api/tags` listed `qwen3.5:latest`.

## Eval Harness

The harness did reach the real provider, but it did not pass:

```text
provider call transient failure (ReadTimeout); retrying in 0.5s
[FAIL] math_basic - status was 'failed', expected completed; missing substring '4'
[PASS] knowledge_capital
[PASS] greeting

2/3 passed
```

`runtime/python/evals/last_report.json` reported the same `2/3` result.

## Failure Trace

- Failed case: `math_basic`.
- Run id: `run_d163fd711ae74c45b3`.
- Task: `What is 2+2? Reply with just the number.`
- Run window: `2026-06-22T20:25:25.824315+00:00` to `2026-06-22T20:39:56.412772+00:00`.
- Stored final status: `failed`.
- Stored result summary: `Manager could not decide next action: Provider next_action 'answer' must include a string 'text' field.`

Stored event sequence for the failed run:

1. `run.created`
2. `run.started`
3. `action.created` for manager `PlanAction`
4. `action.failed` for that `PlanAction`
5. `observation.created` with `type=ErrorObservation`, `agent=agent_manager`, `error=manager_plan_failed`
6. reviewer failure explanation
7. `run.failed`

No tool `act` step ran for this case. The failure occurred in the first manager `decide` call, before any observation feed-back could be validated.

The terminal output also showed a provider `ReadTimeout` before the stored malformed-action failure. The raw provider response is not persisted in the run/event tables, so the exact malformed payload is not available from storage.

## Live Checks

The live multi-step run, honest-failure spot checks, and optional cancel check were not run. The handoff says a failed eval case is a validation failure to capture rather than work around, so validation stopped here.

## Conclusion

The bounded ReAct loop is not validated end to end against the configured live Ollama provider in this run. Repro:

```bash
cd runtime/python && .venv/bin/python evals/run_evals.py
```

No code fix was attempted.

## Resolution (2026-06-22)

Root cause (systematic-debugging): the task "Reply with just the number" made qwen3.5 return
`{"action":"answer","text":4}` — `text` was the JSON **integer** `4`, not a string.
`_provider_next_action` rejected it with a strict `isinstance(text, str)` check
(runtime_graph.py:1117), even though the sibling `assign` branch already `str()`-coerces its `task`
field. A legitimate numeric answer was treated as malformed → `provider_failed` → run failed. The
preceding `ReadTimeout` was a transient the retry absorbed; it was not the cause.

Fix: coerce scalar `text` (int/float/bool) to `str`; still reject genuinely-malformed text
(None/missing or non-scalar dict/list). Driven by a failing unit test that reproduces the exact
`math_basic` payload (`{"action":"answer","text":4}` → `{"action":"answer","text":"4"}`). Full suite:
153 passed.

Follow-ups (optional, not done here): the run/event tables still don't persist the raw provider
response, which made this harder to diagnose — consider storing a truncated raw payload on
`manager_plan_failed` ErrorObservations. Re-run `evals/run_evals.py` against live Ollama to confirm
`math_basic` now passes end to end.
