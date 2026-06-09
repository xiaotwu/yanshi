# Next Steps

_Clean list as of 2026-06-09. Completed work is in IMPLEMENTATION_LOG.md / CURRENT_STATUS.md._

## Remaining product gaps (optional polish)

- [ ] Office Editor: path/collision metadata + real agent pathfinding/avoidance.
- [ ] Live Office: modelled Q-style worker art assets; more task-state/life animations.
- [ ] Finer frontend split: `components/composer` and `components/ui` (feature-level split is done).

## Manual verification (interactive — environment/human-only)

- [x] Docker sandbox command smoke (alpine:3.20, daemon up) — verified 2026-06-09.
- [ ] Grant macOS Accessibility to packaged `Yanshi.app`, verify Computer `click/type/shortcut`;
      grant Screen Recording, verify `screenshot`. (Honest permission-required state verified.)
- [ ] `playwright install chromium` in the runtime, then verify real Browser navigation.
- [ ] Human interactive pass: tray actions, notifications, global shortcuts, close-with-active-runs
      prompt, Light/Dark/System switch in the packaged app.

## Release

- [ ] Codesign (Developer ID) + notarize + staple for public distribution
      (steps in docs/BUILD_AND_RELEASE.md).
