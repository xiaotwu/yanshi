# 偃师工坊角色重设计 · Chibi Mascot System Spec

- Date: 2026-06-23
- Status: implemented through Workshop integration on 2026-06-23. Original key decisions were signed
  off by the user, with two amendments: Manager thinking covers every ReAct decide phase, and increment
  2 stopped for visual sign-off before role skins. Direction 2A superseded the prior art direction; the
  owner picked Concept A, and the selected rig reskin was visually signed off before Increment 3.
- Brief: `docs/superpowers/plans/2026-06-23-workshop-character-redesign-brief.md`
- Brainstorm: `docs/superpowers/notes/2026-06-23-workshop-character-redesign-brainstorm.md`
- Direction 2A brainstorm:
  `docs/superpowers/notes/2026-06-23-workshop-character-direction-2-dragon-girl-brainstorm.md`

## 1. Goal

Redesign the Workshop's 偃师 characters into original, theme-token-driven chibi mascots that make the
Workshop feel delightful and expressive while remaining honest about real runtime state.

The first implementation target is the Workshop: rail avatars, editable atelier characters, and the
inspector hero. The Live Office standee renderer can migrate to the same art system once the Workshop
layer is stable, but it must not duplicate visible workers in the Workshop.

## 2. IP / originality boundary

The Arknights / 陈千语 image is only a style reference. Yanshi must ship no Arknights asset, name,
likeness, silhouette, outfit, or copied palette identity.

Allowed style extraction:
- Chibi / emote proportions.
- Clean bold cel-shaded layering.
- Strong role silhouette.
- Expressive state faces.
- Floating state accents.

Yanshi-original replacements:
- The prior seal-fin replacement is discarded by Direction 2A. Dragon horns are permitted only as a new,
  original Yanshi dragon-girl premise; copied horn silhouette, palette, likeness, outfit, marks, name, or
  lore from the reference remains forbidden.
- Tactical fantasy outfit becomes artificer smock, talisman sash, seal badge, and small tool props.
- Floating cross marks become seal ticks, gear pips, talisman strokes, or approval stamps.
- Long hair waterfall becomes compact hair/hood shapes that keep the head readable without copying.

## 3. Key decisions needing sign-off

| Decision | Recommendation | Rationale |
|---|---|---|
| Rendering tech | **Layered inline SVG + CSS/Web Animations** | Tokenable through CSS variables, crisp at rail/stage/inspector sizes, accessible, no external asset pipeline. |
| Character layer | **Workshop SVG/DOM overlay** above the 3D room stage | Keeps drag/edit hit testing in `AtelierPreview`, avoids WebGL coupling, and lets every mascot expose accessible names/status. |
| Rig model | **One shared rig, many tokenized skins** | Expressions and animation states are authored once; role variants swap fins, props, crests, and token bindings. |
| State contract | **Single selector from real store/runtime state** | `liveAgents`, `events`, `runs`, `approvals`, `providerHealth`, and partial-answer state drive mascot state. No local timers may imply task progress. |
| Asset pipeline | **Hand-authored TSX/SVG components** | Code-reviewed, tokenized, testable. No copied/imported reference images; no Lottie/Rive until a future pack pipeline can retint and test them. |
| Base silhouette | **Concept A: Seal-Fin Automaton Artificers** | Original to Yanshi, reads at small size, compatible with ancient mechanism workshop lore. |
| Variant language | **Concept C role props as skin details** | Differentiates six roles without fragmenting the family identity. |
| Thread/halo motif | **Secondary state accent only** | Useful for approval/sleep/offline, but too visually noisy as the base silhouette. |

## 4. Current visual direction

Direction 2A supersedes the prior **Seal-Fin Automaton Artificers** art direction. The implemented rig
engineering remains valid. On 2026-06-23, the owner chose **Concept A: Paper-Lantern Dragon
Apprentice** from the rendered dragon-horn chibi previews.

Current owner revision:
- Keep the final supplied chibi image's Q-version abstraction: two-head proportions, thick line weight,
  blank-cute neutral face, happy face, and simplified standing pose.
