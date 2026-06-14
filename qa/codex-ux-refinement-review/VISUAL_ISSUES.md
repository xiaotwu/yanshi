# Visual Issues

## P1

None found in the dev UI visual pass.

## P2

### Settings modal has no visible close affordance

Status: FAIL  
Screenshots:
- `SCREENSHOTS/28-settings-960x680.png`

The modal is visually contained and scroll-safe, but there is no obvious close button. Users must know ESC/outside behavior.

Suggested fix: add a consistent top-right close icon with localized accessible label.

### Packaged app displays persistent red event-stream warning

Status: FAIL  
Screenshots:
- `SCREENSHOTS/30-packaged-app-screen.png`
- `SCREENSHOTS/31-packaged-app-after-wait.png`

The warning is visually prominent in the core first screen and undermines packaged readiness.

Suggested fix: fix packaged event stream connection; only show warning when the runtime/event channel is actually unavailable.

## P3

### New Project placeholder copy is oddly specific

Status: FAIL  
Screenshots:
- `SCREENSHOTS/20-new-project-modal-1440x900.png`

`Copenhagen Trip` works as an example, but it feels arbitrary for a general AI workspace.

Suggested fix: use `Project name` or a neutral short example.

## Passed Visual Checks

- Library layout is clean at 960x680, 1200x818, and 1600x1000.
- Add-to-Project parent menu/submenu are contained at 960x680, 1200x818, and 1440x900.
- Dark mode and zh-CN Settings surface render without visible overflow.
- Atelier modal/canvas renders and is visually contained.
