# Handoff B — MCP tools (and ACP agents) callable *inside* the ReAct loop ("layer 2")

**For:** Codex, in `/Users/xiaotwu/Code/yanshi` on `main`. **Do not push to origin.**
**venv:** `runtime/python/.venv/bin/python` · **trailer:** `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`
**Process:** This is a real feature — do brainstorming → spec → plan → TDD, don't free-code it. The
iterative-loop design (`docs/superpowers/specs/2026-06-20-iterative-agent-loop-design.md`) explicitly
listed this as a deferred non-goal ("循环内的 MCP/ACP 工具反向调用,layer 2,以后接进 act"). This is that.

## Current state (what exists)
- **Loop manager decision** `_provider_next_action` (runtime_graph.py ~L1300) returns
  `{"action":"answer","text":…}` or `{"action":"assign","agentId":…,"task":…}` where `agentId` is
  hard-restricted to `agent_file|agent_browser|agent_computer|agent_terminal`. The system prompt
  enumerates exactly those four.
- **Dispatch** `_execute_tool_assignment` (~L535) is an if/elif on `agent_id` → the four
  `_execute_{file,browser,computer,terminal}_assignment` executors. `_act_node` wraps it.
- **MCP** `mcp_client.py`: `McpManager.connect(server)/disconnect/live_state/shutdown`;
  `McpConnection{status, tools: list[McpToolInfo{name, description}], …}`. **Discovery only — no
  invocation method exists yet** (there is `request(method, params, timeout)` for raw JSON-RPC, which
  is what a `tools/call` would use). Lives on the **service** (`server/app.py` `self.mcp`), NOT on the graph.
- **ACP** `acp.py`: `AcpManager.connect/disconnect/live_state`; `AcpConnection.new_session(...)` +
  `prompt(session_id, text, timeout)`. Today ACP runs route the **whole task** to an external agent at
  the *server* level (`app.py:_run_via_external_agent`, selected by `request.externalAgentId`),
  completely bypassing the graph. "ACP inside the loop" is different: the manager delegates *one
  sub-step* to an external agent and feeds the result back.

## Scope decision to make first (brainstorm)
1. **MCP first, ACP later, or both?** Recommend **MCP-tool invocation first** (smaller, the manager
   gains real new tools); ACP-in-loop is a second increment.
2. **How the manager addresses an MCP tool.** Recommend extending the `assign` action with an explicit
   tool id rather than overloading `agentId`, e.g.
   `{"action":"assign","agentId":"agent_mcp","toolId":"<server_id>/<tool_name>","task":…}` (keep the
   four built-ins unchanged; add `agent_mcp` as a fifth dispatch branch). Decide the exact shape and
   write it in the spec.
3. **Tool gating.** MCP tools must pass the same honesty/gating discipline: a disabled/unavailable
   server → a hard-gate failure (`tool_disabled`-style `missing_requirement`) so the run fails honestly
   via the existing `_HARD_TOOL_FAILURE_REQUIREMENTS` path in `_act_node`. Decide an allowlist model
   (which discovered MCP tools are callable; per-偃师 abilities like the built-ins?).
4. **Approval/risk.** An MCP tool call is a side-effecting action — run it through `policy.decide` for
   risk/approval like any assign (and ideally the per-action gate from Handoff C).

## Build outline (after the spec is approved)
- **Inject the graph with the MCP manager.** `RuntimeGraph.__init__` currently only takes
  storage/checkpoint/workspace/provider. Pass the live `McpManager` (and later `AcpManager`) in from
  `server/app.py` so the loop can see discovered tools + invoke them. Keep it optional/None-safe so
  unit tests without MCP still work.
- **Tell the manager what tools exist.** Build the available-tool list (the four built-ins + the
  currently-connected MCP tools, post-gating) and inject it into the `_provider_next_action` system
  prompt — an *honest* list of what's actually callable right now (mirrors the design's "经门控过滤后
  的诚实清单"). No tool → don't advertise it.
- **Add an MCP executor.** `_execute_mcp_assignment(state, assignment)` → resolve `toolId` to a live
  `McpConnection`, call `connection.request("tools/call", {"name":…, "arguments":…}, timeout)`, write an
  `McpObservation` (new observation type) + action records exactly like the other executors, return an
  `AgentExecutionResult` with `ok`/`summary`/`structured_output` and a hard `missing_requirement` when
  the server/tool is gone or disabled. Wire it into the `_execute_tool_assignment` if/elif and the
  `OBSERVATION_TYPE`/`TOOL_LABEL` maps.
- **(Increment 2 — ACP-in-loop)** `_execute_acp_assignment` using `AcpManager.live_state(agent_id)` +
  `new_session`/`prompt`, returning the agent message as the observation. Same gating/approval rules.

## Tests (TDD — fake the MCP/ACP transports, like the existing provider/playwright fakes)
- A `FakeMcpManager` exposing one connected tool; loop test: manager `assign`s the MCP tool → executor
  calls `tools/call` → observation fed back → second decide `answer`s → `completed`.
- Disabled/missing MCP server → hard-gate `failed` (assert the observation + status, no fake success).
- The manager prompt only advertises tools that are actually connected (no provider hallucination of
  absent tools).
- Regression: the four built-in agents still work; no-MCP runs unaffected (manager injected with
  None/empty manager).
- Gate: `cd runtime/python && .venv/bin/python -m pytest -p no:cacheprovider -p no:warnings` stays green.

## Done
Spec + plan committed under `docs/superpowers/`; the feature implemented TDD in task-sized commits
(graph injection → prompt tool-list → MCP executor → tests; ACP as a follow-up commit). Each commit has
the trailer; no push. Honest failures only (status-driven). Update README's MCP/ACP capability rows
(they currently say "discovery only" — keep them accurate).
