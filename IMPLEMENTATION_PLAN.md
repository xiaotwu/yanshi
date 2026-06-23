# Yanshi Implementation Plan

## Current Milestone

Workshop character mascot redesign — increment 1 sign-off package.

Scope: produce the superpowers brainstorm, sign-off spec, and TDD implementation plan for original
theme-token-driven 偃师 mascots. Do **not** mass-produce role variants or replace existing worker art
until the user signs off the key design decisions.

## Completed Milestones

- Replaced the old plan-once manager/execute graph with `decide -> act -> decide -> finalizer`.
- Ported policy-blocked, plan-first approval, approval resume, and missing-model behavior into the decide loop.
- Removed the no-provider keyword shortcut; tool runs require a configured provider.
- Reconciled tool, provider, model-routing, project, automation, and gating tests to seed explicit provider decisions.
- Chose hard-gate failure semantics for disabled tools, worker whitelist blocks, and invalid Docker settings.
- Removed the dead linear manager/execute graph helpers after the runtime suite passed.
- Added owner release scaffolding: fail-loud signed release guard, updater/crash disabled-until-configured state, and a workflow dry-run path that builds unsigned artifacts without Apple secrets.

## Pending Milestones

- Optional defense-in-depth: evaluate approval/policy checks on provider-assigned sub-actions, not only on the top-level task.
- Owner-only credentialed release execution: add Apple Developer ID secrets, updater key/feed, crash DSN, then run the signed workflow and verify Gatekeeper/staple on a second Mac.
- Owner-only push/PR creation after reviewing `PR_DESCRIPTION.md`.
- Workshop mascot redesign increment 2+: after user sign-off, implement the tokenized SVG rig,
  runtime-derived state selector, role skins, Workshop integration, and motion/a11y polish through TDD.
- Broader product acceptance remains tracked by the feature checklist and release docs.

## Acceptance Criteria For This Milestone

- Brainstorm note documents 2-3 original silhouette/style concepts and the explicit IP boundary.
- Spec under `docs/superpowers/specs/` captures rendering, layer, rig, state, and asset-pipeline
  decisions awaiting user sign-off.
- Plan under `docs/superpowers/plans/` decomposes post-sign-off work into task-sized TDD commits.
- No Arknights asset, name, or likeness is added to the repo.
- Requested desktop and runtime gates pass for the docs-only increment.
