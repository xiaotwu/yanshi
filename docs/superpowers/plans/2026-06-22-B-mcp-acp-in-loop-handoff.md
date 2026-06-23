# Handoff B — MCP tools (and ACP agents) callable *inside* the ReAct loop ("layer 2")

**For:** Codex, in `/Users/xiaotwu/Code/yanshi` on `main`. **Do not push to origin.**
**venv:** `runtime/python/.venv/bin/python` · **gate:** `cd runtime/python && .venv/bin/python -m pytest -p no:cacheprovider -p no:warnings`
**trailer:** `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`
**Process:** real feature → brainstorm → write a short spec under `docs/superpowers/specs/` → plan → TDD in
task-sized commits. The design below is a **recommended, decision-complete default** so you aren't
re-deciding from scratch; confirm it in the spec, adjust only with reason, then implement. The
iterative-loop design (`docs/superpowers/specs/2026-06-20-iterative-agent-loop-design.md`) listed this as
the deferred "layer 2" non-goal ("循环内的 MCP/ACP 工具反向调用…以后接进 act"). This is that.

**Build it in two increments. Increment 1 = MCP-tool invocation (do this first, fully). Increment 2 =
ACP-in-loop (separate later commit).** Don't start ACP until MCP is green and committed.

> **STATUS: Increment 1 (MCP) ✅ DONE** — commit `bfa3e7b`, spec
> `docs/superpowers/specs/2026-06-23-mcp-in-loop-increment-1-design.md`, suite 162 passed. Controller-
> verified: hard(`mcp_tool_unavailable`)/soft(`isError`) distinction correct, honest live-only tool
> advertisement (byte-identical prompt when none), None-safe injection, no fake success.
> **Increment 2 (ACP) is the remaining work — see the section near the end of this doc.**

---

## Current state — verified line anchors (runtime/python/yanshi_runtime/)

- **Manager decision** `graph/runtime_graph.py::_provider_next_action` (def at **L1126**) returns
  `{"action":"answer","text":…}` or `{"action":"assign","agentId":…,"task":…}`. Allowed agentIds are the
  set `_NEXT_ACTION_AGENT_IDS = {"agent_file","agent_browser","agent_computer","agent_terminal"}`
  (**L1104**), enforced at **L1178**. The system prompt hard-codes the same list at **L1136**
  ("agentId must be one of: …"). Scalar `text` is coerced (L1148-ish); malformed output raises
  `ProviderDecisionError` carrying the raw response.
- **Dispatch** `_execute_tool_assignment` (def at **L578**): starts the agent task, runs
  `_tool_disabled_result` gating (**L587**), then an if/elif on `agent_id` (**L594-601**) → the four
  `_execute_{file,browser,computer,terminal}_assignment` executors; unknown agent → `ErrorObservation`
  with `missing_requirement="unknown_agent_assignment"` (**L602-620**). Returns an `AgentExecutionResult`
  (TypedDict at top of file: `agent_id, task_id, task, ok, summary, observation_type,
  missing_requirement, structured_output`). Maps: `_TOOL_OBSERVATION_TYPE` (**L626**), `_TOOL_LABEL`
  (**L633**). Template to copy: `_execute_file_assignment` (**L714**).
- **Loop act** `_act_node` (def ~**L512**) wraps `_execute_tool_assignment`, appends a compact
  observation, increments `step`, consumes `approved`, and on a **hard** failure
  (`result["missing_requirement"] in self._HARD_TOOL_FAILURE_REQUIREMENTS`, set at **L63-67**:
  `{"tool_disabled","tool_not_in_worker_abilities","docker_config_invalid"}`) sets `tool_failed=True`
  → finalizer fails the run honestly. **Soft** failures (ok=False but not in that set) flow back as an
  observation the manager can adapt to.
- **Per-action risk gate** (Handoff C, already implemented): `_decide_node` runs `policy.decide(sub_task)`
  on each assign and gates `blocked`/`requires_approval` per action. A side-effecting MCP call gets this
  for free as long as its `task` text is descriptive.
- **MCP transport** `mcp_client.py`: `McpManager.connect(server)/disconnect(server_id)/live_state(server_id)/shutdown`.
  `live_state` returns the live `McpConnection` or `None`. `McpConnection`: `status: IntegrationStatus`,
  `tools: list[McpToolInfo{name, description}]`, and `request(method, params, timeout) -> dict` (raises
  `ConnectionError`/`TimeoutError`/`ValueError`). **Discovery only today — nothing calls `tools/call`.**
