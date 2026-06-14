# Settings

Settings is a centered two-pane window: a fixed title, a scrollable section nav, and an
independently scrolling content pane.

## Groups

- **Personal** — Profile (a local display name, emoji/preset avatar, and workspace label — a
  local identity only; there is no account or login) and Appearance (theme, language, GPU
  Acceleration).
- **Workspace** — General (default permission mode, Developer Mode) and Yanshi Atelier.
- **AI Integrations** — [LLM Providers](/integrations/providers),
  [External Agents](/integrations/acp), [MCP Servers](/integrations/mcp),
  [Skills](/integrations/skills).
- **Tools** — [Permissions](/desktop/permissions).
- **System** — [Keyboard Shortcuts](/desktop/shortcuts), Notifications, Performance.
- **Developer** (when Developer Mode is on) — Runtime, Sandbox, Database.

## Appearance

- **Theme** — System / Light / Dark, tokenized with a mint-green accent.
- **Language** — System / English / 简体中文, with compile-time-checked parity.
- **GPU Acceleration** — switches the visual-effect tier (glow/blur/animation) and the Atelier
  render quality. It controls the app's effect tier, not the OS GPU.

## Persistence & safety

Settings persist via the runtime. Saves are optimistic with rollback on failure
(`YANSHI_SETTINGS_001`). Provider keys are handled separately and securely — see
[Provider Secrets](/integrations/secrets).
