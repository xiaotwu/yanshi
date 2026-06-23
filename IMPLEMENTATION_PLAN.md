# Yanshi Implementation Plan

## Current Milestone

Workshop character mascot redesign — Increment 4 role skins checkpoint.

Scope: the owner picked Concept A (Paper-Lantern Dragon Apprentice) and visually signed off the selected
seven-expression rig preview. Increment 3 added the pure `deriveMascotState` selector. The current task
is to add the six role skins as shared-rig variants only.
Do **not** integrate mascots into Workshop surfaces until Increment 5.

## Completed Milestones

- Replaced the old plan-once manager/execute graph with `decide -> act -> decide -> finalizer`.
- Ported policy-blocked, plan-first approval, approval resume, and missing-model behavior into the decide loop.
- Removed the no-provider keyword shortcut; tool runs require a configured provider.
- Reconciled tool, provider, model-routing, project, automation, and gating tests to seed explicit provider decisions.
- Chose hard-gate failure semantics for disabled tools, worker whitelist blocks, and invalid Docker settings.
- Removed the dead linear manager/execute graph helpers after the runtime suite passed.
- Added owner release scaffolding: fail-loud signed release guard, updater/crash disabled-until-configured state, and a workflow dry-run path that builds unsigned artifacts without Apple secrets.
- Wrote and signed off the Workshop mascot spec: Concept A base, Concept C role props, Concept B state
  accent only, inline SVG, and honest runtime-derived state.
- Implemented the increment 2 base mascot rig with seven expressions, tokenized SVG presentation, and
  reduced-motion-safe hooks.
- Recorded Direction 2A: the prior seal-fin art direction is superseded; three original dragon-horn
  chibi concepts are being rendered for owner visual selection while preserving the rig engineering,
  seven expressions, and honest runtime-derived state contract.
- Owner selected Concept A, and the existing `MascotRig` is being reskinned to Paper-Lantern Dragon
  Apprentice without changing the public component API or honesty contract.
- Owner visually signed off the selected Concept A seven-expression rig preview.
- Added the Increment 3 TDD tests and implementation for `deriveMascotState`.
- Added Increment 4 focused TDD for six role skins, each using the shared rig with a role-specific
  tokenized prop/crest.

## Pending Milestones

- Optional defense-in-depth: evaluate approval/policy checks on provider-assigned sub-actions, not only on the top-level task.
- Owner-only credentialed release execution: add Apple Developer ID secrets, updater key/feed, crash DSN, then run the signed workflow and verify Gatekeeper/staple on a second Mac.
- Owner-only push/PR creation after reviewing `PR_DESCRIPTION.md`.
- Workshop mascot redesign Increment 5+: after role skins are green/committed, continue with Workshop
  integration and motion/a11y polish through TDD.
- Broader product acceptance remains tracked by the feature checklist and release docs.

## Acceptance Criteria For This Milestone

- Six role skins render through the shared Concept A `MascotRig`.
- Every skin exposes a role-specific prop/crest without hard-coded SVG colors.
- Role skin lookup falls back to manager for unknown/custom stations instead of inventing a new skin.
- No Workshop integration is started in this increment.
- Requested desktop and runtime gates pass.
