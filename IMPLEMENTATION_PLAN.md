# Yanshi Implementation Plan

## Current Milestone

Workshop character mascot redesign — Direction 2A Concept A selected-rig visual sign-off checkpoint.

Scope: the owner picked Concept A (Paper-Lantern Dragon Apprentice). The current task is to reskin the
existing seven-expression `MascotRig` to Concept A, export the full expression preview, and stop for
visual sign-off.
Do **not** build the six role skins or integrate mascots into Workshop surfaces until the user visually
signs off this selected rig preview.

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

## Pending Milestones

- Optional defense-in-depth: evaluate approval/policy checks on provider-assigned sub-actions, not only on the top-level task.
- Owner-only credentialed release execution: add Apple Developer ID secrets, updater key/feed, crash DSN, then run the signed workflow and verify Gatekeeper/staple on a second Mac.
- Owner-only push/PR creation after reviewing `PR_DESCRIPTION.md`.
- Workshop mascot redesign Direction 2A: after selected-rig visual sign-off, continue with honest
  runtime-derived mascot state, role skins, Workshop integration, and motion/a11y polish through TDD.
- Broader product acceptance remains tracked by the feature checklist and release docs.

## Acceptance Criteria For This Milestone

- Selected Concept A rig renders as accessible inline SVG with all seven expressions.
- Selected rig uses the requested Q-version abstraction: two-head proportions, thick outline, blank-cute
  face, happy face, and simplified standing pose.
- No copied reference asset, name, likeness, horn silhouette, long-hair waterfall, tactical outfit,
  copied palette identity, or marks are introduced.
- No role skins or Workshop integration is started before owner visual sign-off.
- Requested desktop and runtime gates pass.
