# Next Steps

_Clean list as of 2026-06-09. Completed work is in IMPLEMENTATION_LOG.md / CURRENT_STATUS.md._

## Remaining product gaps (optional polish)

- [ ] Office Editor: path/collision metadata + real agent pathfinding/avoidance.
- [ ] Live Office: modelled Q-style worker art assets; more task-state/life animations.
- [ ] Finer frontend split: `components/composer` and `components/ui` (feature-level split is done).

## Manual verification (interactive / environment)

- [ ] Grant macOS Accessibility to packaged `Yanshi.app`, verify Computer `click/type/shortcut`;
      grant Screen Recording, verify `screenshot`.
- [ ] Pre-pull `alpine:3.20`, run a Docker sandbox command, confirm stdout/stderr + log artifact.
- [ ] Verify tray actions, notifications, global shortcuts, and the close-with-active-runs prompt
      in the packaged app; record results.

## Release

- [ ] Codesign (Developer ID) + notarize + staple for public distribution
      (steps in docs/BUILD_AND_RELEASE.md).
