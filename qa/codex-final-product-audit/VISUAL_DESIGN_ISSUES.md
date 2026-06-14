# Visual Design Issues

## Summary

Status: FAIL

The main chat shell is directionally strong: calm, concise, and visually cleaner than a dashboard. Final design acceptance fails on Live Office polish, menu/modal containment, project tab wrapping, and incomplete localized visual states.

## Findings

### V1. Atelier/Live Office does not look final-product ready

Status: FAIL
Severity: P1
Evidence:
- `SCREENSHOTS/phase7-atelier-open.png`
- `LOGS/playwright-atelier-modal-snapshot.md`

Observed:
- The scene opens and shows worker positions, labels, and status chips.
- Worker visuals read as procedural/fallback rather than polished 2.5D product assets.
- State labels can feel inconsistent: worker labels and bottom status chips do not always tell the same story.
- The modal is detached from the right-side progress panel and feels more like an overlay/debug toy than the main "animated virtual workers" product surface.

Expected:
- A final Yanshi Live Office should look purpose-built, stable, and directly tied to the selected run/project state.

### V2. Add-to-project submenu extends below the viewport

Status: FAIL
Severity: P2
Evidence:
- `SCREENSHOTS/phase3-add-to-project.png`
- `LOGS/playwright-add-to-project-snapshot.md`

Observed:
- At 1200x818, the submenu continues below the viewport and the lower item is partly off-screen.

Expected:
- Menus should flip upward, constrain max-height, or scroll.

### V3. Search modal result content visually escapes the modal

Status: FAIL
Severity: P2
Evidence:
- `SCREENSHOTS/phase5-search-modal.png`
- `LOGS/playwright-search-modal-snapshot.md`

Observed:
- Result groups and content extend past the visible modal surface.

Expected:
- Modal content should be contained with a fixed internal scroll region.

### V4. Project tabs wrap awkwardly

Status: FAIL
Severity: P2
Evidence:
- `SCREENSHOTS/phase6-project-page.png`
- `LOGS/playwright-project-page-snapshot.md`

Observed:
- At 1200px width, project tabs wrap and the Settings tab drops to a new line.

Expected:
- Tabs should remain a stable, scan-friendly control through horizontal scrolling, condensation, overflow menu, or fewer top-level tabs.

### V5. Workshop zh-CN visual state mixes languages

Status: FAIL
Severity: P1
Evidence:
- `SCREENSHOTS/phase14-workshop-zh.png`
- `LOGS/playwright-workshop-zh-snapshot.md`

Observed:
- Chinese shell mixed with English Workshop labels creates an unfinished visual/product feel.

Expected:
- Localized mode should keep primary controls localized across visible Workshop surfaces.

## Positive Visual Notes

- Home shell: PASS. `SCREENSHOTS/phase3-home-shell.png` shows a clean first screen with a compact composer and useful sidebar context.
- Account menu: PASS. `SCREENSHOTS/phase4-account-menu.png` contains only Profile, Personalization, Settings, Help.
- Dark theme: PASS. `SCREENSHOTS/phase18-dark-zh-home.png` renders cleanly without obvious contrast failure in the tested view.
- Provider settings honesty: PASS for visual honesty. Unsupported providers are visibly marked instead of pretending to work.
