# Yanshi — UI/UX / Naming / Atelier Refinement Pass Report (2026-06-11)

## 1. Verdict

**PASS** — all six work items (A–F) implemented and verified; one item (packaged titlebar
pixel check) is machine-verification-limited and needs a one-glance human confirmation.

## 2. Summary of changes

- **A Titlebar:** `trafficLightPosition {x:14, y:14}` (set in the previous pass) is the active
  config: with the 12px traffic-light glyphs that centers them at y=20 — exactly the vertical
  center of the 40px titlebar where the chrome buttons sit. The config is build-validated and the
  packaged app launches; an actual pixel screenshot could not be captured from this environment
  (no Screen Recording/Automation grant for the agent shell), so the visual baseline needs one
  human glance in the packaged app. Drag region and hit targets untouched.
- **B Profile:** the workspace/version/runtime metadata rows are gone; the page now contains only
  user-editable identity (avatar, display name, workspace label, background). Runtime details
  remain available in Developer → Runtime.
- **C ACP/MCP add buttons:** icon-only plus buttons (`.icon-action accent`) with tooltip +
  aria-label (添加 Agent / 添加服务器); behavior unchanged.
- **D Atelier reopen bug:** fixed (root cause below) — 6/6 immediate reopen cycles plus
  project↔standalone switching verified live, zero fallbacks; packaged app relaunch verified.
- **E zh naming:** new `brand` key (en "Yanshi" / zh "偃师") replaces every hardcoded product
  name in normal-mode UI: account block fallback, profile preview, chat author labels, unknown-
  agent fallback, ACP foundation copy, and the four desktop-notification titles (now locale-
  aware). English locale unchanged; code identifiers unchanged.
- **F Worker design first pass:** see §5.

## 3. Files changed

- `apps/desktop/src/components/error-boundary.tsx` — cached + released WebGL probe
- `apps/desktop/src/features/settings.tsx` — profile cleanup, probe release, brand fallback
- `apps/desktop/src/features/ai-integrations.tsx` — icon-only add buttons
- `apps/desktop/src/features/live-office.tsx` — chibi worker chips in the simplified 2D view
- `apps/desktop/src/features/runs.tsx`, `lib/shared.tsx` — brand-aware author/agent labels
- `apps/desktop/src/components/account-menu.tsx` — brand fallback
- `apps/desktop/src/stores/runtimeStore.ts` — locale-aware notification titles
- `apps/desktop/src/i18n/en.ts` / `zh.ts` — brand + notify keys; 3 obsolete profile keys removed;
  zh ACP copy 偃师
- `apps/desktop/src/styles.css` — worker-chip styles
- `packages/live-office/src/characters.ts` — worker archetype design system
- `packages/live-office/src/index.tsx` — context release on unmount; chibi figures; station desks

## 4. Root cause of the Atelier reopen bug

`webglAvailable()` created a **new WebGL context on every call and never released it**, and it
ran on **every render** of `AtelierStage` (hover/state changes included). WKWebView — the Tauri
webview — caps live WebGL contexts per page and reclaims them only on GC. After enough renders
and open/close cycles the cap was exhausted: context creation failed, the availability probe
returned false, and the Atelier rendered its fallback forever ("cannot be opened") until a force
quit reset the webview. Fix: the probe runs once per session and releases its context via
`WEBGL_lose_context`; the Developer-page `webglInfo()` probe releases too; and the R3F canvas
context is explicitly force-lost on unmount as a guarantee (R3F v9 usually does this itself —
verified by "THREE.WebGLRenderer: Context Lost" on every close).

## 5. Worker design — what this pass implements

**Implemented (first-pass, honest intermediate):**
- A worker **design system** in `characters.ts`: three chibi archetypes with palette,
  proportions, posture and headwear tokens — Coordinator (Manager: warm amber, upright, antenna),
  Scout (Browser/Computer: soft blue, leaning, forehead visor), Maker (File/Terminal/Reviewer:
  sage green, hunched, work cap).
- The 3D figures rebuilt from those tokens as **procedural chibi characters**: big soft head,
  squat round body, belly patch, the agent's own accent as a scarf, blush dots, sleepy line-eyes
  when idle/napping vs. focused eyes while working, gentle wobble/typing/breathing motion
  (replacing the old robot spin).
- **Desk scenes:** every work station has a mini desk with a tilted screen, mug and role prop,
  plus a rug under the meeting table — workers read as "little colleagues at their desks".
- The simplified (no-WebGL) view shares the language via CSS-only chibi face chips (sleepy/awake
  eyes by status).
- State behavior preserved: standalone chats reset to the global office, project chats inherit
  the project office, reopen preserves context; `lowPower`/reduced-motion still respected.

**Explicitly NOT implemented (future work, not faked):**
- Modelled/rigged GLB characters and a real animation set (the `characterRegistry` GLB slots stay
  `null`; `usesFallbackProceduralWorker` stays true).
- Walk cycles/pathfinding (lerp movement unchanged), richer per-role idle acts, art-directed
  texturing/lighting.

## 6. Remaining future work

- GLB character production + Workshop appearance packs (registry is ready).
- Packaged titlebar pixel confirmation (human glance).
- P3 backlog unchanged (lifespan migration, chunk split, recents titles, spec divergence).

## 7. Commands run

`pnpm lint` PASS · `pnpm typecheck` PASS (in lint) · `pnpm test` PASS (34/34) · `pnpm build`
PASS · `uv run --project runtime/python pytest` PASS (79/79) · `cargo check` PASS · `cargo test`
PASS (11/11) · `pnpm desktop:release` PASS (×2, final includes all changes).

## 8. Manual smoke results

| Check | Result |
|---|---|
| Atelier open→close→reopen ×6 (live canvas each time, no fallback) | PASS |
| Atelier reopen after project ↔ standalone switch | PASS |
| Contexts freed on close ("Context Lost" each cycle; no accumulation) | PASS |
| Profile page: no metadata rows; preview fallback 偃师 | PASS |
| ACP add icon-only (aria 添加 Agent) / MCP add icon-only (aria 添加服务器) | PASS |
| zh-CN account block fallback 偃师; ACP copy 偃师; notifications locale-aware | PASS |
| Chibi workers + desks visible in Atelier (screenshot aref-01) | PASS |
| Packaged launch healthy (5s) + clean quit, no orphan | PASS |
| Packaged titlebar pixel baseline | NEEDS HUMAN GLANCE (no screen-capture grant) |

Evidence: `aref-01-chibi-workers.png`, `aref-02-mcp-icon-add.png`.

## 9. Known remaining issues

- Titlebar alignment is config-correct but visually unconfirmed from this environment.
- Worker visuals are first-pass procedural; modelled 3D pending (documented above).
- Pre-existing P3 warnings (FastAPI deprecation, vite chunk size) untouched.
