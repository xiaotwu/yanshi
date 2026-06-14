# Yanshi Atelier Worker Character Design System（偃师工坊小工人设计系统）

_Created 2026-06-11 (Worker Character Design System pass). Owner doc for everything about the
little workers in the Atelier. English UI says "Yanshi"; Chinese normal-mode UI says 偃师 / 偃师工坊._

---

## 2.1 Product role — what workers are

Workers are the **visual representation of Yanshi's real agents** (Manager, Reviewer, Browser,
Computer, File, Terminal). They are not fake bots and never simulate work:

- When a runtime task is active, a worker's pose/state **mirrors real runtime state** (run
  status, agent task status, approvals, errors) delivered through the event stream.
- When no real task is active, workers show **idle/life animation only** (coffee, stretch, nap…)
  — explicitly decorative, derived from idle time + fatigue + behavior mode, never implying
  progress.
- Workers are **project-scoped and chat-scoped office inhabitants**: a project's Atelier shows
  that project's team and office layout; a standalone chat shows the global office. Opening a
  chat switches the Atelier context to that chat's project (or global).

## 2.2 Visual principles

| Principle | Meaning in practice |
|---|---|
| Chibi / compact | Head dominates the silhouette (head ≈ body height); squat round body; stubby limbs |
| Desk-worker feeling | Every role has a mini desk with screen + mug + role prop; working pose leans into the desk |
| Mechanical-puppet / craftsman motif | 偃师 = the legendary puppet-maker: subtle joints, antenna, seal-like accent ring — crafted, not organic |
| Soft but sharp silhouette | Soft rounded forms; one crisp identifying element per role (headwear/prop) readable at 60px |
| Expressive posture | State is told by posture + eyes before color: hunch when focused, slump when blocked, tilt-up when waiting |
| Minimal face | Two eyes only (round = awake, line = sleepy); blush dots; no mouth, no emoji face |
| Readable at small size | One state = one silhouette change + ring color; never depends on text |
| Calm B/W UI compatibility | Muted suit colors (≤ 55% saturation); works on ivory and dark themes |
| Mint-green accent | The product accent (#2fc279 family) is reserved for "actively working" glow/ring |
| Not noisy | ≤ 1 ambient motion per worker at a time; no particles in normal mode |
| Not generic emoji | Custom proportions + headwear + props; no literal emoji glyphs in the scene |

## 2.3 Character anatomy

| Part | Definition |
|---|---|
| Head | Large soft sphere, ivory (#f4efe6); per-role headwear attaches to it |
| Body | Squat capsule-ish sphere in the role suit color; lighter belly patch |
| Hair/hat/accessory | Per-role headwear: antenna / visor band / cap / headset / beanie / monocle |
| Face/eyes | Two dark dots; sleepy = scaled to lines; working = subtle accent glow; blush dots always |
| Hands | Stubby side spheres; shift toward the desk while working |
| Desk props | Per-station desk: top, legs, tilted screen, mug |
| Role item | One signature prop on the desk (board/stamp/globe/monitor/folder/console) |
| Glow/status ring | Ground ring under the worker; color + opacity = status (mint working, amber waiting, red blocked/failed, gray idle) |
| Shadow | Standard soft shadow (disabled in lowPower) |
| Puppet/seal detail | The scarf torus in the agent's accent doubles as the "maker's seal" — each agent's individual mark |

## 2.4 Role archetypes (six)

Posture families: **upright** (leaders), **lean** (explorers), **hunch** (builders).

| Role | Purpose | Silhouette cue | Main prop | Suit / accent | Posture |
|---|---|---|---|---|---|
| Manager | plans & coordinates | antenna with status bulb | planning board (clipboard) | warm amber #e9b85c | upright |
| Reviewer | checks & approves | monocle ring over one eye | stamp + checklist | bronze #c08a52 | upright |
| Browser | explores the web | forehead visor band | tiny globe | sky blue #6fa8dc | lean |
| Computer | drives the desktop | over-ear headset | mini monitor | periwinkle #8d86c9 | lean |
| File | organizes documents | work cap with brim | folder stack | sage green #8fbf9f | hunch |
| Terminal | runs commands | knit beanie | small console block | deep teal #5f8f82 | hunch |

Poses (all roles, varied by posture family):

- **Idle:** resting at desk, slow breathing bob, sleepy line-eyes, dim ring.
- **Working:** leaned into desk, typing bob + small wobble, awake eyes with mint glow, mint ring.
- **Blocked / Failed:** slumped (extra forward tilt), eyes dim, red ring; no motion except a slow sag.
- **Waiting approval:** head tilted up (asking), amber ring, still.
- **Success / Celebrating:** brief higher bounce, awake eyes, soft mint ring.
- **Fatigue:** sleepy eyes + lower lift; drives life actions (coffee/nap) when idle.
- **Hover card:** name, real role, current status, current task (if any), queue count, fatigue bar
  — always available on hover; this is the only place state text appears in normal mode.

## 2.5 Animation states

Task states (driven by **real runtime events only**): `idle, thinking, working, reading, typing,
browsing, file organizing, terminal running, reviewing, waiting approval, blocked, failed,
completed, celebrating`.

Life/idle states (decorative; idle + fatigue + behavior mode): `coffee break, stretching, sleepy,
nap, playing phone, pretending to type, desk slump, looking around` (current build implements
coffee/stretch/nap/walk/phone/chat; the rest are documented targets).

Rules:

- Task states come from real runtime events; a worker may not enter a task state without one.
- Life states appear **only when no task state is active**.
- Decorative animation must never read as progress (no progress bars, no fake counters).

## 2.6 State-to-runtime mapping

| Runtime signal | Worker state |
|---|---|
| `run.started` / agent task `running` | working (typing/browsing/… per station) |
| tool action / observation events | station-specific working pose |
| `approval.requested` | waiting-approval (amber) |
| agent task `blocked` / run `failed` | blocked / failed (red, slump) |
| run `completed` | celebrating → settling → idle |
| file output / artifact event | (Files panel + Library; no worker pantomime) |
| project context | project office layout + that project's team |
| standalone chat | global office state |
| no real data | idle/life animation only — never fake progress |

Precedence: task state > approval > blocked/failed > celebrating > life > idle.

## 2.7 Asset architecture

Future asset home (registry-first; directories created when real assets land):

```txt
packages/live-office/assets/workers/
  manager/  reviewer/  browser/  computer/  file/  terminal/
```

Supported asset types (renderer picks the richest available, falls back procedurally):
`procedural` (today) · `svg` · `sprite` (PNG sheet) · `lottie` · `gltf`.

Registry (implemented in `packages/live-office/src/characters.ts`):

```ts
WorkerCharacterAsset {
  id: string
  role: AtelierRole
  displayName: string
  assetType: "procedural" | "svg" | "sprite" | "lottie" | "gltf"
  states: Record<WorkerState, WorkerStateAsset>   // { source, path|null }
  props: string[]
  accentColor: string
  supportsReducedMotion: boolean
}
```

**Today every entry is `assetType: "procedural"` with `path: null` for all states** — the
procedural chibi renderer is the real implementation, and nothing claims a richer asset exists.

## 2.8 Fallback rules

- Rich asset missing → procedural chibi fallback (always available, no network).
- Role prop always shown (desk prop), glow/status ring always shown.
- State text lives in the hover card (tooltip) only — no bottom chips in normal mode; Developer
  Mode may show floating debug labels.
- WebGL unavailable/failed → 2D simplified view (CSS chibi face chips + real worker list) with
  retry; the app never blanks.
- Reduced motion → static poses; state stays readable via eyes + ring color.

## 2.9 Workshop integration (future, not faked)

Workshop packs may eventually replace: character appearance (per-role asset overrides via the
registry), role props, idle-animation sets, motion packs, office themes. The pack format already
carries office layout + agent profiles; **asset replacement is future work — there is no
marketplace and the UI claims none.**

---

## v2 — Yanshi Puppets（偃师傀）visual identity (2026-06-11 redesign)

The workers' visual identity moved from procedural three.js primitives to **authored 2D chibi
art**: the *Yanshi Puppets*. Endfield-adjacent in mood (clean stylized anime forms, controlled
palette, small iconic accents) but original to Yanshi.

**Master design** (`packages/live-office/src/worker-art.ts`): head ≈ 62% of total height; pale
warm face (#f2e8dc); big messy layered charcoal bangs with slate-blue glints; default
closed-arc content eyes + blush; tiny smock body with a role-accent scarf, one thin warm-red
strap, mitt hands, little shoes. Signature crafted-being cues: **mechanical puppet-ear fins**
(charcoal shell, accent inner panel, single red indicator) and the **red mechanism-seal pin** in
the hair. Palette is restrained: charcoal/slate dominants; muted per-role accents; warm red only
as punch.

**Six role variants, one family** — same base, varied fin silhouette + headwear detail + scarf
accent + floating prop:

| Role | Fin/headwear | Prop | Accent |
|---|---|---|---|
| Manager | tall antenna fin | planning board | amber #d9a04c |
| Reviewer | low fins + monocle | stamp | red-orange #c96a4a |
| Browser | twin fins | compass | muted cyan #6fb3c7 |
| Computer | twin fins + headset | cursor chip | slate blue #7a86c2 |
| File | low fins + hairpin | folder | sage #8fae9b |
| Terminal | swept fins + hood | console | deep teal #4f8d83 |

**Expression language** (selected from real runtime state only — `puppetExpression`):
content (idle) · focused (working/waiting) · sleepy + z (nap) · panic + sweat drop
(blocked/failed) · proud (done) · slack (phone/chatting). Life states remain decorative.

**Rendering:** the SVGs are generated, cached, and (a) rasterized into billboard **standee
sprites** inside the 3D office (alpha-tested for true depth vs. desks, `toneMapped: false` to
preserve the authored palette, screen-plane sway/bob for motion, reduced-motion → static),
and (b) used directly as `<img>` chips in the 2D simplified/fallback view — one identity in
every surface. Naming is organized for future animation (role × state keys in
`puppetDataUrl(role, expr)`; registry `assetType: "svg"`).

**Future asset work:** sprite-sheet/Lottie animation per state, modelled/rigged 3D characters,
walk cycles + pathfinding, richer life-state set (pretending-to-type, desk-slump,
looking-around), Workshop appearance/motion packs, pop-out & always-on-top office windows.

## Station & movement rules (2026-06-12)

Formalized in `packages/live-office/src/stations.ts` (pure, unit-tested):

- **One home station per worker** (manager/browser/computer/file/reviewer/terminal); a home may
  only be occupied by its owner. Project offices override positions; standalone uses defaults.
- **Task states pin home**: working / waiting approval / blocked / failed / done never move.
- **Movement is behavior-gated** (`WorkerMovementReason`): break_room (coffee), rest (nap),
  shared_table (chat), wander (orbit of the worker's own desk); everything else = stay/return
  home. Decorative only — never fake progress.
- **Occupancy guard**: shared areas hand out deterministic per-worker slots (no overlap);
  any target within the clearance radius of a foreign home station is rejected → worker stays
  home. Reduced motion snaps instead of animating.

## Implementation status

**Implemented now:** the Yanshi Puppets v2 identity above (six roles × six expressions, 36
generated SVG combinations), desk scenes, status ring + contact shadow, localized hover cards,
Developer-mode debug labels, reduced-motion static mode, lowPower render tier, 2D fallback using
the same art, honest `WorkerCharacterAsset` registry (`assetType: "svg"`, generated/embedded —
no external or richer assets claimed).
