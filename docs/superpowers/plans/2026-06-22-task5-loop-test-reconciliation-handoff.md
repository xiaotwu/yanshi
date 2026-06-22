# Task 5 Handoff — Reconcile the 32 tool-execution tests to the new ReAct loop

**For:** Codex (or whoever finishes the iterative-agent-loop work).
**Date:** 2026-06-22
**Branch:** `main` (commit directly to main; **do not push to origin** — that's the owner's call).
**Repo:** `/Users/xiaotwu/Code/yanshi` · Python pkg under `runtime/python` · venv at `runtime/python/.venv/bin/python`.
**Gate command:** `cd runtime/python && .venv/bin/python -m pytest -p no:cacheprovider -p no:warnings`
**Commit trailer (required):** `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`

---

## 1. Where we are

The core executor `runtime/python/yanshi_runtime/graph/runtime_graph.py` was rewritten from a linear
`manager → permission_gate → execute → finalizer` graph into a **bounded ReAct loop**:

```
START → decide
decide ─(route)→ permission_gate → decide        # action needs approval
       ─(route)→ act → decide                     # low-risk action; act loops back
       ─(route)→ finalizer → END                  # answer / budget exhausted / blocked / missing_model / cancelled
```

Commits already landed (in order):
- `5397b2d` GraphState loop fields + `maxAgentSteps` + `_provider_next_action`
- `435db8a` `_decide_node` + `_route_after_decide`
- `ccca463` `_act_node` (reuses `_execute_tool_assignment`, appends observation, increments step)
- `a669e56` cyclic `_build_graph` rewire + finalizer budget exhaustion
- `0d7cd7a` **port blocked/plan_first/approval/missing-model into the decide loop** ← current HEAD

**Current suite state: 122 passed / 32 failed.** All 32 failures are intentional and in scope for this
task. The 3 loop tests, the approval/blocked/missing-model driver tests, and everything else are green.

Design spec: `docs/superpowers/specs/2026-06-20-iterative-agent-loop-design.md`.
Plan: `docs/superpowers/plans/2026-06-20-iterative-agent-loop.md`.

### Decision already made by the owner (do not relitigate)
**Tool tasks require a configured provider.** There is no offline keyword shortcut. The old
`_direct_assignments_for_task` no-provider bypass was removed in `0d7cd7a`. No-provider runs now fail
honestly with `missing_model`. So every test that exercises a tool MUST seed a provider.

---

## 2. The new architecture you must test against

### `_decide_node(state) -> GraphState`  (~L527)
One-time setup on step 0 (ensure team, emit `run.started`, init `observations=[]`, `step=0`,
`max_steps = get_app_settings().maxAgentSteps` (default 8)). Then, **in this order**:
1. `decision = policy.decide(task, permission_mode)` on the **top-level task**.
2. **A — blocked (safety):** if `decision.blocked` → write `ReviewObservation`
   (`error="permission_boundary"`, `structuredOutput={"riskLevel":…,"blocked":True}`), return
   `blocked=True`, `next_action=None`. (Provider is never called.)
3. **B+C — approval:** `requires_approval = (not already_approved) and (decision.requires_approval or (plan_first and step==0))`.
   If so → `storage.create_approval(...)`, `storage.update_run(status="pending_approval", plan=…)`,
   return `approval_required=True`, `approval_id`, `next_action=None`.
   `already_approved = state.get("approved") is True` (set when resuming through the permission gate).
4. **D — missing provider:** if `not self.provider.configured` → explicit `model_not_configured`
   `ErrorObservation`, `missing_model=True`, `next_action=None`.
5. Otherwise call `_provider_next_action(task, observations, reasoning, project_id)`; on
   `ProviderCallError`/`ValueError`/`JSONDecodeError` → `provider_failed=True` + ErrorObservation.
   For an `assign` action, `risk_level` comes from `policy.decide(sub_task)`.

### `_route_after_decide(state)`  (~L605) — reads flags, never re-runs policy
Order: cancelled → finalizer; `blocked` → finalizer; `missing_model` → finalizer; `provider_failed` →
finalizer; `approval_required` → permission_gate; `next_action is None` → finalizer;
`action=="answer"` → finalizer; `step >= max_steps` → finalizer; else → **act**.

### `_act_node(state)`  (~L760) — thin
`result = _execute_tool_assignment(state, state["next_action"])`; append
`{"agentId":result["agent_id"],"ok":result["ok"],"summary":result["summary"]}` to `observations`;
`step += 1`. `_execute_tool_assignment` already does tool gating (`_tool_disabled_result` /
`_worker_tool_allowed`), the per-agent executor, the action/observation writes, actor updates, and the
cancel check. **`_act_node` does NOT currently set any run-level failure flag** — see §4 decision.

### `_route_after_permission(state)` → `"decide"` if approved (loops back so decide picks the action),
`"finalizer"` if `approved is False`.

