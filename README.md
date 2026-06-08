# Yanshi Codex Start Kit

This package contains the files and prompts to start a full rebuild of **Yanshi** with Codex.

Yanshi is a macOS-first AI Agent desktop workspace powered by:

- Tauri desktop shell
- React + Vite + TypeScript UI
- React Three Fiber / three.js Live Office
- Python Yanshi Runtime
- LangGraph orchestration
- Action / Observation / Tool / Sandbox execution model
- SQLite persistence
- macOS permissions, menubar, notifications, shortcuts
- Workshop customization

## How to use

1. Create a new empty repository or clean the current repository.
2. Copy `AGENTS.md`, `.agents/skills/`, and `docs/` into the repo root.
3. Open a new Codex conversation.
4. Paste `prompts/01_MASTER_PLAN_PROMPT.md`.
5. Let Codex produce a complete plan first.
6. After you approve the plan, paste `prompts/02_EXECUTION_PROMPT.md`.
7. If usage runs out, start a new Codex conversation and paste `prompts/03_CONTINUATION_PROMPT.md`.
8. Before shipping or accepting the project, paste `prompts/04_ACCEPTANCE_PROMPT.md`.

## Important rule

No user-facing mock, fake, placeholder, scaffold-only, demo-only, or “coming soon” implementation is acceptable.

If an external permission, model API key, OS entitlement, Docker daemon, or user approval is required, implement the real integration path and show a clear not-configured or permission-required state. Do not fake successful execution.

## Included files

- `AGENTS.md`
- `.agents/skills/*/SKILL.md`
- `docs/Yanshi_Product_Design_Spec.md`
- `docs/RECOMMENDED_MCP_AND_SKILLS.md`
- `docs/LOCAL_ENVIRONMENT_CHECKLIST.md`
- `docs/CONTINUATION_PROTOCOL.md`
- `prompts/01_MASTER_PLAN_PROMPT.md`
- `prompts/02_EXECUTION_PROMPT.md`
- `prompts/03_CONTINUATION_PROMPT.md`
- `prompts/04_ACCEPTANCE_PROMPT.md`
