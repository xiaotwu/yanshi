# MCP Servers

Yanshi can store **Model Context Protocol (MCP)** server configurations. Today this is a real
configuration foundation — the runtime MCP client is planned.

::: info Status — Foundation implemented <Badge type="info" text="Foundation implemented" />
You can add, edit, enable, and persist MCP server configs (stdio: command + args + env; or
HTTP/SSE: url). The runtime has **no MCP client yet**, so statuses stay
`not_implemented`/`not_configured` and the discovered-tools list is always empty.

Planned: a runtime client with real discovery and approval-aware tool execution. Tools are
**never faked**.
:::

## Configure a server

In **Settings → MCP Servers**, add a server:

- **stdio** — `command`, `args`, and `env`.
- **HTTP / SSE** — a `url`.

There is deliberately no "Test connection" button — a test that cannot actually connect would be
misleading.

## Planned

A runtime MCP client (stdio first) that performs real tool discovery and exposes MCP tools to
agents through the existing action/observation model with approvals.

Save failures surface as `YANSHI_MCP_001`.
