# Yanshi Full Execution Prompt for Codex

I approve the Yanshi plan.

Start execution now.

You have full permission to:

- create the project from scratch
- delete obsolete project files
- restructure directories
- install dependencies
- run package managers
- run tests
- run builds
- add migrations
- create runtime code
- implement UI
- implement desktop integration
- implement real tool paths
- update documentation

## Non-negotiable rules

1. No user-facing mock, fake, scaffold-only, demo-only, placeholder, or “coming soon” features.
2. If a real feature needs credentials, OS permission, Docker, browser binaries, or a running service, implement the real integration path and surface a real not-configured / permission-required state.
3. Keep normal UI concise.
4. Put technical details in Developer Mode.
5. Maintain continuation files after every phase:
   - `IMPLEMENTATION_PLAN.md`
   - `IMPLEMENTATION_LOG.md`
   - `CURRENT_STATUS.md`
   - `NEXT_STEPS.md`
   - `ACCEPTANCE_CHECKLIST.md`
6. Run verification after each major milestone.
7. Do not claim completion until tests and builds pass or the exact external blocker is documented.

## Build order

Follow this order unless you discover a better one and explain why:

1. Monorepo setup
2. Tauri + React + Vite desktop shell
3. Python runtime sidecar
4. REST + WebSocket runtime API
5. SQLite schema and migrations
6. LangGraph runtime skeleton
7. Event protocol
8. Agent profiles and instances
9. Run creation and event streaming
10. Permission and approval flow
11. File tool and workspace sandbox
12. Browser tool
13. Computer Use bridge
14. Terminal / Docker sandbox
15. New Task UI and composer
16. Projects
17. Runs and Run Details
18. Workshop pack import / validation
19. Live Office 3D
20. Menubar, notifications, shortcuts
21. Developer Mode
22. Full verification
23. Final docs

## Verification commands

Run all applicable checks:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
cargo check
cargo test
uv run pytest
tauri build
```

Use the repo’s actual scripts if different.

## Final response

When finished, provide:

- summary
- files changed
- tests run
- build status
- remaining external setup requirements
- no-mock verification
- how to run the app
