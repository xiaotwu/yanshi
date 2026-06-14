# Yanshi AI Integrations

_Settings → AI Integrations (AI 集成). Updated 2026-06-11._

## Architecture

The AI Integrations settings group has four sections: **LLM Providers**, **External Agents**,
**MCP Servers**, and **Skills**. Every section uses the same surface pattern: a compact card row
(icon, name, one-line detail, badges, icon-only configure button, enable switch) plus a centered
**config modal** with one field per row and icon-only footer actions (tooltips + aria-labels).

Configuration is persisted by the runtime (`GET/PUT /settings/integrations` for agents/MCP;
`/settings/provider` for the provider). The runtime recomputes every integration's `status` on
read from what it can actually do — a stored config can never claim a connection that does not
exist. Live ACP state is overlaid on read and **never persisted**.

## LLM Providers — implemented now

- **One active provider** (OpenAI-compatible protocol) with base URL / model / API key and a
  **real** Test connection (live healthcheck against the endpoint).
- **Save and "set as preferred" are separate actions.** Save persists the configuration; the
  **Preferred for (首选操作)** chips (New chats / Coding / Everyday tasks) record which provider is
  preferred per action (`AppSettings.preferredActions`). Honest scope, stated in the modal: today
  every chat runs on the saved provider configuration; per-action routing arrives with
  multi-provider runtime support.
- The catalog (OpenAI, OpenAI Compatible, Anthropic, Gemini, OpenRouter, DeepSeek, Mistral,
  Ollama, LM Studio, vLLM/SGLang, Custom) renders as cards with local/cloud + status badges;
  capability badges show inside the config modal.
- **Honest statuses:** `Available`, `Custom endpoint required`, `Not implemented yet`
  (Anthropic/Gemini native protocols — cannot be configured, no fake support).
- **Key safety:** the API key goes to the off-database secret store (`apiKeyRef`; file `0600` by
  default, opt-in macOS Keychain). It is never returned by any API, never logged, never in SQLite.
- **Planned:** multiple saved providers, per-run `providerId`/model selection, model discovery,
  native Anthropic/Gemini adapters.

## External Agents — real minimal **ACP foundation** (not "ACP complete")

Implemented now (`yanshi_runtime/acp.py`):

- **stdio launch + initialize handshake.** Connect spawns the configured command (+ args + env)
  and speaks JSON-RPC 2.0 over stdio per the Agent Client Protocol: `initialize` with
  `protocolVersion` and client capabilities; the agent's reported `agentCapabilities` are
  flattened into capability badges. Nothing is invented — capabilities exist only while a live
  handshake succeeded.
- **Honest lifecycle:** `not_configured` → `configured` (saved, connectable) → `starting` →
  `connected` / `error` (with the real error message shown as "Last error"). A connected agent
  whose process exits flips to `error`. Statuses at rest are recomputed: nothing "connected" is
  ever stored. Endpoints: `POST /settings/integrations/agents/{id}/connect` and `/disconnect`;
  launched processes are killed on disconnect, config removal, and runtime shutdown.
- Config modal: name / protocol / command / arguments / environment / endpoint, with live status,
  capability badges, and last error. Connect persists the edited config first, so the launch
  always uses what the user sees.

**Exact limitations (stated in-app):** prompts, tool calls, and permission events are **not**
routed yet; sessions are not created; endpoint (HTTP) transports and `custom` protocol entries are
`not_implemented` — only stdio launch works. Verified against a real ACP-speaking process in
pytest (`test_acp_connect_handshake_and_disconnect`) and live in the UI
(qa/manual-uiux-acp-pass/smoke-07-agent-connected.png).

**Planned next:** `session/new` + prompt exchange with streamed updates, tool/permission event
surfaces, endpoint transports.

## MCP Servers — config only, honest

- Add/edit/enable **Model Context Protocol** servers: stdio (`command` + `args` + `env`) or
  HTTP/SSE (`url`). Configs persist.
- **The runtime has no MCP client yet.** Statuses are `not_implemented`/`not_configured`; the
  `tools` list is always empty (never faked); there is deliberately no "test connection" button —
  a test that cannot connect would be fake.
- **Planned:** runtime MCP client (stdio first), tool discovery surfaced per server, MCP tools
  exposed to agents through the existing Action/Observation model with approvals.

## Skills — honest aggregation

- Lists what actually exists today: **agent instructions** (each AgentProfile's
  prompt/personality, editable in Workshop → Agent Editor) and **Workshop packs** (content types,
  version, real enable/disable through the Workshop pack API).
- Each card opens a detail modal: source, version, applies-to, and an instructions preview.
- The section states plainly that skills are *configuration and instructions applied to agents,
  not executable plugins*. There is no fake skill-execution engine.
- **Planned:** a first-class skill format (instructions + tool allowlists) installable via
  Workshop packs.

## Configuring safely

1. Provider: Settings → AI Integrations → LLM Providers → open a card → enter base URL/model/key →
   Save (icon) → Test (icon) → optionally mark Preferred-for chips. The key is write-only.
2. External Agents: save a command-based ACP agent, then Connect. Treat agent `env` like any
   process environment — provider keys belong in the provider section (secret store), not here.
3. MCP entries can be prepared now; they activate only when a future runtime ships the real
   client (no behavior is simulated meanwhile).
