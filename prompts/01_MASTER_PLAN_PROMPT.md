# Yanshi Master Planning Prompt for Codex

You are starting a complete rebuild of **Yanshi**.

You have full permission to inspect the repository, propose deletion of obsolete code, create new files, install dependencies, and execute commands after I approve your plan.

Do not edit files yet.

First, read:

- `AGENTS.md`
- all `.agents/skills/*/SKILL.md`
- `docs/Yanshi_Product_Design_Spec.md`
- `docs/RECOMMENDED_MCP_AND_SKILLS.md`
- `docs/LOCAL_ENVIRONMENT_CHECKLIST.md`
- `docs/CONTINUATION_PROTOCOL.md`

Then inspect the current repository, if any.

## Goal

Create a full project plan for building Yanshi from scratch or by replacing the current project.

Yanshi must be a complete macOS-first desktop Agent workspace, not a mock demo.

Required architecture:

```txt
Tauri desktop app
React + Vite + TypeScript frontend
Tailwind CSS
Zustand state
React Three Fiber / three.js Live Office
Python Yanshi Runtime sidecar
LangGraph orchestration
Action / Observation / Tool / Sandbox execution model
SQLite persistence
REST + WebSocket
macOS Computer Use bridge
Browser Use
File tools
Terminal / Docker sandbox
Workshop customization
Menubar
Notifications
Global shortcuts
Developer Mode
```

## Strict no-mock rule

Do not plan mock user-facing features.

If a feature requires external credentials, OS permissions, Docker, or user approval, plan the real implementation and define the not-configured / permission-required state.

Do not replace real functionality with fake successful responses.

## Planning output format

Produce a complete plan with:

1. Repository assessment
2. Recommended final folder structure
3. Dependency list
4. Architecture plan
5. UI plan
6. Runtime plan
7. Tauri/macOS plan
8. Live Office 3D plan
9. Workshop plan
10. Data model and migrations
11. Event protocol
12. Permission and safety design
13. Testing plan
14. Build and release plan
15. Risks and mitigations
16. Step-by-step implementation phases
17. Exact commands you expect to run
18. Acceptance checklist

At the end, stop and ask me to approve with:

```txt
Approve the plan and start execution.
```

Do not begin implementation until I approve.
