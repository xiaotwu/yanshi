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
- [ ] Owner must pick one of the rendered Direction 2A concept PNGs on pixels before product reskinning.
- [ ] After concept selection, reskin the existing rig to the chosen concept, render all seven expressions,
  and stop again for visual sign-off before role skins.
- [ ] After the second visual sign-off, continue with honest runtime-derived mascot state, role skins,
  Workshop integration, reduced-motion, zh/en a11y, and full gates.

## Optional / deferred (nice-to-have, not blocking)

- [ ] Per-偃师 MCP/ACP tool whitelist (was out of scope for the in-loop v1).
- [ ] If the `ReadTimeout`→"no JSON object" failure recurs, use the captured `rawResponse` to fix the provider timeout/streaming path for long reasoning-model decisions.
- [ ] A holistic pre-push review of the branch (e.g. `/code-review ultra`) before pushing/releasing.
