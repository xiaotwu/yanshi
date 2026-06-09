# Next Steps

_Clean list as of 2026-06-08. Completed work is in IMPLEMENTATION_LOG.md / CURRENT_STATUS.md._

## Remaining product gaps

- [ ] Office Editor: add furniture placement + path/collision metadata (stations + areas done).
- [ ] Live Office: replace procedural mechanical figures with modelled Q-style worker assets;
      add more task-state/life animations.
- [ ] Split `apps/desktop/src/App.tsx` into `features/*` + `components/*` per spec §7.

## Manual verification (interactive / environment)

- [ ] Grant macOS Accessibility to packaged `Yanshi.app`, verify Computer `click/type/shortcut`.
- [ ] Pre-pull `alpine:3.20`, run a Docker sandbox command, confirm stdout/stderr + log artifact.
- [ ] Verify tray actions, notifications, global shortcuts, and the close-with-active-runs prompt
      in the packaged app; record results.

## Release

- [ ] Codesign (Developer ID) + notarize + staple for public distribution
      (steps in docs/BUILD_AND_RELEASE.md).
