# Recommended MCP Services and Skills for Yanshi

## Required / strongly recommended MCP services

### 1. Filesystem / local project access

Purpose:
- Let Codex read, write, create, delete, and reorganize the project files.

Use:
- Always enabled for the repository.

### 2. GitHub MCP

Purpose:
- Create branches
- Inspect diffs
- Create commits / PRs
- Track issues
- Review file history

Use:
- Enable if the repo is on GitHub.

### 3. Context7 MCP

Purpose:
- Fetch current docs for:
  - Tauri
  - React
  - Vite
  - React Three Fiber
  - drei
  - Zustand
  - Tailwind
  - LangGraph
  - FastAPI
  - Playwright
  - SQLite
  - Docker

Use:
- Strongly recommended because Yanshi depends on fast-changing tooling.

### 4. Browser / Playwright MCP

Purpose:
- Visual smoke testing
- UI interaction testing
- Screenshot verification
- Local app testing
- Browser Use research and validation

Use:
- Strongly recommended.

### 5. Shell / terminal access

Purpose:
- Install dependencies
- Run lint/typecheck/test/build
- Run Tauri commands
- Run Python runtime tests
- Run Docker checks

Use:
- Required.

### 6. Docker access

Purpose:
- Validate Docker sandbox
- Run isolated code tasks
- Test sandbox boundary

Use:
- Recommended if Docker sandbox is part of the current milestone.

### 7. Sequential planning / reasoning skill

Purpose:
- Keep large implementation coherent
- Decompose multi-phase tasks
- Reduce drift

Use:
- Recommended if available.

## Optional MCP services

### Figma

Use only if:
- You want to import/export actual design files.
- You create detailed UI mockups outside code.

Not required for first implementation.

### Canva

Not recommended for the core build.
Useful only for marketing graphics or concept boards.

### Database / SQLite MCP

Optional.
Codex can usually inspect SQLite through scripts, migrations, and CLI.

### Memory MCP

Optional.
The repository continuation files are more important:
- `IMPLEMENTATION_LOG.md`
- `CURRENT_STATUS.md`
- `NEXT_STEPS.md`
- `ACCEPTANCE_CHECKLIST.md`

## Skills to load

Load all skills in `.agents/skills`.

Suggested attention order:

1. yanshi-product-architect
2. yanshi-no-mock-enforcer
3. yanshi-tauri-desktop-builder
4. yanshi-runtime-langgraph-builder
5. yanshi-agent-system-builder
6. yanshi-tool-sandbox-builder
7. yanshi-permission-guardian
8. yanshi-live-office-3d-builder
9. yanshi-workshop-builder
10. yanshi-quality-acceptance
11. yanshi-continuation-manager
