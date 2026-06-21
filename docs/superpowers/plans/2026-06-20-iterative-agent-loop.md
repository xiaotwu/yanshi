# Iterative Agent Loop (bounded ReAct) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the plan-once executor with a bounded ReAct loop (`decide → act → decide → finalizer`): each `decide` is one structured provider call choosing the next single action or a final answer, with tool results fed back into the next decision and a `max_steps` cap.

**Architecture:** A cyclic LangGraph: `decide` picks the next action (assign one tool-agent) or answers; `act` runs that one assignment via the EXISTING `_execute_tool_assignment` and loops back to `decide`; `finalizer` writes the answer (or a budget-exhausted best-effort answer). Only the control flow changes — the per-agent executors, tool gating, permission gate, cancellation, partial streaming, project/per-偃师 personas+model, and finalizer writes are reused verbatim.

**Tech Stack:** Python 3.12, LangGraph (StateGraph with cycles), the existing OpenAICompatible/Anthropic provider abstraction; pytest with injected fake providers.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-06-20-iterative-agent-loop-design.md`.
- **Only the control flow changes.** Reuse verbatim: `_execute_tool_assignment` + the per-agent executors, `_tool_disabled_result`/`_worker_tool_allowed`, the `permission_gate` node, `request_cancel`/`_is_cancelled`, the partial buffer, `_agent_persona(.., project_id)`/`_worker_model`, all storage writes/events, the provider abstraction.
- **Bounded:** `max_steps` (default **8**, from `AppSettings.maxAgentSteps`) is a hard cap; `act → decide` is the only cycle. Each step checks `_is_cancelled`.
- **Backward-compat & cost:** a no-tool task answers on step 1 → exactly **1** provider call. Failure is decided by state flags / status — never keyword-guessed. A budget-exhausted answer is an honest best-effort with an explicit "reached the step limit" note; nothing fakes completion. `cancelled` runs stay cancelled (existing finalizer path).
- **Assignable actions are tool-agents only** (`agent_file|browser|computer|terminal`); synthesis/review is the manager's `answer` decision, not a separate assignable action.
- Provider-failure/malformed-decision falls back honestly (mirror the existing `_manager_node` plan-failure path: `provider_failed`, ErrorObservation, → finalizer).
- pytest: `cd runtime/python && .venv/bin/python -m pytest -p no:cacheprovider`. Commit messages end with `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.
- **STOP-and-align rule (spec §9):** if the new topology breaks many existing tests in non-trivial ways (beyond the reconciliation in Task 5), STOP and report — do not weaken tests to force green.

---

### Task 1: State + `maxAgentSteps` setting + `_provider_next_action` (the decide call)

**Files:**
- Modify: `runtime/python/yanshi_runtime/graph/runtime_graph.py` (`GraphState` ~L28-46; add `_provider_next_action`)
- Modify: `runtime/python/yanshi_runtime/models.py` (`AppSettings.maxAgentSteps: int = 8`)
- Test: `runtime/python/tests/test_runtime.py`

**Interfaces:**
- Consumes: the existing structured provider-call pattern in `_provider_agent_plan` (read it — same JSON-extraction/parse + `_agent_persona(agent_id, project_id)` + `_worker_model`), `self.provider.chat_completion`.
- Produces:
  - `GraphState` gains `observations: list[dict]`, `step: int`, `max_steps: int`, `next_action: dict | None`.
  - `AppSettings.maxAgentSteps: int = 8`.
  - `RuntimeGraph._provider_next_action(self, task: str, observations: list[dict], reasoning: str, project_id: str | None) -> dict` returning EITHER `{"action": "answer", "text": str}` OR `{"action": "assign", "agentId": str, "task": str}`. Raises `ValueError`/`json.JSONDecodeError` on malformed output (caller falls back), `ProviderCallError` on connectivity (propagates).

- [ ] **Step 1: Add the GraphState fields + setting.** In `runtime_graph.py` `GraphState` (TypedDict, `total=False`) add:

```python
    observations: list[dict[str, Any]]
    step: int
    max_steps: int
    next_action: dict[str, Any] | None
```

