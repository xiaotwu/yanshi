# Chats and Projects

## Chats

**Chat** is the user-facing unit of work. You start a New Chat, describe a task, and Yanshi runs
it. Internally a chat is a runtime *run*; the schemas, APIs, and Developer Mode keep that
terminology, but the UI says Chat / 对话 throughout.

Recent chats live in the sidebar. Opening one shows the full conversation rebuilt from real
events. A finished run cannot be continued, so Yanshi honestly offers **Start a new chat** rather
than faking a follow-up turn.

## Projects

A **Project** is a focused workspace, not a dashboard. The project page is a header (icon · name ·
status · "…" menu), a project-scoped composer ("New chat in X"), and **Tasks | Files** pills.
Secondary surfaces — Agents, Automations, Atelier, Activity, Settings — open from the "…" menu as
centered modals.

Each project owns:

- its own **chats** and **files** (a sandboxed workspace folder),
- an **agent team**, and
- its **atelier office state** (layout + worker instances).

## Scope rules

- A **standalone chat** uses the global office state.
- A **chat inside a project** inherits that project's office, team, and files.
- Switching the active project switches the atelier context with it.
- Opening a recent chat switches context to that chat's project (or global).

## Add to Project

The composer's "Add to Project" lists real projects only (plus "New project…"). There is no
"Standalone" pseudo-project — no selection simply means standalone. "Remove from Project" appears
only while a project is selected.
