# MCP In Loop Increment 1 Design

## Scope

Increment 1 adds MCP `tools/call` as one ReAct-loop assignment target. ACP-in-loop remains out of
scope and the existing whole-run ACP route stays unchanged.

## Manager Action

The manager may keep using the existing built-in assignment shape:

```json
{"action":"assign","agentId":"agent_file","task":"list workspace files"}
```

It may also assign a connected MCP tool:

```json
{"action":"assign","agentId":"agent_mcp","toolId":"server_id/tool_name","arguments":{},"task":"why this call is needed"}
```

`toolId` must be a non-empty `server_id/tool_name` string. `arguments` is optional and defaults to
`{}`. `task` remains required because the existing per-action permission gate classifies that text.

## Tool Advertisement

The manager prompt continues to advertise only the four built-in agents when no MCP tools are
callable. When MCP is wired, the graph reads configured server IDs from storage and calls
`mcp.live_state(server_id)`. It advertises only tools from live `connected` or `ready` connections.
It never advertises persisted MCP config alone, disconnected servers, errored servers, or HTTP/SSE
entries.

## Execution Semantics

`agent_mcp` execution resolves the live connection and tool name, creates an `McpAction`, and calls:

```python
conn.request("tools/call", {"name": tool_name, "arguments": arguments}, timeout=30)
```

Unavailable manager/connection/tool, malformed `toolId`, and transport exceptions are hard failures:
the graph writes an `McpObservation` with `missingRequirement="mcp_tool_unavailable"` and the run
fails honestly.

A successful MCP response with `isError: true` is a soft tool failure: the observation is written
with `ok=False` but no hard missing requirement, so the manager can see the error and answer or
adapt in the next decide step.

Normal successful responses summarize text `content` blocks and include `toolId`, `arguments`,
`isError`, and raw result metadata in structured output.

## Non-Goals

- ACP sub-step execution.
- HTTP/SSE MCP transport.
- Per-偃师 MCP tool whitelists.
- Persisting discovered tools or MCP call results as fake durable capability state.

## Verification

Tests fake the MCP transport in-process: no real MCP server is needed. Coverage includes a happy
MCP call, unavailable hard failure, soft `isError` feedback, prompt advertisement honesty, built-in
agent regression, and the full runtime pytest gate.
