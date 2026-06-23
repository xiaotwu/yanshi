# Yanshi Implementation Plan

## Current Milestone

Workshop character mascot redesign — Direction 2A dragon-horn chibi concept preview checkpoint.

Scope: the first seal-fin base rig remains implemented and tested, but its art direction has been
rejected. The current task is to render three original dragon-horn chibi girl concepts using the
owner-requested Q-version abstraction, then stop for pixel selection.
Do **not** reskin the product rig, build the six role skins, or integrate mascots into Workshop surfaces
until the user picks one concept.

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

## Pending Milestones

- Optional defense-in-depth: evaluate approval/policy checks on provider-assigned sub-actions, not only on the top-level task.
- Owner-only credentialed release execution: add Apple Developer ID secrets, updater key/feed, crash DSN, then run the signed workflow and verify Gatekeeper/staple on a second Mac.
- Owner-only push/PR creation after reviewing `PR_DESCRIPTION.md`.
- Workshop mascot redesign Direction 2A: after owner chooses one concept on pixels, reskin the existing
  rig to that concept, render all seven expressions, and stop again for visual sign-off before role skins.
- Broader product acceptance remains tracked by the feature checklist and release docs.

## Acceptance Criteria For This Milestone

- Three original dragon-horn chibi concept PNGs render with neutral + happy variants.
- Concepts use the requested Q-version abstraction: two-head proportions, thick outline, blank-cute face,
  happy face, and simplified standing pose.
- No copied reference asset, name, likeness, horn silhouette, long-hair waterfall, tactical outfit,
  copied palette identity, or marks are introduced.
- No product rig reskin, role skins, or Workshop integration is started before owner concept selection.
- Requested desktop and runtime gates pass.
