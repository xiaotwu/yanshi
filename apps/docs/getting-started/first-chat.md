# First Chat

In Yanshi, **Chat** is the user-facing concept (新对话 / Recent chats). Internally each chat is a
runtime *run* with tasks, actions, and observations — but you just describe what you want.

## Start a chat

1. Click **New Chat** in the sidebar (or press `⌘N`).
2. Type a task in plain words, e.g. *"List the files in this workspace and summarize them."*
3. Optionally use the **+** menu to attach files, plan-first, or enable a tool (Browser /
   Computer / Terminal).
4. Submit with `↩` (or `⌘↩`).

## Watch the work

- The **right Progress panel** (`⌘J`) shows status, the plan, the agent queue, and generated
  **Files** with their real names.
- Open the **Yanshi Atelier** (`⌘L`) to watch the worker characters act out the real state —
  working, waiting for approval, or resting when idle.
- Approvals appear inline and in the panel; you approve or deny before risky actions run.

## Conversation view

Opening a recent chat shows a Claude-style conversation: your message, Yanshi's message blocks
built from real observations, plan and approval cards, and output file cards. When a run finishes,
Yanshi offers **Start a new chat** — the runtime does not fake follow-up turns on a completed run.

## Projects vs. standalone

A standalone chat uses the global office. A chat created inside a **Project** inherits that
project's files, agent team, and atelier state. See [Chats and Projects](/concepts/projects-chats).

## If something fails

Errors never fail silently. A red toast shows a code (e.g. `YANSHI_PROVIDER_002`) and a short
reason; detailed diagnostics stay in Developer Mode and the logs. See the
[Error Catalog](/reference/error-catalog).