- **ACP transport** `acp.py`: `AcpManager.connect/disconnect/live_state(agent_id)`;
  `AcpConnection.new_session(timeout, cwd=None) -> session_id`, `prompt(session_id, text, timeout) -> str`.
- **Wiring** `server/app.py`: `RuntimeGraph(...)` built at **L103** (only storage/checkpoint/workspace/
  provider — no mcp); `self.acp = AcpManager()` / `self.mcp = McpManager()` at **L110-111**. Users connect
  servers via existing endpoints (`/settings/integrations/mcp/{id}/connect`, `service.connect_mcp_server`
  at L535). Provider is hot-set onto the graph at **L472** (`self.graph.provider = self.provider`) — mirror
  that pattern for mcp. Today ACP runs route the **whole task** to an external agent at the server level
  (`_run_via_external_agent`, L255, selected by `request.externalAgentId`), bypassing the graph — that
  path **stays**; ACP-in-loop (increment 2) is the manager delegating *one sub-step*, which is different.

---

## Increment 1 — MCP tool invocation (recommended concrete design)

### 1a. Inject the MCP manager into the graph (None-safe)
- `RuntimeGraph.__init__`: add a param `mcp: "McpManager | None" = None`; store `self.mcp = mcp`. Default
  `None` so every existing unit test (which constructs the graph without MCP) is unaffected.
- `server/app.py` after L111: `self.graph.mcp = self.mcp` (mirrors the `self.graph.provider` hot-set at
  L472). Don't reorder construction.

### 1b. Action shape
Extend `assign` for MCP without touching the four built-ins:
`{"action":"assign","agentId":"agent_mcp","toolId":"<server_id>/<tool_name>","arguments":{…},"task":"<why, human-readable>"}`
- Add `"agent_mcp"` to `_NEXT_ACTION_AGENT_IDS` (L1104).
- In `_provider_next_action` validation (the assign branch ~L1170-1182): when `agentId=="agent_mcp"`,
  require a non-empty string `toolId` of the form `server_id/tool_name` and accept an optional dict
  `arguments` (default `{}`); keep requiring a non-empty `task` (used for the per-action risk gate).

### 1c. Honest tool advertisement in the prompt
Replace the hard-coded enumeration at **L1136** with a dynamically built list: always the four built-ins,
**plus** one line per *currently-connected* MCP tool when `self.mcp` is not None and has connected servers
with discovered `.tools` — e.g. `agent_mcp toolId=<server_id>/<tool_name>: <description>`. When there are
no connected MCP tools (or `self.mcp is None`), the prompt is **byte-identical to today** (regression-safe).
Build a small helper `_available_mcp_tools() -> list[tuple[str, str]]` ((toolId, description)) that reads
`self.mcp.live_state` over the configured/connected servers; only advertise tools from connections whose
status is connected/ready. This is the design's "经门控过滤后的诚实清单" — never advertise a tool that
isn't actually callable right now.

### 1d. Executor `_execute_mcp_assignment(self, state, assignment) -> AgentExecutionResult`
Copy the structure of `_execute_file_assignment` (L714). Steps:
1. Parse `toolId` → `server_id`, `tool_name`. Read `arguments` (dict).
2. Resolve `conn = self.mcp.live_state(server_id) if self.mcp else None`. **Availability hard-gate:** if
   `self.mcp is None`, `conn is None`, the connection isn't connected/ready, or `tool_name` is not in
   `{t.name for t in conn.tools}` → return an `AgentExecutionResult` with `ok=False`,
   `missing_requirement="mcp_tool_unavailable"`, an `McpObservation` explaining which server/tool is
   unavailable. **Add `"mcp_tool_unavailable"` to `_HARD_TOOL_FAILURE_REQUIREMENTS` (L63)** so an
   unavailable tool fails the run honestly (config/availability is a hard block, like `tool_disabled`).
3. Otherwise `create_action`, then call inside try/except:
   `result = conn.request("tools/call", {"name": tool_name, "arguments": arguments}, timeout=<sane, e.g. 30>)`.
   - `ConnectionError`/`TimeoutError`/`ValueError` (transport died / timed out) → **hard** failure
     (`mcp_tool_unavailable`).
   - Success: MCP `tools/call` returns `{"content":[{"type":"text","text":…}, …], "isError": bool}`.
     Summarize the joined text content. If `result.get("isError")` is true → **soft** failure
     (`ok=False`, `missing_requirement=None` so it is NOT in the hard set) — the tool ran but reported an
     error, and the manager should see it and adapt. Else `ok=True`.
