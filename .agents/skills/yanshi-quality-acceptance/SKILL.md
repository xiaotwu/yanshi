---
name: yanshi-quality-acceptance
description: Use this skill for test strategy, acceptance checks, no-mock audits, build verification, visual smoke testing, and release readiness.
---

# Yanshi Quality Acceptance

Run all applicable checks:

- pnpm lint
- pnpm typecheck
- pnpm test
- pnpm build
- cargo check
- cargo test
- uv run pytest
- tauri build

Acceptance requires:
- app starts
- runtime starts with app
- REST works
- WebSocket works
- real run creation works
- approval pause/resume works
- persistence works
- Live Office consumes real events
- Workshop import validates real packs
- no user-facing mock remains

If a check cannot run, document exact reason and required fix.
