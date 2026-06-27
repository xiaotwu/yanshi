# Usage

Yanshi is chat-first. Start with a plain-language request, then let the runtime plan, act, ask for
approval when needed, and return files or outputs.

## Start a Chat

1. Open Yanshi.
2. Choose **New Chat**.
3. Type a task in natural language.
4. Attach files or choose a project if the work belongs to a larger context.
5. Submit and watch progress in the chat, progress panel, and Yanshi Atelier.

## Projects

Projects group chats, files, outputs, agent settings, and Atelier state. Use a project when work
should share context across multiple chats.

## Tools

Yanshi can use real tools when they are available:

- File tools for workspace files and outputs.
- Browser tools through Playwright.
- Computer Use through macOS permissions.
- Terminal and Docker tools for sandboxed command work.

If a tool is not configured or permission is missing, Yanshi reports that state instead of
pretending the action succeeded.

## Approvals

Risky actions pause for approval. Review the request, approve or deny it, and Yanshi resumes from
the real decision.

## Settings

Use Settings to configure:

- Model providers.
- API keys.
- macOS permissions.
- Appearance and shortcuts.
- Developer Mode detail.

## Files and Outputs

Generated files appear in the chat and Library with real names and paths. Project-scoped work keeps
outputs attached to the project.