- Design an original dragon-horn girl mascot for Yanshi.
- Avoid the reference character's identity: no copied horn silhouette, long-hair waterfall, tactical
  outfit, teal/crimson identity, floating marks, name, lore, or asset.
- Reskin the existing rig to Concept A, render all seven expressions, and stop for visual sign-off before
  building role skins or replacing Workshop surfaces.

Rendered preview directory:

`docs/superpowers/previews/2026-06-23-workshop-character-direction-2-dragon-girl/`

Selected rig preview:

`docs/superpowers/previews/2026-06-23-workshop-character-direction-2-dragon-girl/concept-a-selected-rig-seven-expressions.png`

## 4a. Superseded concept candidate

Recommended base: **Seal-Fin Automaton Artificers**.

This concept is no longer the active art direction. It is retained here as historical context for the
already-implemented rig increment, not as the future visual target.

Shape:
- About two heads tall.
- Large rounded head, compact smock body, tiny mitt hands, small boots.
- Folded mechanical side fins attached to the temples, built from plate/rivet/seal shapes. They must
  read as crafted mechanism fins, not animal horns.
- Compact hair cap or soft hood; no long copied hair mass.
- Maker's seal badge on collar/hairline and a talisman sash or small joint marks.
- Role prop floats or attaches near the body as a removable layer.

Expression set:
- `neutral`
- `happy`
- `thinking`
- `focused`
- `surprised`
- `error`
- `sleeping`

Layer order:
1. shadow / ground ring
2. back hair or hood
3. body / smock
4. head / face plate
5. expression
6. front hair / hood edge
7. seal-fins / crest
8. role prop
9. state accent marks

All fills/strokes must come from CSS custom properties such as `--ym-outline`, `--ym-face`,
`--ym-body`, `--ym-trim`, `--ym-accent`, `--ym-state`, and those variables must be bound to existing
theme/workshop tokens in CSS. The component must not hard-code brand colors.

## 5. Role skins

Current archetype set confirmed in code/docs: manager, browser, computer, file, reviewer, terminal.

| Role | Skin cue | Prop | Avoid |
|---|---|---|---|
| Manager | taller command fin, seal fan tab | planning talisman board | military commander hat |
| Browser | compass notch in fin | compass charm / little map slip | globe-as-generic-emoji only |
| Computer | cursor visor plate | cursor tablet | sci-fi headset dominating silhouette |
| File | folder clasp / paper hairpin | document stack | plain folder icon pasted on body |
| Reviewer | seal stamp crest | approval stamp/check slip | police/shield costume |
| Terminal | abacus-console hood plate | command charm | hacker hoodie stereotype as the whole identity |

## 6. Honest state to mascot contract

The mascot layer must expose a pure selector, e.g. `deriveMascotState(input): MascotPresentationState`,
covered by unit tests. It may read real runtime/UI state but must not synthesize work.

| Real signal | Mascot state | Visual rule |
|---|---|---|
| No active run for the worker | `idle` | Gentle neutral/static life state only; no working props. |
| Active run started, no assigned worker/action yet | `thinking` on Manager only | Pensive expression; other workers remain idle. |
| ReAct loop is in any decide phase between tool/act steps | `thinking` on Manager only | Manager reads as deciding/planning between real actions; do not show worker/tool activity until the next real assignment/action event. |
| `agent.task.started`, `action.created`, `action.started`, or `tool.call.started` for that worker | `working` | Role-specific focused gesture. |
| Partial answer text is present for active run | `talking` on Manager | Mouth/face shifts only while real partial text exists. |
| `approval.requested` or run status `pending_approval` | `awaitingApproval` | Expectant paused pose; reviewer may show raised stamp. |
| `agent.task.completed` or `action.completed` | transient `success` for that worker | Short completion pose, then idle/done once terminal event settles. |
| `run.completed` | `completed` / `success` | Celebration may play once; never if run failed/cancelled. |
| `agent.task.failed`, `action.failed`, `tool.call.failed`, or `run.failed` | `error` / `failed` | Dejected/alert pose; never happy. |
| `run.cancelled` | `blocked` / `stopped` | Neutral stopped pose, not success. |
| Provider health `not_configured` and no active run | `offline` / `sleeping` | Static sleeping/offline expression with clear status text. |

