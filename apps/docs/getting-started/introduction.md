# Introduction

**Yanshi** is a macOS-first desktop AI agent workspace. You describe a task in plain language, and
a team of agents plans, executes real tools, and shows its work inside an animated workshop — the
**Yanshi Atelier (偃师工坊)**.

> Yanshi (偃师) means a craftsman of animated mechanisms. The app brings that idea into a desktop
> AI workspace: agents work, wait, review, and create inside a project-scoped atelier.

## What Yanshi is

- A **Tauri** desktop shell hosting a React UI, with a **bundled Python runtime sidecar** — the
  packaged app launches the runtime with no separate Python install.
- A **LangGraph**-orchestrated runtime with an explicit action / observation model, real tools
  (File, Browser, Computer, Terminal/Docker), and SQLite persistence.
- A **chat-first** workspace: you talk to Yanshi; runs and tasks stay an internal concept.
- **Project-scoped**: each project has its own chats, files, agent team, and atelier office state.

## What Yanshi is not

Yanshi never fakes work. If an external dependency, API key, OS permission, or Docker daemon is
missing, the app shows an honest *not-configured* or *permission-required* state instead of a
fake success. This is enforced as a hard [no-mock policy](/reference/no-mock).

## Honest status at a glance

Yanshi is a **v0.1 Local Final Candidate** — feature-complete and real end-to-end for local use,
with automated checks passing. Some areas are available now, while others are foundations or
depend on external steps:

- **Available now** — desktop app, bundled runtime, OpenAI-compatible provider path, projects,
  Library, Yanshi Atelier, approvals, persistence, and file/terminal tools.
- **Foundation implemented** — ACP launch + handshake; MCP configuration persistence.
- **Setup required** — provider API key, Browser Chromium, Docker daemon when using Docker.
- **Blocked by external requirements** — Computer Use privacy grants and public Apple signing /
  notarization.
- **Planned** — ACP prompt routing, MCP runtime client, native Anthropic/Gemini adapters.

See [Known Limitations](/release/limitations) for the full picture.

## Next steps

- [Installation](/getting-started/installation) — build and run the app.
- [Quickstart](/getting-started/quickstart) — your first build and launch.
- [First Chat](/getting-started/first-chat) — run something real.
- [Yanshi Runtime](/concepts/runtime) — how it all works underneath.
