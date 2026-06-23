# Workshop Character Redesign Brainstorm — original 偃师 mascot system

- Date: 2026-06-23
- Source brief: `docs/superpowers/plans/2026-06-23-workshop-character-redesign-brief.md`
- Status: increment 1 concept pass; no mass-produced role art until the spec is signed off.

## Non-negotiable IP filter

The Arknights / 陈千语 image is a style reference only. It is not an asset source and not a character
target.

Allowed to extract:
- Chibi / emote readability at small sizes.
- Clean bold cel-shaded layering.
- Strong silhouette language.
- A compact expression set.
- State accent marks.
- Cute-meets-functional styling.

Not allowed to copy:
- Dragon horns or a horn-like silhouette.
- The long black hair waterfall, specific bang shape, or tactical teal outfit.
- The crimson/teal horn palette as a character identity.
- The exact floating cross / メ marks.
- The name, lore, outfit layout, or likeness of 陈千语.

Design rule: if a thumbnail could be mistaken for an Arknights character, it fails the Yanshi brief.

## Product lens

Yanshi's characters are not generic cute bots. They are tiny automaton-artificers from a 古法机关坊:
crafted helpers with a maker's seal, visible mechanism joints, talisman/tool details, and a calm
desktop-workspace temperament. They need enough premium chibi appeal to carry the Workshop, but their
motion must stay tied to real runtime/agent state.

The workshop already has:
- Real project-scoped workers, office layout, editable SVG overlay, and `AtelierStage`.
- `liveAgents` derived from runtime events, with statuses `idle`, `working`, `waiting_approval`,
  `blocked`, `failed`, and `done`.
- An older generated `worker-art.ts` puppet identity with hard-coded palette values.

The new mascot system should use the older puppet work as proof that the runtime integration exists,
not as final art direction. The next system should be token-driven from the start.

## Concept A — Seal-Fin Automaton Artificers (recommended)

Silhouette:
- Large rounded chibi head, compact smock body, tiny mitt hands.
- Hinged side fins shaped like folded brass/jade mechanism plates. These read as crafted ears, not
  horns: low, segmented, riveted, and attached at the temple.
- A small cinnabar-style mechanism seal on the hairline or collar, drawn as a token-colored badge.
- Short layered hair cap or soft hood shape, never a long flowing hair mass.

Style fusion:
- Ancient workshop: seal badge, rivets, lacquer edge, talisman sash, jade/brass mechanism plates.
- Modern cute: bright expressions, soft cheeks, compact sticker-like proportions.
- Functional details live on props, not tactical clothing.

Why it fits:
- Strong shared family signature.
- Distinct from the reference because the silhouette is mechanical folded fins, not animal horns.
- Easy to layer and animate in SVG.
- Works at rail-avatar scale because the side fins and seal remain visible.

Risks:
- Current older `worker-art.ts` also uses puppet fins. The redesign must refine the concept into a
  tokenized, layered DOM/SVG rig instead of copying the existing hard-coded generated palette.

## Concept B — Thread-Halo Puppet Apprentices

Silhouette:
- Rounded chibi body with a floating half-halo frame behind the head.
- Thin puppet-string arcs connect the halo to wrist/shoulder seals.
- Role props hang from the halo like workshop charms.

Style fusion:
- Directly communicates "puppet / automaton / artificer."
- The halo can become a state surface: approval = amber seal knot, failure = broken thread, success =
  spark ring.

Why it fits:
- Very original relative to the style reference.
- Strong animation affordance without copying hair/horns/outfit.

Risks:
- Halo/string detail may become noisy in the editable Workshop overlay.
- More likely to overlap controls or other workers at small sizes.
- Better as a secondary state/accent motif than the main shared silhouette.

## Concept C — Tool-Crest Chibi Artisans

Silhouette:
- Same base chibi, but each role owns a bold crest/hat shape: manager fan-board, browser compass kite,
  computer cursor visor, file folder clasp, reviewer seal stamp, terminal abacus-console hood.
- No shared "ear" signature; family unity comes from smock, seal badge, and expression language.

Style fusion:
- Most role-readable at small sizes.
- Props feel like workshop tools instead of sci-fi tactical gear.

Why it fits:
- Strong per-role differentiation for rail avatars.
- Easy to explain in zh/en accessible labels.

Risks:
- If pushed too far, the six characters stop feeling like one mascot family.
- More design work per role before the base rig is approved.

## Recommendation

Use Concept A as the signed-off base identity, borrow Concept C's role props/crests as skin details,
and keep Concept B's thread-halo only as a subtle state accent for approval/sleep/offline states.

This gives:
- One shared rig.
- One unmistakable Yanshi-original signature.
- Enough role variation without mass-producing disconnected characters.
- A clean IP boundary: no horns, no tactical outfit, no copied hair, no Arknights palette identity.

## Role-skin starting points

All role accents must be CSS custom properties derived from theme/workshop tokens unless the user has
explicitly chosen a profile accent.

| Role | Signature detail | Prop | State gesture seed |
|---|---|---|---|
| Manager | taller folded command fin + seal fan tab | planning talisman board | thinking = finger to seal board; success = seal flare |
| Browser | compass-kite fin notch | compass charm | working = scanning / compass tilt |
| Computer | cursor visor plate | cursor tablet | working = tapping glass panel |
| File | folder clasp hairpin | document stack | working = sorting scroll pages |
| Reviewer | seal-stamp crest | approval stamp | awaiting approval = raised stamp / expectant look |
| Terminal | abacus-console hood plate | command console charm | working = tapping abacus keys |

## Open sign-off questions

1. Approve Concept A as the shared Yanshi mascot silhouette?
2. Approve Concept C-style role props as the variant layer?
3. Keep Concept B as state accent only, not the base silhouette?
4. Confirm that increment 2 may replace the existing hard-coded `worker-art.ts` path only after the
   tokenized SVG rig tests are in place.