If the runtime does not emit a distinct state, the UI must choose the nearest honest lower-resolution
state instead of inventing a richer one. Example: do not show `browsing` unless the real event or worker
station tells us the Browser agent is executing a browser/tool step.

## 7. Workshop integration

Target files after sign-off:
- `apps/desktop/src/features/workshop/mascots/` for the base rig, role skins, state selector, and tests.
- `apps/desktop/src/features/workshop/AtelierPreview.tsx` to replace plain station circles with mascot
  markers while preserving existing drag/edit behavior.
- `apps/desktop/src/features/workshop/WorkerRail.tsx` to use small mascot avatars instead of lucide-only
  buttons when space allows.
- `apps/desktop/src/features/workshop/WorkerInspector.tsx` for the larger selected mascot view.
- `apps/desktop/src/i18n/{zh,en}.ts` for accessible names and state labels.
- `apps/desktop/src/styles.css` for token bindings, responsive layout, and reduced-motion rules.

The 3D `AtelierStage` behind Workshop should either render room/furniture only or be visually muted so
there is one visible mascot source in the Workshop. A later Live Office pass can reuse the same SVG art
as sprites/standees, but the Workshop implementation should not depend on WebGL.

Implemented result:
- `WorkerRail` uses the shared `MascotSkin` rig for small role avatars while preserving button
  selection semantics.
- `WorkerInspector` shows the selected worker as a larger shared-rig mascot with localized accessible
  status.
- `AtelierPreview` renders SVG/DOM station mascot markers at existing `worldToSvg` positions and keeps
  the existing station drag handlers and hit targets.
- Workshop passes real `runs`, `events`, `approvals`, `providerHealth`, active run id, reduced-motion,
  and document visibility into a mascot view-model before rendering.
- Workshop runs `AtelierStage` with workers hidden, so the 3D layer remains room/furniture backdrop and
  does not duplicate mascot characters.

## 8. Accessibility, i18n, and reduced motion

- Every mascot instance has an accessible name and localized status text.
- Live status text uses `aria-live="polite"` only where status changes are meaningful; decorative
  life changes should not spam screen readers.
- Keyboard users can select and drag/edit through the existing Workshop controls; mascot hit targets
  must not shrink the current station interaction area.
- `prefers-reduced-motion` and Yanshi's reduced/GPU settings collapse loops into static expression
  changes. State remains legible via face, pose, ring, and text.
- Workshop also collapses mascot loop motion while the document is hidden, keeping background/off-screen
  mascot state static.
- New copy must exist in zh-CN and en-US, with zh terminology using 偃师 / 偃师工坊.

## 9. Testing strategy

Required before implementation claims completion:
- Unit tests for `deriveMascotState`, including failed, cancelled, pending approval, no-provider, and
  partial-answer cases.
- Component tests proving the SVG rig renders no hard-coded hex colors in fills/strokes and exposes
  accessible names/status.
- Reduced-motion tests proving looping animation classes are absent or disabled.
- i18n parity remains green.
- Existing Workshop tests remain green.
- Requested gates: `pnpm --filter @yanshi/desktop test`, `typecheck`, `build`, plus runtime pytest.

## 10. Sign-off gates

The user signed off the following on 2026-06-23, before rejecting the seal-fin visual direction:
- Base silhouette: Concept A Seal-Fin Automaton Artificers.
- Variant strategy: Concept C props/crests on one shared rig.
- State accent strategy: Concept B thread/halo only as a subtle state accent.
- Rendering/asset strategy: inline SVG components in the Workshop DOM/SVG overlay.
- Honesty contract: derive state from real runtime/store signals only.
- Amendment: Manager also shows `thinking` during each ReAct decide phase between act/tool steps.

Direction 2A's second visual sign-off gate is resolved: Concept A is selected and the product rig has
been reskinned/rendered in all seven expressions. Increment 3 committed the honest state selector,
Increment 4 added the six role skins, and Increments 5/6 integrated the mascots into Workshop with
localized accessible labels, reduced-motion handling, and full verification.
