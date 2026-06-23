# Yanshi Implementation Plan

## Current Milestone

Workshop character mascot redesign — increment 2 visual sign-off checkpoint.

Scope: base layered inline-SVG rig, expression set, theme-token bindings, and tests are implemented.
Do **not** build the six role skins or integrate mascots into Workshop surfaces until the user visually
signs off this base rig.

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

## Pending Milestones

- Optional defense-in-depth: evaluate approval/policy checks on provider-assigned sub-actions, not only on the top-level task.
- Owner-only credentialed release execution: add Apple Developer ID secrets, updater key/feed, crash DSN, then run the signed workflow and verify Gatekeeper/staple on a second Mac.
- Owner-only push/PR creation after reviewing `PR_DESCRIPTION.md`.
- Workshop mascot redesign increment 3+: after visual sign-off, implement the runtime-derived state
  selector, role skins, Workshop integration, and motion/a11y polish through TDD.
- Broader product acceptance remains tracked by the feature checklist and release docs.

## Acceptance Criteria For This Milestone

- Base rig renders as accessible inline SVG.
- Expression set covers `neutral`, `happy`, `thinking`, `focused`, `surprised`, `error`, and `sleeping`.
- Mascot SVG presentation uses CSS variables, not hard-coded brand colors.
- Reduced-motion-safe class/data hooks are present.
- No role skins or Workshop integration is started before visual sign-off.
- Requested desktop and runtime gates pass.