In `models.py` `AppSettings`, add `maxAgentSteps: int = 8` (place near the other agent/runtime settings; confirm there's a matching field in any `AppSettingsUpdate` if the codebase mirrors update models — match the existing pattern for a defaulted int setting).

- [ ] **Step 2: Write the failing test** (inject a fake provider that returns a JSON decision):

```python
def test_provider_next_action_parses_answer_and_assign(tmp_path: Path) -> None:
    from yanshi_runtime.graph import RuntimeGraph
    # Build a graph with a fake provider that echoes a canned decision.
    class _DecideProvider:
        configured = True
        public_base_url = None
        model = "m"
        def __init__(self, payload): self._payload = payload
        def update_config(self, c): ...
        def list_models(self): return []
        def healthcheck(self): ...
        def chat_completion(self, messages, model=None): return self._payload
        def stream_chat_completion(self, messages, model=None):
            yield self._payload

    from yanshi_runtime.storage import Storage
    storage = Storage(tmp_path / "db.sqlite", "test")
    graph = RuntimeGraph(storage=storage, checkpoint_path=tmp_path / "cp.sqlite", workspace_root=tmp_path / "ws", provider=_DecideProvider('{"action":"answer","text":"42"}'))
    out = graph._provider_next_action("q", observations=[], reasoning="medium", project_id=None)
    assert out == {"action": "answer", "text": "42"}

    graph.provider = _DecideProvider('{"action":"assign","agentId":"agent_file","task":"list files"}')
    out2 = graph._provider_next_action("q", observations=[], reasoning="medium", project_id=None)
    assert out2["action"] == "assign" and out2["agentId"] == "agent_file"
```

(Confirm `RuntimeGraph.__init__`'s exact kwargs against the real signature — `storage=`, `checkpoint_path=`, `workspace_root=`, `provider=` — and how existing tests construct it; reuse that construction.)

- [ ] **Step 3: Run to verify it fails** — `… -k provider_next_action` → FAIL.

- [ ] **Step 4: Implement `_provider_next_action`** — mirror `_provider_agent_plan`'s structured-call mechanics (read it first for the exact message-building, the `_agent_persona`/`_worker_model` use, and the JSON-extraction helper it relies on). The prompt instructs the manager to reply with ONE JSON object: either `{"action":"answer","text":...}` (when it can answer now) or `{"action":"assign","agentId":"agent_file|agent_browser|agent_computer|agent_terminal","task":...}` (to gather more via a tool). Include the accumulated `observations` (each step's `agentId`+`summary`, truncated) so the decision sees prior results. Parse the JSON (reuse the same extraction `_provider_agent_plan` uses); validate `action` ∈ {answer, assign}, and for `assign` that `agentId` ∈ the four tool agents and `task` is a non-empty str — else raise `ValueError`. Use the run's project model/persona via the same helpers `_provider_agent_plan` uses.

- [ ] **Step 5: Run → PASS; full suite green.**
- [ ] **Step 6: Commit** — `feat(graph): GraphState loop fields + maxAgentSteps + _provider_next_action`.

---

### Task 2: `_decide_node` + `_route_after_decide`

**Files:**
- Modify: `runtime/python/yanshi_runtime/graph/runtime_graph.py`
- Test: `runtime/python/tests/test_runtime.py`

**Interfaces:**
- Consumes: `_provider_next_action` (Task 1); `self.policy.decide`; `self.storage.ensure_agent_team`/`get_run`; `_project_id_for`; `self._is_cancelled`; the existing `_manager_node`'s setup (run.started event, team ensure) and its provider-failure ErrorObservation path (reuse the same storage calls).
- Produces:
  - `RuntimeGraph._decide_node(self, state: GraphState) -> GraphState` — on the first step does the one-time setup (ensure team, `run.started`, init `observations=[]`, `step=0`, `max_steps` from settings); calls `_provider_next_action`; sets `state["next_action"]` and `state["risk_level"]` (via `policy.decide` on the assigned task). On `ProviderCallError`/malformed → set `provider_failed=True` + write the ErrorObservation (mirror `_manager_node`'s failure path) + `next_action=None`.
  - `RuntimeGraph._route_after_decide(self, state) -> Literal["permission_gate","act","finalizer"]` — `finalizer` if cancelled, `provider_failed`, `next_action is None`, `next_action["action"]=="answer"`, or `state["step"] >= state["max_steps"]`; else for an `assign`: `permission_gate` when the action needs approval (reuse the same approval-required logic `_route_after_manager` used), otherwise `act`.

- [ ] **Step 1: Write the failing tests** (unit-test routing without running the whole graph):

```python
def test_route_after_decide(tmp_path: Path) -> None:
    from yanshi_runtime.graph import RuntimeGraph
    from yanshi_runtime.storage import Storage
    storage = Storage(tmp_path / "db.sqlite", "test")
    graph = RuntimeGraph(storage=storage, checkpoint_path=tmp_path / "cp.sqlite", workspace_root=tmp_path / "ws", provider=_NullProvider())
    base = {"run_id": "r", "step": 0, "max_steps": 8, "permission_mode": "default", "approval_required": False}
    assert graph._route_after_decide({**base, "next_action": {"action": "answer", "text": "x"}}) == "finalizer"
    assert graph._route_after_decide({**base, "next_action": {"action": "assign", "agentId": "agent_file", "task": "t"}}) == "act"
    assert graph._route_after_decide({**base, "step": 8, "next_action": {"action": "assign", "agentId": "agent_file", "task": "t"}}) == "finalizer"
    assert graph._route_after_decide({**base, "provider_failed": True, "next_action": None}) == "finalizer"
```

(`_NullProvider` = a minimal provider with `configured=False` etc.; reuse an existing test null/fake provider if one exists, e.g. `OpenAICompatibleProvider(None)`.)

- [ ] **Step 2: Run to verify it fails.**
- [ ] **Step 3: Implement `_decide_node` + `_route_after_decide`** (per the Interfaces above; reuse `_manager_node`'s setup + failure-path storage calls verbatim — move that code, don't duplicate it). The approval-required decision reuses whatever `_route_after_manager`/`_permission_gate_node` already use so high-risk actions still gate identically.
- [ ] **Step 4: Run → PASS; full suite (decide/route not yet wired into the graph, so existing graph tests still use the old nodes — they stay green).**
- [ ] **Step 5: Commit** — `feat(graph): _decide_node + _route_after_decide`.

---

### Task 3: `_act_node`

**Files:**
- Modify: `runtime/python/yanshi_runtime/graph/runtime_graph.py`
- Test: `runtime/python/tests/test_runtime.py`

**Interfaces:**
- Consumes: the EXISTING `_execute_tool_assignment(state, assignment) -> AgentExecutionResult` (gate + executor + observation write + actor update + cancel); `state["next_action"]`.
- Produces: `RuntimeGraph._act_node(self, state) -> GraphState` — runs `result = self._execute_tool_assignment(state, state["next_action"])`, appends a compact observation `{"agentId": result["agent_id"], "ok": result["ok"], "summary": result["summary"]}` (+ key structured fields, truncated) to `state["observations"]`, increments `state["step"]`, and returns the updated state. (The edge `act → decide` loops back.)

- [ ] **Step 1: Write the failing test** — drive `_act_node` directly with a real (synchronous) run + a known tool assignment and assert the observation is appended and `step` incremented. Use a file-agent assignment that the file executor handles deterministically (mirror an existing `_execute_file_assignment` test's setup), or a terminal read-only command. Assert `state["observations"]` gains one entry with the agent id and `state["step"] == 1`.
- [ ] **Step 2: Run to verify it fails.**
- [ ] **Step 3: Implement `_act_node`** (per Interfaces — thin: call `_execute_tool_assignment`, append observation, `step += 1`).
- [ ] **Step 4: Run → PASS; full suite green.**
- [ ] **Step 5: Commit** — `feat(graph): _act_node (reuses _execute_tool_assignment, appends observation)`.

---

### Task 4: Rewire `_build_graph` to the cyclic loop + finalizer budget synthesis

**Files:**
- Modify: `runtime/python/yanshi_runtime/graph/runtime_graph.py` (`_build_graph` ~L156-182; `_finalizer_node` budget branch; `start` initial state; retire `manager`/`execute` nodes)
- Test: `runtime/python/tests/test_runtime.py`

**Interfaces:**
- Consumes: `_decide_node`/`_route_after_decide` (Task 2), `_act_node` (Task 3), the existing `permission_gate` node + `_route_after_permission`, `_finalizer_node`.
- Produces: the loop topology and a `max_steps`-exhaustion synthesis in the finalizer.

- [ ] **Step 1: Write the failing integration tests** (synchronous app + injected fake providers that emit decisions in sequence — use a small sequenced fake provider like the existing `SequencedProvider`):

```python
def test_loop_no_tool_task_answers_in_one_step(tmp_path: Path) -> None:
    # Manager answers immediately → 1 provider call, no tool action, completed.
    client = make_client(tmp_path)
    service = client.app.state.runtime_service
    service.graph.provider = SequencedProvider(['{"action":"answer","text":"4"}'])
    run = client.post("/runs", json={"task": "What is 2+2?"}).json()
    fetched = client.get(f"/runs/{run['id']}").json()
    assert fetched["status"] == "completed" and fetched["resultSummary"] == "4"


def test_loop_uses_tool_then_answers_with_feedback(tmp_path: Path) -> None:
    # Step 1 assigns a tool; step 2 (seeing the observation) answers.
    client = make_client(tmp_path)
    service = client.app.state.runtime_service
    service.graph.provider = SequencedProvider([
        '{"action":"assign","agentId":"agent_file","task":"List the files in the workspace."}',
        '{"action":"answer","text":"done"}',
    ])
    run = client.post("/runs", json={"task": "List files then summarize."}).json()
    fetched = client.get(f"/runs/{run['id']}").json()
    assert fetched["status"] == "completed"
    # The file agent actually ran (an action recorded for agent_file).
    tasks = service.storage.list_agent_tasks(run_id=run["id"])
    assert any(t.agentId == "agent_file" for t in tasks)


def test_loop_budget_exhaustion_is_honest(tmp_path: Path) -> None:
    # A provider that always assigns → loop hits max_steps and finalizes honestly.
    client = make_client(tmp_path)
    service = client.app.state.runtime_service
    client.put("/settings", json={"maxAgentSteps": 2})
    service.graph.provider = SequencedProvider(['{"action":"assign","agentId":"agent_file","task":"again"}'], repeat_last=True)
    run = client.post("/runs", json={"task": "loop forever"}).json()
    fetched = client.get(f"/runs/{run['id']}").json()
    assert fetched["status"] == "completed"  # best-effort, not failed
    assert "step limit" in (fetched.get("resultSummary") or "").lower()
```

(Confirm `SequencedProvider`'s real API in `test_runtime.py` — it returns canned strings per call; add a `repeat_last` option if it doesn't already loop, or seed enough entries. Confirm `make_client` runs synchronously so the loop completes within the POST. `maxAgentSteps` must flow from `AppSettings` into `state["max_steps"]` — set in `_decide_node`'s first-step init / `start`.)

- [ ] **Step 2: Run to verify they fail** — the old linear graph doesn't loop or honor decisions → FAIL.

- [ ] **Step 3: Rewire `_build_graph`**:

```python
    def _build_graph(self):
        builder = StateGraph(GraphState)
        builder.add_node("decide", self._decide_node)
        builder.add_node("permission_gate", self._permission_gate_node)
        builder.add_node("act", self._act_node)
        builder.add_node("finalizer", self._finalizer_node)
        builder.add_edge(START, "decide")
        builder.add_conditional_edges(
            "decide",
            self._route_after_decide,
            {"permission_gate": "permission_gate", "act": "act", "finalizer": "finalizer"},
        )
        builder.add_conditional_edges(
            "permission_gate",
            self._route_after_permission,
            {"act": "act", "finalizer": "finalizer"},  # was "execute"
        )
        builder.add_edge("act", "decide")  # the loop
        builder.add_edge("finalizer", END)
        return builder.compile(checkpointer=self.checkpointer)
```

Update `_route_after_permission`'s return mapping so its execute branch returns `"act"` (it currently returns `"execute"`). In `start`, seed `observations=[], step=0` (or do it in `_decide_node`'s first-step init — pick one and be consistent). Add a recursion/step guard: LangGraph has a default recursion limit; pass `config={"recursion_limit": <max_steps*2 + 5>}` in `invoke`, or rely on `max_steps` routing to finalizer first (it does — `step >= max_steps` routes to finalizer before exceeding). Keep `max_steps*2+5` as a safety net.

- [ ] **Step 4: Finalizer budget synthesis** — in `_finalizer_node`, before the existing status logic: if the run is ending without an explicit answer because the budget was hit (`state.get("step", 0) >= state.get("max_steps", 8)` and `next_action` is an `assign`/None rather than `answer`), set `summary` to a best-effort synthesis of `state["observations"]` (reuse `_deterministic_synthesis`/`_summarize_agent_results` on the gathered results) prefixed with an honest note, e.g. `"Reached the step limit (N steps); here is what was gathered: …"`, and treat status as `completed` (best-effort, not failed). When the decision was `answer`, use `next_action["text"]` as `result_summary` (set it in `_decide_node`/route so the finalizer reads it). Keep all other status flags (blocked/missing_model/provider_failed/tool_failed/cancelled) and writes unchanged.

- [ ] **Step 5: Run the integration tests → PASS.** Then the FULL suite — expect some existing run/manager/reviewer tests to fail (they assert the old topology); do NOT fix them here. Note which fail; they are Task 5's scope.
- [ ] **Step 6: Commit** — `feat(graph): cyclic decide/act loop with bounded steps + honest budget exhaustion`.

---

### Task 5: Reconcile existing run/synthesis/reviewer tests to the loop

**Files:**
- Modify: `runtime/python/tests/test_runtime.py`
- Possibly remove: now-unreachable code in `runtime_graph.py` (old `_manager_node`/`_execute_node`/reviewer/synthesis helpers) — ONLY if proven unused after the rewrite (grep first; the loop reuses `_execute_tool_assignment` and the per-agent executors, NOT `_manager_node`/`_execute_node`).

**Interfaces:**
- Consumes: the loop from Task 4.
- Produces: a green full suite reflecting the new behavior (the batch synthesis + reviewer pass are replaced by iterative decide+answer).

- [ ] **Step 1: Run the full suite, list every failing test.** For each, classify: (a) asserts the OLD plan-once/synthesis/reviewer behavior the loop intentionally replaces → migrate the assertion to the loop's equivalent (e.g. a multi-agent run now ends via a manager `answer` decision, not a separate reviewer observation); (b) a real regression in reused machinery (gating/persona/per-偃师 model/cancel) → that's a Task-4 bug, fix the code, not the test.
- [ ] **Step 2: Migrate the (a) tests** so they assert the loop's behavior (e.g. inject a `SequencedProvider` decision sequence that exercises the same path; assert completion + the tool agent ran + the final answer). Keep them MEANINGFUL — do not delete coverage; re-express it.
- [ ] **Step 3: Remove genuinely-dead code** — if `_manager_node`/`_execute_node`/`_execute_manager_assignment`/`_execute_reviewer_assignment` are now unreferenced (grep across `runtime_graph.py` + tests + app.py), delete them and their now-unused helpers; keep anything the loop still uses (`_execute_tool_assignment`, per-agent executors, `_summarize_agent_results`/`_deterministic_synthesis` if the finalizer uses them). If anything you expected dead still has a reference, leave it and note why.
- [ ] **Step 4: Full suite green** — `cd runtime/python && .venv/bin/python -m pytest -p no:cacheprovider -p no:warnings 2>/dev/null | grep -E "passed|failed"` → all pass.
- [ ] **Step 5: Real-world check (not a CI gate)** — with the (now-working) local provider, run `cd runtime/python && uv run python -m evals.run_evals` and confirm the seed cases pass through the new loop (compare to the pre-loop baseline — runs should still complete; this is the eval harness validating the redesign end-to-end). Note the result.
- [ ] **Step 6: Commit** — `refactor(graph): retire plan-once nodes; migrate tests to the iterative loop`.

---

## Self-Review

**Spec coverage:** §4.1 cyclic topology → Task 4. §4.2 state fields/maxAgentSteps → Task 1. §4.3 decide node → Tasks 1+2. §4.4 route → Task 2. §4.5 act (reuse `_execute_tool_assignment`) → Task 3. §4.6 finalizer (answer + budget synthesis) → Task 4. §4.7 reuse list → all tasks reuse, only control flow changes. §5 backward-compat/honesty (1-call no-tool, status-driven failure, honest budget note) → Task 4 tests. §7 tests (no-tool 1-step, tool+feedback, budget exhaustion, cancel, permission gate, regression) → Task 4 + Task 5. ✅

**Placeholder scan:** Code-bearing steps carry code or name the exact method to mirror (`_provider_next_action` mirrors `_provider_agent_plan` — read-first against real code, not a guess, because reinventing the provider prompt/parse would be guessing). Task 5 is intentionally evidence-driven ("list failing tests, classify, migrate") because the exact set depends on the rewrite — but it gives the classification rule (migrate (a), fix-code-for (b)) and the no-weakening constraint, not a vague "fix tests."

**Type consistency:** `next_action` shape `{"action":"answer","text"}` / `{"action":"assign","agentId","task"}` consistent across `_provider_next_action` (Task 1), `_route_after_decide` (Task 2), `_act_node` (Task 3), finalizer (Task 4). `observations`/`step`/`max_steps` GraphState fields used consistently. `_route_after_permission` returns `"act"` (renamed from `"execute"`) consistently with the new `act` node.

**Scope / risk:** Single subsystem (the graph control flow). The riskiest change; mitigations baked in — reuse all executors, hard `max_steps` cap, per-step cancel, LangGraph recursion_limit safety net, the STOP-and-align rule, and the eval harness as an end-to-end regression net. Parallel steps and MCP/ACP in-loop tool call-back are explicitly out of scope.