4. `create_observation(type="McpObservation", …, structured_output={"toolId":…, "arguments":…, "isError":…})`,
   `complete_action`, return the result dict (set `observation_type="McpObservation"`).
5. Wire it: add `elif agent_id == "agent_mcp": result = self._execute_mcp_assignment(state, assignment)` in
   `_execute_tool_assignment` (L594 block), and `_TOOL_OBSERVATION_TYPE["agent_mcp"]="McpObservation"`,
   `_TOOL_LABEL["agent_mcp"]="MCP Tool"`.

### 1e. Gating / risk / approval
- Availability gating: the hard-gate in 1d step 2 (server/tool not connected → fail honestly).
- Risk/approval: free via Handoff C's per-action `policy.decide(task)` — an MCP `task` like "wire transfer
  $500 via the payments MCP" would hit the critical-blocklist/approval gate. No new code; just ensure the
  `task` text is what gets risk-classified (it is).
- Per-偃师 whitelist for MCP tools: **out of scope for v1** (MCP tools aren't among the four tool toggles).
  Note it in the spec as a future extension; don't build it now.

### 1f. Tests (TDD — fake the transport; no real MCP server)
Add a `FakeMcpManager` + `FakeMcpConnection` in `tests/` (mirror the existing provider/playwright fakes):
```python
class _FakeMcpTool:  # name + description
    def __init__(self, name, description=""): self.name, self.description = name, description
class _FakeMcpConnection:
    status = "ready"
    def __init__(self, tools, responder): self.tools = tools; self._responder = responder
    def request(self, method, params, timeout): return self._responder(method, params)
class _FakeMcpManager:
    def __init__(self, by_id): self._by_id = by_id          # {server_id: connection}
    def live_state(self, server_id): return self._by_id.get(server_id)
```
- **Happy path:** `service.graph.mcp = _FakeMcpManager({"srv": _FakeMcpConnection([_FakeMcpTool("search")], lambda m,p: {"content":[{"type":"text","text":"hit"}]})})`; SequencedProvider:
  step 1 `{"action":"assign","agentId":"agent_mcp","toolId":"srv/search","arguments":{"q":"x"},"task":"search the docs"}`,
  step 2 `{"action":"answer","text":"found it"}`. Assert: run `completed`, an `McpObservation` was written,
  and the request reached the connection (`tools/call` with name `search`).
- **Unavailable server/tool → hard fail:** `live_state` returns None (or tool not in `.tools`) → run
  `failed`, `McpObservation` with `mcp_tool_unavailable`, NOT a fake success.
- **`isError:true` → soft adapt:** responder returns `{"content":[…],"isError":true}`; manager's step-2
  `answer` still completes; assert the failed-tool observation is present but the run reflects the manager's
  honest handling (don't assert a fake success — assert the observation + the manager's adaptation).
- **Honest advertisement:** with no connected MCP tools (`graph.mcp = None`), assert the manager prompt /
  `_available_mcp_tools()` advertises nothing and the four-built-in behavior is unchanged.
- **Regression:** the four built-in agents still work; full suite stays green (currently **158 passed**).

### 1g. Commit increment 1
Task-sized commits (graph injection → action shape + prompt list → executor + hard-gate → tests), each with
the trailer. Update README's MCP capability row (it says "discovery only" — make it accurate). No push.

---

## Increment 2 — ACP agent as a loop sub-step (separate, later)
Mirror 1b–1f for ACP: action `{"action":"assign","agentId":"agent_acp","externalAgentId":"<id>","task":…}`;
inject `self.graph.acp = self.acp` (app.py); `_execute_acp_assignment` resolves
`conn = self.acp.live_state(externalAgentId)` (hard-gate `acp_agent_unavailable` if None/not connected),
then `session = conn.new_session(timeout); text = conn.prompt(session, task, timeout)`, writes an
`AcpObservation`. Advertise connected ACP agents in the prompt the same honest way. **Leave the existing
whole-task `_run_via_external_agent` server path (app.py L255) untouched** — it's a different feature.
Fake the ACP transport in tests just like the MCP fakes. Separate commit(s).

## Definition of done
- Increment 1 (MCP) implemented TDD, full suite green, README MCP row accurate, spec committed under
  `docs/superpowers/specs/`. Honest failures only (status-driven; unavailable = hard, isError = soft).
- Increment 2 (ACP) optionally follows in its own commit(s); the existing whole-task ACP route still works.
- All commits direct to `main` with the trailer. **Do not push to origin.**
