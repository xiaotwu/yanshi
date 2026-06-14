# Yanshi Atelier Worker Character Design System — Pass Report (2026-06-11)

## 1. Verdict

**PASS.**

## 2. What this pass delivered

- **Design specification:** `docs/YANSHI_ATELIER_WORKER_DESIGN.md` — full system per the brief:
  product role (workers mirror real agents; idle animation is decorative and labeled so), visual
  principles (chibi desk-worker, 偃师 puppet-maker motif, mint accent reserved for active work),
  anatomy, six role archetypes with all pose definitions, animation-state catalog,
  state-to-runtime mapping with precedence rules, asset architecture + registry, fallback rules,
  Workshop integration (future, not faked).
- **Six distinct role designs implemented** (procedural chibi, `ROLE_DESIGNS` in characters.ts):
  Manager (amber + antenna), Reviewer (bronze + monocle), Browser (sky + visor band), Computer
  (periwinkle + headset), File (sage + cap), Terminal (deep teal + beanie). Verified visually:
  all six identifiable at a glance (SCREENSHOTS/wd-01-workers-light-zh.png).
- **Pose/state system:** working (lean-in + typing bob + mint glow eyes), idle (breathing +
  sleepy line-eyes), blocked/failed (slump + half-lidded eyes + red ring, no motion), waiting
  approval (tilt-up + amber ring, still), completed (bounce), nap/stretch life poses. Task states
  come only from real runtime status; life states only when idle.
- **Normal mode is tooltip-only:** floating worker labels removed from normal mode (hover card
  carries name/role/state/task/queue/fatigue, now localized); Developer Mode re-enables floating
  debug labels and the meta chips. Verified: 0 labels in normal mode, 6 + meta in Developer Mode.
- **Localization:** 13 new state/life/queue keys (en/zh); hover cards verified showing
  伸展放松 / 看手机 / 喝咖啡 / 队列 in zh-CN; window title 偃师工坊; no "Yanshi" in zh normal mode.
- **Reduced motion:** `prefers-reduced-motion` → static poses + `frameloop="demand"` (state stays
  readable via posture/eyes/ring). GPU setting keeps gating DPR/shadows.
- **Asset architecture:** `WorkerCharacterAsset` registry implemented (all entries honestly
  `assetType: "procedural"`, every state `{source:"procedural", path:null}`);
  `packages/live-office/assets/workers/README.md` documents the future per-role asset layout.
- **Fallbacks intact:** WebGL-failure path shows the 2D simplified view with chibi CSS chips and
  localized state text; ErrorBoundary + retry unchanged.

## 3. Real runtime-driven vs decorative

- Runtime-driven: status ring color, working/blocked/waiting/done poses, current task text,
  queue count, fatigue bar — all from live agent state out of the event stream.
- Decorative (and labeled as such in spec + code comments): life actions (coffee/stretch/nap/
  walk/phone/chat), wobble/breathing, blush. Nothing animates progress that is not real.

## 4. What remains future work (documented in spec §"Implementation status" + FINAL_PRODUCT_GAPS)

- Modelled/rigged GLB or SVG/Lottie character assets (registry slots empty by design).
- Walk cycles + pathfinding; richer life-state set (pretending-to-type, desk-slump, looking-
  around); per-role working pantomimes (stamping, filing).
- Workshop appearance/motion packs; pop-out & always-on-top office windows.

## 5. Files changed

- `docs/YANSHI_ATELIER_WORKER_DESIGN.md` (new)
- `packages/live-office/assets/workers/README.md` (new)
- `packages/live-office/src/characters.ts` (ROLE_DESIGNS, WorkerCharacterAsset registry)
- `packages/live-office/src/index.tsx` (per-role figures incl. monocle/headset/beanie, pose
  variants, reduced-motion, labels prop, debug-label gating)
- `apps/desktop/src/features/live-office.tsx` (localized labels, developer flag, localized
  simplified view)
- `apps/desktop/src/i18n/en.ts` / `zh.ts` (13 keys)
- Docs: FINAL_PRODUCT_GAPS, UI_INTERACTION_MODEL, CURRENT_STATUS, NEXT_STEPS,
  ACCEPTANCE_CHECKLIST, IMPLEMENTATION_LOG

## 6. Commands run

`pnpm lint` PASS · `pnpm typecheck` PASS (within lint) · `pnpm test` 34/34 · `pnpm build` PASS ·
`uv run --project runtime/python pytest` 79/79 · `cargo check` PASS · `cargo test` 11/11 ·
`pnpm desktop:release` PASS · packaged launch healthy (5s) + clean quit.

## 7. Manual smoke results

| Check | Result |
|---|---|
| Atelier opens, no blank screen, canvas live | PASS |
| Six roles visually distinguishable | PASS (wd-01) |
| Close → reopen ×3 (this pass) on top of ×6 + context switches (previous pass) | PASS |
| Standalone reset / project inherit (state logic untouched; re-verified prior pass) | PASS |
| Hover cards on all 6 workers, localized zh text | PASS |
| Normal mode: zero floating labels / bottom chips | PASS |
| Developer Mode: 6 debug labels + meta chips | PASS (wd-02) |
| Reduced motion | Code-implemented (static poses + demand frameloop); OS-level preference not togglable from the test harness — needs a human toggle to eyeball |
| zh-CN naming 偃师 / 偃师工坊 | PASS |
| Light + dark theme | PASS (wd-01 light, wd-02 dark) |

## 8. Known remaining issues

- Reduced-motion visual confirmation needs a human (System Settings toggle).
- Dark-theme scene is intentionally dim; if it reads too dark on real hardware, raise the dark
  floor tone (`#1a1e20`) a step.
- Packaged titlebar baseline glance still pending from the previous pass.
