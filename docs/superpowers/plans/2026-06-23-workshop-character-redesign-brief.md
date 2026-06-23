# Design Brief — Redesign 偃师工坊 + its 偃师 characters & animation (chibi mascot system)

**For:** Codex, in `/Users/xiaotwu/Code/yanshi` on `main`. **Do not push to origin.**
**Trailer on every commit:** `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`
**Process (required):** This is a large design+frontend change. Run the superpowers flow:
**brainstorming → write a spec under `docs/superpowers/specs/` → write a plan → implement TDD in
task-sized commits.** Do NOT free-code the whole thing. Get the spec's key decisions (below) right first.

You are acting as an experienced product/character designer with strong visual taste. The goal is to
turn the Workshop from functional placeholder art into a **delightful, expressive chibi-mascot
workspace** where each 偃师 (the project's AI worker-agents) is a charming animated character whose
motion **honestly reflects its real runtime state**.

---

## 0. ⚠️ IP / originality boundary (read first — non-negotiable)
The reference image (Arknights: Endfield's "陈千语") is **copyrighted by Hypergryph**. Use it **only as a
style/vibe reference**. You MUST design **original characters** for Yanshi — do **not** reproduce 陈千语,
do not trace/copy her art, and do not ship any Arknights asset, name, or likeness. Extract the *design
language* (chibi proportions, clean cel-shaded look, signature silhouette, expressive emote faces,
tactical-fantasy-meets-cute styling, floating accent marks) and apply it to Yanshi's **own** lore:
偃师 = ancient automaton-artificers of a 古法机关坊 (mechanism workshop). The result should read as
"Yanshi's mascots," not "an Arknights character." If in doubt, make it more original, not less.

---

## 1. The reference style, described (Codex cannot see the image — build from this)
A premium gacha-game **emote/Live2D-style chibi**:
- **Proportions:** super-deformed, ~2 heads tall — big round head, tiny body, stubby limbs. Reads
  clearly at small sizes (think sticker/emote scale).
- **Linework & shading:** clean bold anime outlines in dark brown-black (not pure black); cel-shaded
  with 1–2 soft shadow tones + a gentle gradient and a few crisp highlights; a glossy highlight band in
  the hair. Polished, not flat.
- **Hair:** voluminous layered black hair with a cool brown sheen, long flowing locks cascading well
  below the body, wispy tapered tips, parted fringe over the eyes.
- **Signature silhouette = horns:** a pair of swept-back dragon horns, dark base with crimson inner
  ridges and teal/cyan accents near the root. The horns make the silhouette instantly recognizable.
- **Face/expression:** big soft cheeks, happy closed "∧‿∧" curved eyes (joyful squint) + an alt with
  large glossy iris eyes; soft pink blush ovals; a tiny under-eye mark; wide cheerful open-mouth laugh.
  Mood = energetic, determined, "加油/let's-go." Hands often raised in cute fists.
- **Outfit:** modern tactical-fantasy — high-collar layered jacket in muted teal/sage with a grey-white
  inner layer, harness straps, zippers, buckles; navy articulated combat gloves. Functional but stylized.
- **Accent decorations:** floating light-cyan stylized cross / "✕ / メ" sparkle marks and motion ticks
  around the character — sticker-style energy accents.
- **Palette:** ink-black hair · crimson + teal horns · sage-teal + slate outfit · navy gloves · warm
  fair skin · cyan accents. Cool base + warm accent harmony.

**Design language to extract (apply, don't copy):** ① chibi 2-head proportions; ② bold clean
cel-shading with soft gradients; ③ a strong *signature silhouette element* per character; ④ emote-driven
expressive faces with a small set of swappable expressions; ⑤ tactical-fantasy-meets-cute outfit detail;
⑥ floating accent marks for energy/state; ⑦ cohesive cool+warm palette that can be **re-tinted by theme
tokens**.

---

## 2. Reconcile the style with Yanshi's identity (a spec decision)
Yanshi's established aesthetic is 古法机关坊 (ancient mechanism workshop), theme-token-driven, modern
icon-first/progressive-disclosure UI, zh-first + en i18n, reduced-motion support. The chibi style is
modern tactical-fantasy. **Fuse them into something original:** Yanshi's 偃师 are little
**automaton-artificer** mascots — keep the chibi proportions, clean cel-shading, expressive faces, and
floating accent marks, but swap 陈千语's dragon-horn/tactical identity for Yanshi-original signatures:
mechanical jointed limbs, brass/jade/lacquer accents, 咒文 (talisman/seal) motifs, a maker's tool prop,
puppet-string or clockwork hints. Decide the exact fusion in the spec and show 2–3 silhouette concepts.

---

## 3. Current implementation (verified anchors to replace/extend)
- `apps/desktop/src/features/workshop/` — `WorkshopWorkspace.tsx`, `AtelierPreview.tsx` (an **editable SVG
  overlay** that currently draws each worker as a plain **`<circle>` station marker**, plus area/
  furniture markers), `WorkerRail.tsx` (the worker list rail), `WorkerInspector.tsx` (per-偃师
  identity/性情/心智/本事/咒文 editor), `ForgeWorkerFlow.tsx` (create-a-偃师 flow). Each has a `.test.tsx`.
- `apps/desktop/src/lib/atelier.ts` — world↔SVG coordinate math (`OFFICE_SVG` 700×500, `worldToSvg`,
  `svgPointToWorld`), `STATION_DEFAULTS`, `OFFICE_AREAS`, `STATION_COLORS`, `FURNITURE_COLORS`. Plus
  `atelier.test.ts`.
- There is also an `AtelierStage` (a 3D live scene) rendered behind the SVG overlay — decide whether the
  characters live in the **SVG/DOM layer** (recommended for theming + a11y), the 3D stage, or a new
  dedicated character layer. Don't break the existing coordinate/edit interactions.
- Theme tokens: `--ws-*` CSS variables (e.g. `--ws-brass`) in `apps/desktop/src/styles.css`; reduced-
  motion handling lives there too. i18n: `apps/desktop/src/i18n/{en,zh}.ts`.
- The 偃师 archetypes/roles map to the tool agents (file / browser / computer / terminal, plus
  manager/reviewer) — confirm the current archetype set in the code and design **one chibi per role**,
  differentiated by signature element + palette, all in the same style family.

---

## 4. Scope — three deliverables
### 4a. The character system (the 偃师 mascots)
- A reusable, **layered SVG** chibi component (parts: hair-back, body, head, face/expression, hair-front,
  horns/signature, props, accent marks) so individual layers can animate and be **re-tinted via CSS
  custom properties bound to theme tokens** (no hard-coded colors — every fill reads a `--ws-*`/character
  token so the mascots follow the active theme).
- A **base mascot** + **per-archetype variants** (distinct signature element, palette, prop) sharing one
  rig so animations are written once. Provide a small **expression set** (neutral, happy/laugh,
  thinking, focused/working, surprised, sad/error, sleeping).
- Readable at multiple sizes: rail avatar (small), stage character (medium), inspector/hero (large).

### 4b. Animation (must be HONEST — state-driven, never fake)
Map each animation to a **real agent/run state**, not decorative randomness. At minimum:
`idle` (gentle breathing + occasional blink + idle hair sway + drifting accent marks) ·
`thinking`/`deciding` (the loop's decide step — pensive pose, thought mark) ·
`working` (executing a tool/act step — role-appropriate gesture; e.g. file=scribbling, terminal=tapping)·
`talking`/`streaming` (mouth/affect while the answer streams) ·
`success`/`completed` (cheerful celebration + sparkle burst) ·
`error`/`failed`/`blocked` (honest dejected/alert pose — NOT a happy state) ·
`awaiting-approval` (paused, looking up expectantly) ·
`sleeping`/`offline` (no provider / idle team).
Wire these to the **actual** run/agent status the runtime already emits (run.started, plan/decide,
agent.task.started/completed, run.completed/failed, pending_approval, cancelled, model_not_configured) —
do not invent activity the agent isn't doing. A failed run must visibly read as failed.

**Reduced-motion:** honor `prefers-reduced-motion` — fall back to a static expression swap (no looping
motion, no drifting marks), keeping state legible. **Performance:** prefer CSS/Web-Animations transforms
and `transform`/`opacity` only; pause off-screen/when the window is hidden; cap concurrent animators.

### 4c. The workshop layout redesign
- Rework the workshop so the mascots are the emotional center while keeping it a real, usable workspace:
  a clear **team view** (the project's 偃师 with live status), modern icon-first/progressive-disclosure
  controls (inspector opens on demand), and the existing create/edit/position flows preserved.
- Keep it **theme-token-driven** (古法机关坊 feel), responsive across window sizes, keyboard/screen-reader
  accessible (each mascot has an accessible name + status text), and zh-first/en i18n complete.

---

## 5. Key decisions to settle in the spec (with a recommendation)
1. **Rendering tech:** **layered inline SVG + CSS/Web-Animations** (recommended — themeable via tokens,
   crisp at any size, a11y-friendly, light) vs Lottie/Rive (richer motion, harder to re-tint by theme
   token, heavier). Recommend SVG; justify if you deviate.
2. **Character layer:** SVG/DOM overlay (recommended) vs the 3D `AtelierStage`. Don't regress edit/drag.
3. **One rig, many skins:** confirm the shared-rig + per-archetype-skin approach so animations are authored
   once and theme tokens re-tint per character/theme.
4. **State→animation contract:** define the explicit mapping from real run/agent status to animation, and
   where it's derived (a single hook/selector), so it stays honest and testable.
5. **Asset pipeline:** are the SVGs hand-authored components, or authored in a tool and imported? Keep them
   as code-controlled, tokenized components if possible.

---

## 6. Quality bar & constraints (Yanshi house rules)
- **Honest by construction:** animations/expressions reflect real state; no fake "working" shimmer when
  idle, no happy celebration on failure. State comes from the runtime's actual status.
- **Theme-token-driven:** zero hard-coded brand colors in the mascots; everything re-tints via `--ws-*`/
  character tokens and follows the active theme.
- **i18n:** all new copy in both `en.ts` and `zh.ts` (zh-first); no hard-coded strings.
- **Accessibility:** reduced-motion fallback; accessible names + live status for each mascot; sufficient
  contrast; keyboard reachable.
- **Performance:** transform/opacity animations; off-screen/hidden-window pausing; no layout thrash.
- **TDD:** component/logic tests (the state→animation mapping, reduced-motion fallback, token theming,
  i18n presence) RED→GREEN. Keep the existing workshop tests green and the full gates green:
  `pnpm --filter @yanshi/desktop test/typecheck/build` and the runtime suite.
- Commit task-sized to `main` with the trailer; **no push**. Update the workshop docs/scrections if any.

## 7. Suggested increments (each its own commit)
1. Spec + 2–3 silhouette/style concepts for the original 偃师 mascot (chibi, tokenized) — get sign-off in
   the spec before mass-producing variants.
2. The base layered-SVG chibi rig + expression set + token theming (with tests).
3. The honest state→animation hook + the core animations + reduced-motion fallback (with tests).
4. Per-archetype skins for every role.
5. Workshop layout redesign hosting the mascots (team view, inspector, preserved edit flows, i18n, a11y).
6. Polish pass: accent marks, transitions between states, performance pass; update docs.

## 8. Done
Original, on-brand, theme-tokenized chibi 偃师 mascots with honest state-driven animation; redesigned
workshop hosting them; reduced-motion + a11y + zh/en complete; all gates green; spec/plan committed under
`docs/superpowers/`. No Arknights/陈千语 asset or likeness shipped. Commits on `main` with the trailer; no push.
