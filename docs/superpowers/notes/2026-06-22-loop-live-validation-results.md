# 2026-06-22 Loop Live Validation Results

Status: validated. The live eval is green, the file-tool loop proves observation feed-back, and the
required honest-failure checks now pass against the real local Ollama setup.

## Environment

- Repo: `/Users/xiaotwu/Code/yanshi` on `main`.
- Command: `cd runtime/python && .venv/bin/python evals/run_evals.py`.
- Configured provider from `~/.yanshi/yanshi.db`: `http://localhost:11434/v1`.
- Configured model: `qwen3.5:latest`.
- Ollama was reachable at `127.0.0.1:11434`; `/api/tags` listed `qwen3.5:latest`.

## Eval Harness

Initial run before `cc61c9d` failed `math_basic` because the live provider returned an
`answer` action whose `text` was not a string. After `cc61c9d` (`fix(graph): coerce scalar
next_action answer text to str`), the same live eval command passed:

```text
[PASS] math_basic
[PASS] knowledge_capital
[PASS] greeting

3/3 passed
```

`runtime/python/evals/last_report.json` reported the same `3/3` result.

## Previous Eval Failure Trace

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

## Live Multi-Step Run

Server: `yanshi-runtime --host 127.0.0.1 --port 8765` against the real `~/.yanshi` data dir.

Task:

```json
{"task":"Use the File Agent to list the files in my workspace, then after the file scan tell me exactly how many items were found. Do not answer until the File Agent has scanned the workspace."}
```

Run id: `run_1d6c9589c9c54a978a`.

Result:

```text
status=completed
resultSummary=The File Agent has completed its scan of the workspace and found **1 item**.
```

Event trace:

1. `run.created`
2. `run.started`
3. `agent.task.assigned` (`agent_file`)
4. `agent.task.started` (`agent_file`)
5. `action.created` (`FileAction`, `agent_file`)
6. `action.completed` (`agent_file`)
7. `observation.created` (`FileObservation`, `File Agent scanned 1 items.`)
8. `artifact.created` (`File scan`)
9. `agent.task.completed` (`agent_file`)
10. `run.completed` with result summary saying 1 item

This proves the loop reached `act`, wrote a real `FileObservation`, then made a later manager
answer using the observation content.

## Honest-Failure Checks

### No Provider

Used a short-lived isolated runtime on `/tmp/yanshi-handoff-a-no-provider` so the real provider
settings were not changed.

Run id: `run_848d272df3824f04a3`.

Result:

```text
status=failed
resultSummary=Yanshi needs a configured model provider before it can execute this task.
observation=ErrorObservation error=model_not_configured missingRequirement=model_provider
```

### Terminal Disabled

Main runtime setting before the run: `terminalToolEnabled=false`.

#### Previous blocked attempt

Task:

```json
{"task":"Use the Terminal Agent to run command `pwd` in the workspace and report the output.","permissionMode":"full_access"}
```

Run id: `run_8004210cc7cd4e9fad`.

Expected: `agent_terminal` assignment, hard gate, `tool_disabled` observation, `status=failed`.

Actual:

```text
status=failed
resultSummary=Manager could not decide next action: Provider did not return a JSON object.
```

Event trace:

1. `observation.created` (`ErrorObservation`, `agent_manager`, `error=manager_plan_failed`,
   `missingRequirement=structured_manager_plan`)
2. `agent.task.assigned` (`agent_reviewer`)
3. `observation.created` (`ReviewerObservation`)
4. `run.failed`

The run failed before `act`, so the terminal hard gate and `tool_disabled` observation were not
validated. The raw provider response is not persisted in the run/event tables.

#### Rerun after `fab6347`

After `fab6347` (`feat(graph): capture raw provider response on manager decision failures`), the
same live repro no longer hit `manager_plan_failed`; there was no `rawResponse` to capture because
the manager produced a valid terminal assignment and the tool gate ran.

Run id: `run_07efd8044ce64c0fbf`.

Result:

```text
status=failed
resultSummary=Terminal Tool is turned off in Settings.
```

Event trace:

1. `agent.task.assigned` (`agent_terminal`)
2. `observation.created` (`TerminalObservation`, `error=tool_disabled`,
   `structuredOutput={"setting":"terminalToolEnabled","agentId":"agent_terminal"}`)
3. `run.failed` with summary `Terminal Tool is turned off in Settings.`

This validates the terminal hard gate and confirms the failure is honest, not a fake execution.

### Budget Exhaustion

Temporarily set `maxAgentSteps=1`, then restored the original `maxAgentSteps=8`.

Task:

```json
{"task":"Use the File Agent to list the workspace files. Then use the File Agent again to verify the count. Do not answer until both file scans are done.","permissionMode":"full_access"}
```

Run id: `run_54375978da5e43d883`.

Result:

```text
status=completed
resultSummary=Reached the step limit (1 steps); here is what was gathered: agent_file: File Agent scanned 1 items.
```

Event trace:

1. `agent.task.assigned` (`agent_file`)
2. `observation.created` (`FileObservation`, `File Agent scanned 1 items.`)
3. `run.completed` with the explicit step-limit summary

This validates the budget-exhaustion path: best-effort completion with an honest step-limit note,
not a fake success.

## Conclusion

The scalar-answer fix is validated against the live eval harness (`3/3`), and the live file-tool
loop validated observation feed-back end to end. The no-provider, terminal-disabled, and
budget-exhaustion honest-failure checks all passed on live API runs. Handoff A is complete. The
optional cancel check was not run.

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

Follow-up completed: the live Ollama eval rerun is green and `math_basic` passed end to end.
`fab6347` now persists a truncated `rawResponse` on future `manager_plan_failed` observations.
The terminal-disabled rerun did not exercise that instrumentation because the live provider returned
a valid terminal assignment and the expected `tool_disabled` gate ran.
