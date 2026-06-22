# Yanshi Implementation Plan

## Current Milestone

Task 5: reconcile runtime tool-execution tests with the bounded ReAct loop.

## Completed Milestones

- Replaced the old plan-once manager/execute graph with `decide -> act -> decide -> finalizer`.
- Ported policy-blocked, plan-first approval, approval resume, and missing-model behavior into the decide loop.
- Removed the no-provider keyword shortcut; tool runs require a configured provider.
- Reconciled tool, provider, model-routing, project, automation, and gating tests to seed explicit provider decisions.
- Chose hard-gate failure semantics for disabled tools, worker whitelist blocks, and invalid Docker settings.
- Removed the dead linear manager/execute graph helpers after the runtime suite passed.

## Pending Milestones

- Optional defense-in-depth: evaluate approval/policy checks on provider-assigned sub-actions, not only on the top-level task.
- Broader product acceptance remains tracked by the feature checklist and release docs.

## Acceptance Criteria For This Milestone

- Runtime suite passes with no expected failures.
- Tool-gating failures assert honest observations and failed run status.
- Tests use provider-seeded manager decisions instead of no-provider shortcuts.
- Dead linear graph helpers are removed without deleting live per-agent tool executors.
