# AI Integrations

Settings → **AI Integrations** has four sections: LLM Providers, External Agents (ACP), MCP
Servers, and Skills. They share one pattern — a compact card row per item plus a centered config
modal — and every status is honest.

![AI provider settings](/screens/providers.png)

## The four sections

| Section | What it is | Status |
|---|---|---|
| [LLM Providers](/integrations/providers) | The model backend for chats | <Badge type="tip" text="Available now" /> for OpenAI-compatible endpoints; <Badge type="warning" text="Planned" /> native adapters |
| [ACP External Agents](/integrations/acp) | Agents over the Agent Client Protocol | <Badge type="info" text="Foundation implemented" /> for stdio launch + handshake; prompt routing planned |
| [MCP Servers](/integrations/mcp) | Model Context Protocol tool servers | <Badge type="info" text="Foundation implemented" /> for config; <Badge type="warning" text="Planned" /> runtime client |
| [Skills](/integrations/skills) | Instructions/config applied to agents | <Badge type="tip" text="Available now" /> |

## Honest status, server-computed

Integration statuses are recomputed by the runtime on read — a stored config can never claim a
connection that does not exist. Live ACP connection state is overlaid at read time and never
persisted as "connected". Discovered tools are never faked.

## Secrets

Provider API keys go to a secure off-database store and are never returned by any API, logged, or
written to SQLite. See [Provider Secrets](/integrations/secrets).
