# ACP In-Loop Increment 2 Design

## Goal

Allow the Manager Agent to assign one connected ACP external agent as a ReAct-loop sub-step, then feed the ACP reply back into the normal observation loop. This mirrors the MCP in-loop slice while leaving the existing whole-run `externalAgentId` route unchanged.

## Action Shape

The manager may emit:

```json
{"action":"assign","agentId":"agent_acp","externalAgentId":"ea_id","task":"ask the specialist"}
```

`externalAgentId` is required and must be a non-empty string. The `task` field remains the human-readable assignment prompt sent to the ACP agent.

## Advertisement

`agent_acp` is advertised in the manager prompt only when at least one configured ACP external agent has a live connection whose status is `connected` or `ready`. The prompt lists the connected agents by id and name, and asks the model to include `externalAgentId` for ACP assignments.

No configured-but-disconnected ACP agent is advertised, so the manager never sees a fake capability. If a model still emits an unavailable id, execution fails honestly.

## Execution

`RuntimeService` injects `self.acp` into `self.graph.acp`.

`RuntimeGraph._execute_acp_assignment`:

1. Creates an `AcpAction`.
2. Resolves the live connection with `self.acp.live_state(externalAgentId)`.
3. Hard-gates with `acp_agent_unavailable` if the connection is missing or not connected.
4. Calls `new_session(timeout=30.0, cwd=<run workspace>)`.
5. Calls `prompt(session_id, task, timeout=300.0)`.
6. Records an `AcpObservation` with `externalAgentId`, `sessionId`, and the response text.
7. Returns the observation as feedback for the next manager decision.

Transport errors, timeouts, empty replies, and unavailable connections are hard failures. They do not become fake successful ACP output.

## Non-Goals

- Do not change the existing whole-task `_run_via_external_agent` server route.
- Do not auto-connect disconnected ACP agents from inside the loop.
- Do not add ACP tool/permission callback handling in this increment.
- Do not persist live ACP transport state.
