# ACP External Agents

Yanshi can connect to agents that speak the **Agent Client Protocol (ACP)**. This is a real
**foundation**, and the app is explicit about its current scope.

::: info Status — Foundation implemented <Badge type="info" text="Foundation implemented" />
Implemented: launching an agent over stdio and completing the ACP `initialize` handshake, with
live capability discovery and an honest lifecycle.

Planned: prompt routing, tool/permission events, sessions, and non-stdio (HTTP endpoint)
transports. The UI calls this "ACP foundation", not "ACP complete".
:::

## Configure an agent

In **Settings → External Agents**, add an agent with a command, arguments, environment, and
(optionally) an endpoint. Configurations persist across restarts.

## Connect

For a command-based ACP agent, press **Connect**. Yanshi:

1. spawns the configured command (with args + env) and speaks JSON-RPC 2.0 over stdio,
2. sends `initialize` per the protocol,
3. records the capabilities the agent reports.

## Honest lifecycle

`not configured` → `configured` (saved, connectable) → `starting` → `connected` / `error`. A
connected agent whose process exits flips to `error`. Live state is **never persisted as
connected** — it is recomputed on read. Launched processes are killed on disconnect, config
removal, and app shutdown.

## Limitations

- Endpoint (HTTP) transports and `custom`-protocol entries are *not implemented*.
- Prompts and tool/permission flows are not routed yet.
- Failures surface as `YANSHI_ACP_001` with the real error in `lastError` (concise badge + muted
  detail in the modal, not a red paragraph).
