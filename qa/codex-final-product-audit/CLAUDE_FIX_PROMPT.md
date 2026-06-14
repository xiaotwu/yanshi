# Claude Fix Prompt

You are Claude, the implementation agent for Yanshi. Fix the final product QA blockers reported by Codex. Do not treat this as a cosmetic pass: the app is not accepted until the failing and blocked items below are resolved and re-verified.

## Ground Rules

- Preserve the no-mock policy. Do not fake successful Browser, Computer, provider, Workshop, approval, or runtime behavior.
- Keep Yanshi terminology: Yanshi Runtime, agents, approvals, tools, projects, Workshop, Atelier/Live Office.
- Keep normal mode clean and non-technical. Put technical details behind Developer Mode, hover cards, or expandable details.
- Update the required continuation docs after each major phase.
- Run and document the full verification stack before handoff.

## Highest Priority Fixes

1. Fix packaged runtime lifecycle.
   - Ensure only one compatible runtime owns `127.0.0.1:8765`, or make desktop attach/recover safely.
   - If bind/start fails, show a blocking runtime error and prevent dead runs.
   - Add tests for repeated launch, stale sidecar detection, runtime restart, and stuck-created recovery.
   - Evidence: `qa/codex-final-product-audit/LOGS/api-runs-after-ui-run.json`, `phase9-runtime-log-after-ui-run-tail.log`.

2. Finish release signing path.
   - Add documented Developer ID signing/notarization/stapling flow.
   - Verify Gatekeeper on a clean Mac.
   - Evidence: `phase1-09-pnpm-desktop-release.log`.

3. Make Browser Use real in the packaged app.
   - Bundle/provision Playwright Chromium for the Python sidecar, or provide a first-run install flow.
   - Preflight Browser Agent readiness before a user starts browser work.
   - Verify navigation, screenshot, DOM extraction, and missing-binary recovery.

4. Add macOS permission preflight and retry UX for Computer Use.
   - Accessibility for click/type/shortcut.
   - Screen Recording for screenshot/observe.
   - Deep-link or clear instructions to System Settings.
   - Verify after permission grant.

5. Finish provider runtime support or narrow the release scope honestly.
   - Implement real registry/default provider behavior, health checks, model selection, and per-run use.
   - Do not show Anthropic/Gemini as final supported if they remain unimplemented.
   - Add provider tests with no raw secret persistence.

6. Complete Projects as agent offices.
   - Expose context mode in project create/edit.
   - Add first-class agent team management/state.
   - Fix tab wrapping at 1200px and smaller widths.

7. Complete Workshop.
   - Verify import/export/validation flows end to end.
   - Localize Workshop labels.
   - Reject unsafe packs with clear errors.

8. Polish Atelier/Live Office.
   - Replace fallback-looking procedural workers with final visual treatment.
   - Bind displayed worker states to current run/project state only.
   - Avoid stale/mixed labels.

9. Fix menu and modal containment.
   - Add-to-project submenu must stay within viewport.
   - Search results must scroll inside the modal.

10. Add meaningful JS/frontend tests.
   - `pnpm test` must not be green solely because no tests exist.

## Re-Verification Required

After fixes, rerun:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
cargo check --manifest-path apps/desktop/src-tauri/Cargo.toml
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml
uv run --project runtime/python pytest
pnpm desktop:release
```

Then launch the packaged app and verify:

- clean launch and repeated relaunch
- real run creation
- event streaming
- approval approve and deny
- persistence after restart
- File, Browser, Computer, Terminal/Docker tools
- Workshop import/export/validation
- Settings/theme/language/provider state
- Projects and agent-team controls
- Live Office/Atelier real state
- macOS permissions, notifications, global shortcut, menubar, close behavior
- signing/notarization/Gatekeeper

Use the Codex QA reports in `qa/codex-final-product-audit/` as the acceptance checklist.
