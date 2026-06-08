# Yanshi Final Acceptance Prompt for Codex

Perform a full acceptance pass on Yanshi.

Do not add new features unless required to make acceptance pass.

## Check these areas

1. No user-facing mocks or fake successful behavior.
2. Tauri desktop app starts.
3. Python Yanshi Runtime starts and stops with desktop app.
4. REST API works.
5. WebSocket event stream works.
6. SQLite persistence works.
7. LangGraph checkpointing works.
8. Agent run creation works.
9. Manager assigns work.
10. Agent queues work.
11. Action / Observation model works.
12. Approval flow pauses and resumes.
13. File tool uses real workspace sandbox.
14. Browser tool has real execution or real not-configured state.
15. Computer Use has real macOS permission bridge or real permission-required state.
16. Terminal / Docker sandbox works or shows real Docker-required state.
17. New Task page works.
18. Composer config works.
19. Projects work.
20. Runs and Run Details work.
21. Workshop import / validation works.
22. Live Office consumes real events.
23. Menubar works.
24. Notifications work.
25. Global shortcuts work.
26. Settings normal mode is concise.
27. Developer Mode exposes real runtime state.
28. Light / Dark UI works.
29. Build passes.
30. Tests pass.

## Run checks

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

Also do a manual smoke test:

- Start app
- Create task
- See run start
- See events stream
- Trigger approval
- Approve/deny
- See artifact
- Open Live Office
- Open Developer Mode
- Quit app with running task prompt

## Final response

Provide:

- PASS / FAIL
- exact commands run
- exact failures if any
- no-mock audit result
- remaining external requirements
- release readiness status
