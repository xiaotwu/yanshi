# Yanshi Next Steps

_Last updated: 2026-06-23._

## Done (iterative-agent-loop program)

- [x] Reconcile tool tests with the ReAct loop; remove dead linear graph helpers.
- [x] Validate the loop live against a real provider (eval 3/3 + multi-step feed-back + honest failures).
- [x] Fix scalar-answer rejection and add raw-response capture on manager decision failures.
- [x] Per-assigned-action policy/approval defense-in-depth (Handoff C).
- [x] MCP tools callable inside the loop — Handoff B Increment 1.
- [x] ACP agents callable inside the loop — Handoff B Increment 2.
- [x] Scaffold credentialed owner release plumbing — Handoff D (signing fail-loud, updater/crash disabled-until-configured).
- [x] Add non-credentialed release dry-run prep — Handoff D (manual unsigned workflow path, config tests, owner setup checklist, PR description).
- [x] Broader app/build gates (desktop test/typecheck/build, cargo check/test) — all green.

## Remaining — owner-credentialed only (an agent cannot do these)

- [ ] Run the Apple Developer ID signing + notarization release (add the repo secrets, trigger `release.yml`, verify Gatekeeper/staple). Runbook: `docs/BUILD_AND_RELEASE.md`.
- [ ] Provide the auto-update feed + updater signing keypair to activate the updater scaffold.
- [ ] Provide the crash-reporting DSN to activate the (scrubbing, opt-in) crash reporter.
- [ ] Optional smoke before secrets: run GitHub Actions → Release → Run workflow with `dry_run=true`.
- [ ] Decide when to push the branch to `origin`/open a PR (currently held local per instruction).

## Workshop mascot redesign

- [x] User signed off the key decisions in
  `docs/superpowers/specs/2026-06-23-workshop-character-mascot-system-design.md`.
- [x] Increment 2 from
  `docs/superpowers/plans/2026-06-23-workshop-character-mascot-system.md`: tokenized SVG rig + tests.
- [x] Direction 2A recorded: discard the seal-fin art direction and prepare original dragon-horn chibi
  girl concepts while keeping rig engineering and the honest state contract.
- [x] Owner picked Concept A (Paper-Lantern Dragon Apprentice).
- [x] Reskin the existing rig to Concept A and render all seven expressions.
- [x] Owner visually signed off
  `docs/superpowers/previews/2026-06-23-workshop-character-direction-2-dragon-girl/concept-a-selected-rig-seven-expressions.png`
  before role skins.
- [x] Increment 3 focused TDD: `deriveMascotState` maps real run/event/approval/provider/partial-answer
  inputs to mascot state, expression, motion, busy, and celebration flags.
- [x] Finish Increment 3 full gates and commit.
- [x] Increment 4 focused TDD: add six shared-rig role skins with tokenized role props.
- [x] Finish Increment 4 full gates and commit.
- [x] Increment 5 focused TDD: integrate the mascot rig into WorkerRail, WorkerInspector, and
  AtelierPreview while preserving drag/edit behavior and avoiding duplicated 3D workers.
- [x] Increment 6 polish: runtime-derived view-model, zh/en accessible labels, reduced-motion /
  hidden-document static state, docs, and full gates.

## Optional / deferred (nice-to-have, not blocking)

- [ ] Per-偃师 MCP/ACP tool whitelist (was out of scope for the in-loop v1).
- [ ] If the `ReadTimeout`→"no JSON object" failure recurs, use the captured `rawResponse` to fix the provider timeout/streaming path for long reasoning-model decisions.
- [ ] A holistic pre-push review of the branch (e.g. `/code-review ultra`) before pushing/releasing.