### `_finalizer_node(state)`  (~L497)
`failed = blocked or approved is False or missing_model or provider_failed or tool_failed`. On
`answer` → `result_summary = next_action["text"]`. On budget exhaustion (`step >= max_steps`, action
not `answer`) → best-effort synthesis from observations prefixed with an honest "step limit" note,
status stays `completed`.

### `_provider_next_action(task, observations, reasoning, project_id) -> dict`  (~L1300)
One structured `chat_completion`. Returns **exactly one of**:
- `{"action":"answer","text":"<final answer>"}`
- `{"action":"assign","agentId":"<id>","task":"<task>"}` where `<id> ∈ {agent_file, agent_browser,
  agent_computer, agent_terminal}`.
Malformed/other action → `ValueError`.

---

## 3. The test fixture you'll use

`SequencedProvider` in `runtime/python/tests/test_runtime.py` (~L124):
```python
provider = SequencedProvider([
    '{"action":"assign","agentId":"agent_file","task":"List the files in the workspace."}',
    '{"action":"answer","text":"Scanned the workspace; found notes.txt."}',
], repeat_last=False)
service = client.app.state.runtime_service
service.provider = provider            # the graph reads self.provider
service.graph.provider = provider      # set BOTH (see the blocked test for precedent)
```
- `configured = True`, returns each canned string per `chat_completion` call, in order.
- `repeat_last=True` makes it return the last string forever (use for budget-exhaustion-style loops).
- `.calls` records every call (assert `provider.calls == []` to prove the provider was never reached).
- Runs execute **synchronously** inside the POST in the test client, so the whole loop finishes before
  `client.get(f"/runs/{id}")` returns.

**Migration recipe for a "do one tool then finish" test:** seed a 2-entry script — `assign` the right
agent on step 0, `answer` on step 1. The tool actually runs in `act` (real executor, real artifacts),
exactly like before; you're just supplying the manager's decisions.

Concrete example — `test_file_scan_uses_real_workspace` (currently no provider → `missing_model`):
add the two-step provider above before `client.post("/runs", …)`. The file executor still writes
`latest-file-scan.json`; the assertions about `scanned` / `notes.txt` stay valid.

---

## 4. ⚠️ One real design decision — tool-failure / hard-gate semantics

The tool-**gating** tests expect run status `failed`:
`test_disabled_terminal_tool_returns_tool_disabled`, `test_disabled_browser_tool_returns_tool_disabled`,
`test_disabled_computer_tool_returns_tool_disabled`,
`test_global_toggle_off_blocks_regardless_of_whitelist`,
`test_worker_whitelist_excludes_tool_blocks_with_honest_error`,
`test_docker_run_rejects_invalid_persisted_settings`.

In the new loop, `_execute_tool_assignment` returns `ok=False` with a `tool_disabled` observation, but
`_act_node` just appends that observation and loops back to `decide` — **nothing sets `tool_failed`**,
so the manager would simply `answer` and the run would report `completed`. The old `_execute_node` set
`tool_failed = bool(failed_results)`, which is how those runs used to fail.

**You must decide and implement one of:**
- **(Recommended) Hard-gate → fail.** When `_execute_tool_assignment` fails because of a *hard gate*
  (`tool_disabled`, `_worker_tool_allowed` block — i.e. the user/policy forbade the tool, not a
  transient runtime error), have `_act_node` set `tool_failed=True` (or route straight to finalizer)
  so the run fails honestly with the existing `tool_disabled` observation. Distinguish this from a
  *soft* runtime error the manager could route around. Simplest faithful-to-old-behavior option;
  keeps the 6 gating tests asserting `failed` without weakening them.
- **(Alternative) Soft observation → manager adapts.** Let the failed observation flow back; the manager
  answers honestly ("the terminal tool is disabled, so I couldn't run that") and the run is
  `completed`. More "ReAct-pure" but you must then **rewrite** those 6 tests to assert the honest
  completed answer + the `tool_disabled` observation (NOT just flip them to green — the disabled-tool
  observation and agent_task `failed` status must still be asserted). Do not fake-pass.

Pick one, write it down in the commit message, and keep failures honest (status-driven, never
keyword-guessed). If unsure, do the Recommended option.

---

## 5. The 32 failing tests, grouped

