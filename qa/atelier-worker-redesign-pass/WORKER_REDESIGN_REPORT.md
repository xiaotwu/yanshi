# Yanshi Puppets — Worker Visual Redesign Report (2026-06-11)

## 1. Verdict

**PASS.** New worker identity designed, implemented, and verified in-app (dev + packaged).

## 2. Design direction (final)

**Yanshi Puppets（偃师傀）** — original chibi workers, Endfield-adjacent in mood (clean stylized
anime forms, restrained palette, small iconic accents), not a copy of any existing character:

- Head ≈ 62% of height; tiny smock body; mitt hands; readable at 24px.
- Pale warm face, messy layered charcoal bangs with slate glints, closed-arc content eyes,
  blush; soft but slightly cool temperament.
- Crafted-being identity cues: **mechanical puppet-ear fins** (charcoal shell, accent panel,
  one warm-red indicator) + **red mechanism-seal pin**; cute first, lore second.
- Palette: charcoal/blue-gray dominants, muted per-role accents, warm red strictly as punch.

## 3. Character system

One master + six unified role variants (fin silhouette + headwear + scarf accent + floating
prop): Manager (antenna · planning board · amber), Reviewer (monocle · stamp · red-orange),
Browser (twin fins · compass · muted cyan), Computer (headset · cursor chip · slate blue),
File (hairpin · folder · sage), Terminal (hood · console · deep teal).

Expression/pose language (six states, mapped from **real runtime state only** via
`puppetExpression`): content (idle) · focused (working / waiting approval) · sleepy + z (nap) ·
panic + sweat drop (blocked/failed) · proud (run completed) · slack (phone/chat life states).
Life states are decorative and never imply progress.

All 36 role×expression combinations proofed: `SCREENSHOTS/puppet-proof-v2a.png` / `-v2b.png`
(iteration history: `-v1*.png`, `puppet-zoom-*.png`).

## 4. Implementation

- `packages/live-office/src/worker-art.ts` (new): palette tokens, role art table, layered SVG
  part builders (fins/back-hair/face/bangs/headwear/expressions/body/props), `puppetSvg`,
  cached `puppetDataUrl`, `puppetExpression`. Pure generated SVG — transparent background,
  light/dark safe, organized role×state keys ready for future sprite/animation expansion.
- Atelier scene (`index.tsx`): procedural figures replaced by **billboard standee sprites** —
  textures rasterized locally from the SVGs (no network), cached per role×expression,
  `alphaTest` for true depth against desks, `toneMapped: false` for palette fidelity,
  screen-plane sway + bob for life, contact shadow, status ring kept; hover raycast, localized
  hover cards, queue bubbles, Developer debug labels all preserved; reduced-motion → static.
- 2D simplified/fallback view uses the **same generated art** as `<img>` chips — one identity
  in every surface.
- Honesty: `workerCharacterRegistry` now `assetType: "svg"` (generated/embedded, `path: null`);
  no animation frames or 3D modelling claimed anywhere.

## 5. Verification

| Check | Result |
|---|---|
| pnpm lint / typecheck / test (34) / build | PASS |
| pytest 79 / cargo check / cargo test 11 | PASS |
| pnpm desktop:release | PASS |
| Packaged launch (healthy 4s) + clean quit | PASS |
| In-scene light theme (six puppets at desks, expressions visible) | PASS (`puppet-scene-light.png`) |
| In-scene dark theme (art unaffected by dim lighting) | PASS (`puppet-scene-dark.png`) |
| Hover raycast on sprites + zh-CN hover cards (看手机/队列…) | PASS |
| Role distinguishability at scene size | PASS |
| Reduced-motion static mode | code path verified; OS-toggle eyeball still on the human list |

## 6. Future work (not claimed)

Sprite-sheet/Lottie animation per state, walk cycles + pathfinding, richer life states
(pretending-to-type, desk-slump, looking-around), per-role working pantomimes, Workshop
appearance/motion packs.
