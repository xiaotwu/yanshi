# Yanshi Continuation Prompt for Codex

Continue the unfinished Yanshi implementation.

First read:

- `AGENTS.md`
- all `.agents/skills/*/SKILL.md`
- `docs/Yanshi_Product_Design_Spec.md`
- `IMPLEMENTATION_PLAN.md`
- `IMPLEMENTATION_LOG.md`
- `CURRENT_STATUS.md`
- `NEXT_STEPS.md`
- `ACCEPTANCE_CHECKLIST.md`

Then inspect the current repository state.

Do not restart from scratch unless the status files explicitly say the project is unrecoverable.

## Continue rules

- Continue from the next unfinished milestone.
- Preserve already working code.
- Fix failing tests/builds before adding unrelated features.
- Do not introduce user-facing mocks.
- Keep updating continuation files.
- Run verification after each meaningful phase.
- If you encounter a blocker, implement the real not-configured / permission-required state and document the next action.

## Required output before editing

Briefly summarize:

1. Current phase
2. What is already complete
3. What is broken
4. What you will do next
5. Commands you will run

Then continue implementation.
