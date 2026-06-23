# Yanshi Implementation Plan

## Current Milestone

Workshop character mascot redesign — Increments 5/6 Workshop integration and polish complete.

Scope: the owner picked Concept A (Paper-Lantern Dragon Apprentice), visually signed off the selected
seven-expression rig preview, and then asked to complete the remaining mascot work. The Workshop now
hosts the shared mascot rig in the rail, inspector, and editable preview, with role skins and honest
runtime-derived state.

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
- Integrated the shared mascot rig into Workshop surfaces, with localized accessible labels, reduced
  motion/hidden-document static state, and no duplicated 3D workers behind the overlay.

## Pending Milestones

- Optional defense-in-depth: evaluate approval/policy checks on provider-assigned sub-actions, not only on the top-level task.
- Owner-only credentialed release execution: add Apple Developer ID secrets, updater key/feed, crash DSN, then run the signed workflow and verify Gatekeeper/staple on a second Mac.
- Owner-only push/PR creation after reviewing `PR_DESCRIPTION.md`.
- Broader product acceptance remains tracked by the feature checklist and release docs.

## Acceptance Criteria For This Milestone

- Workshop rail, inspector, and preview render the shared Concept A `MascotRig`.
- State/expression/status is derived from real runtime/store signals.
- Existing Workshop drag/edit behavior remains intact.
- 3D stage workers are hidden in Workshop preview to avoid duplicate mascots.
- zh/en accessible labels and status text are complete.
- Mascot motion respects reduced-motion and hidden-document state.
- Requested desktop and runtime gates pass.