**Group A — seed a provider (assign→answer), tool still really runs (~20):**
`test_file_scan_uses_real_workspace`, `test_file_upload_copies_into_workspace_and_is_scannable`,
`test_artifacts_endpoint_lists_created_artifacts`, `test_browser_run_records_real_action_observation_and_artifact`,
`test_browser_summary_uses_provider_after_real_page_observation`,
`test_computer_click_run_persists_bridge_action_observation`, `test_computer_screen_capture_run_records_artifact`,
`test_terminal_run_records_action_observation_and_stdout`, `test_docker_run_records_terminal_log_artifact`,
`test_docker_run_uses_persisted_developer_settings`, `test_runs_execute_on_the_worker_pool`,
`test_agent_instances_and_actors_persist_and_update`, `test_project_run_uses_project_workspace_and_filters_runs`,
`test_project_run_uses_project_team_persona_in_file_action`,
`test_agent_profile_persona_in_file_agent_execution_context`,
`test_agent_profile_persona_in_terminal_and_computer_context`, `test_automation_crud_and_manual_run`,
`test_plan_first_forces_approval_then_resumes` (seed a provider so it *completes* after approval),
`test_follow_up_run_threads_and_carries_conversation_history` (multi-turn; seed per turn).

**Group B — multi-step / synthesis shape changed (~6):** these used the old plan-JSON SequencedProvider
format (`{"plan":[…],"assignments":[…]}`) and assert the old manager/reviewer synthesis. Re-seed with
the new `assign…/answer` decisions and update the synthesis assertions to the loop's finalizer output:
`test_multi_agent_executor_runs_queued_browser_file_and_manager_synthesis`,
`test_failed_agent_task_is_reviewed_without_fake_success`,
`test_configured_provider_call_creates_message_observation`,
`test_reasoning_level_and_profile_affect_manager_prompt` (assert the new
`_provider_next_action` system prompt — see §2 — not the old manager-plan prompt),
`test_per_worker_model_override_manager`, `test_per_worker_model_none_inherits_default`
(the per-偃师 `model` override is still read by `_provider_next_action` via
`get_project_agent_profile(project_id,"manager").model` — assert that on `provider.calls`/the model arg).

**Group C — tool-gating, blocked by §4 decision (6):** `test_disabled_terminal_tool_returns_tool_disabled`,
`test_disabled_browser_tool_returns_tool_disabled`, `test_disabled_computer_tool_returns_tool_disabled`,
`test_global_toggle_off_blocks_regardless_of_whitelist`,
`test_worker_whitelist_excludes_tool_blocks_with_honest_error`,
`test_docker_run_rejects_invalid_persisted_settings`. Resolve §4 first, then seed a provider that
`assign`s the gated tool so `act` reaches the gate.

**Group D — keyless local provider (1):** `test_keyless_local_provider_is_configured_and_sends_no_auth`
uses a configured keyless provider but the old plan-JSON format; re-seed with the new decision format
and keep the "sends no auth header" assertion.

(Counts are approximate; trust the actual `pytest` output, not the grouping.)

---

## 6. Also in scope: remove the dead linear-graph nodes (after proving them unused)

These are no longer wired into `_build_graph` and should be removed once you confirm nothing references
them (grep the whole repo, not just the test file):
`_manager_node`, `_execute_node`, `_route_after_manager`, `_route_after_permission`'s old `"execute"`
literal (already changed), `_build_agent_plan`, `_direct_assignments_for_task`, and—if unused after the
loop migration—`_execute_manager_assignment` / `_execute_reviewer_assignment` /
`_summarize_agent_results` / `_deterministic_synthesis` / `_can_run_without_model` / `_looks_like_file_list`.
**Caution:** `_execute_tool_assignment` and the per-agent `_execute_{file,browser,computer,terminal}_assignment`
executors ARE still used by `_act_node` — keep them. Remove dead code in its own commit, after the
tests are green, and re-run the full suite to confirm nothing depended on it.

---

## 7. Optional follow-up (not required to close Task 5)

**Per-action approval defense-in-depth.** Today the approval/blocked gate is evaluated on the
*top-level task* (matching the old `_manager_node`; the `test_approval_pause_and_resume` contract
requires gating *before* any provider call, so this is correct and not a regression). The design spec
§4.4 also envisions gating each *assigned sub-action*. Adding a post-`_provider_next_action` check that
runs `policy.decide(sub_task)` for `.blocked`/`.requires_approval` (with `approved` consumed per `act`
step) would catch a manager that escalates to a high-risk action under a benign-looking top-level task.
Pure addition; don't let it break the no-provider approval tests (they never reach the provider).

---

## 8. Definition of done

- Full suite green: `cd runtime/python && .venv/bin/python -m pytest -p no:cacheprovider -p no:warnings`
  (target: 0 failed; the count will exceed the old 150 because of the new loop/safety tests).
- No fake-passing: every gating/failure test still asserts the honest observation + status; no test was
  weakened just to go green. The §4 decision is implemented and stated in a commit message.
- Dead linear-graph nodes removed in a separate commit, suite still green.
- (If you ran a real provider) optionally re-run the eval harness as an end-to-end sanity check:
  `runtime/python/yanshi_runtime/evals/run_evals.py` (it exits honestly when no provider is configured).
- Commits direct to `main`, each with the `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`
  trailer. **Do not push to origin.**
