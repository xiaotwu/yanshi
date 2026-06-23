# Workshop Character Redesign — Direction 2 (premium-chibi-first, fresh start)

**For:** Codex, in `/Users/xiaotwu/Code/yanshi` on `main`. **Do not push to origin.**
**Trailer:** `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`
**Process:** re-brainstorm → update the spec → render concept previews → STOP for the owner to pick →
then implement TDD. This supersedes the **art direction** of the prior spec/rig.

## Why redo the character design
The first pass (Concept A "Seal-Fin Automaton Artificers", base rig `eac24e16`) carried over the **old
`worker-art.ts` puppet DNA** — it reads as a dark, flat little automaton, not the premium, expressive,
charming chibi the brief set as the target. The owner has rejected that direction. **Discard the
character/art direction and start the silhouette and look fresh.** Do NOT iterate the seal-fin automaton.

## What to KEEP (engineering — reuse, do not rebuild)
- The layered inline-SVG rig structure, the **7-expression system**, size variants, accessible
  name/status, reduced-motion hooks, and `--ym-*` token theming.
- The **honest `deriveMascotState` contract** (real runtime/store signals only; Manager `thinking` across
  every ReAct decide phase; never happy on failure).
These are good and stay. **Only the art direction / character design is being redone** — reskin the rig.

## New north star
An **original, premium, genuinely charming** chibi mascot family that hits the *quality and appeal* of
top-tier gacha-game chibi emotes — bright, expressive, lovable — while being **unmistakably Yanshi's
own**. Optimize for **charm and appeal first**; express the 古法机关坊 / 偃师 lore lightly through
accessories and palette, not by making the character a dark machine.

### Appeal targets (the quality bar to actually hit, judged on the render — not prose)
1. **Expressive face** — larger, lively eyes with light; warm cheeks/blush; readable emotion at small size.
2. **Premium cel-shading** — clean bold linework + soft gradient + a glossy hair/ornament highlight band
   + subtle rim light. Not flat fills.
3. **An attractive, distinctive silhouette** — a strong, *appealing* signature (via hairstyle / headwear /
   ornament), original to Yanshi. The previous "dark fins" merged into the body and failed; the new
   signature must be instantly readable AND charming.
4. **Palette with real value contrast + warm/cool harmony** — no dark monochrome blob; hair, body, and
   accents must separate in value. Still fully token-driven (`--ym-*` bound to theme tokens, no hex).
5. **Personality** — these should feel like characters (artisan-apprentices of the workshop) with warmth,
   not faceless puppets.

## Originality guardrails (hard — non-negotiable)
The Arknights / 陈千语 image is a **quality/genre reference only**, never a template. Do NOT trace, copy,
or "copy-with-small-substitutions." Specifically forbidden (these are that character's identity):
- dragon/animal horns or any horn-like signature;
- the long black-hair waterfall, that bang shape, or twin-tail identity;
- the crimson + teal horn palette as a character identity;
- the tactical/military outfit;
- the floating メ / cross marks;
- the name, likeness, outfit layout, or lore of 陈千语 or any Arknights character.
**Litmus test:** if a thumbnail could be mistaken for an existing game's character, it fails — redesign it.
Yanshi identity comes through **its own** motifs (jade, brass, cinnabar, talisman paper, brush/seal,
clockwork ornaments, lacquer) as *accessories on an appealing character*, not by copying anyone.

## Process — render, don't describe (the lesson from Direction 1)
Words read better than they render. So this round:
1. Re-brainstorm **3 fresh, distinct** original chibi concepts that each hit the appeal targets above
   (different silhouettes/headwear/ornament — not variations on the automaton).
2. **Render an actual preview PNG of each concept** (neutral + happy at minimum; rough is fine) so the
   owner picks on pixels, not prose. Put them where the owner can view them and reference the paths.
3. **STOP for the owner to choose one concept** before building the full rig/expressions/skins.
4. After a concept is chosen: reskin the existing rig to it (keep the 7-expression system + honesty
   contract), re-export the full 7-expression preview, and **STOP again for a visual check** before role
   skins (per the existing increment plan).

## Constraints (unchanged)
Token-driven (no hard-coded hex; component test asserts it), reduced-motion fallback, a11y names/status,
zh-first + en i18n, all gates green (`pnpm --filter @yanshi/desktop test/typecheck/build` + runtime
pytest). Commit task-sized to `main` with the trailer; **no push**. Keep the prior rig until a new
concept is signed off (then replace, don't leave two character systems).

## Done (this round)
3 rendered original concepts presented → owner picks → reskinned premium rig re-previewed → owner
visual-signs-off → then the state selector + six role skins per the existing plan. No Arknights asset or
likeness, ever.
