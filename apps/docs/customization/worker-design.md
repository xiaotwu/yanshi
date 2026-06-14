# Worker Design

The Atelier workers are the **Yanshi Puppets (偃师傀)** — an original chibi design system. This
page summarizes the public-facing design language.

![Yanshi Puppet roles and expressions](/screens/workers.png)

## Design language

- **Chibi proportions** — a large soft head dominates a compact body; readable at small sizes.
- **Mechanical-puppet motif** — fitting the name 偃师 (a maker of animated mechanisms): puppet-ear
  fins and a small mechanism-seal mark.
- **Restrained palette** — charcoal/slate with a per-role accent; warm red used sparingly.
- **Minimal, expressive faces** — closed content eyes by default, with focused/sleepy/panic/proud
  variants driven by real state.

## Six roles, one family

Manager (antenna), Reviewer (monocle), Browser (twin fins), Computer (headset), File (cap), and
Terminal (hood) — each a distinct silhouette and accent, clearly the same world.

## State, not theater

Expressions are selected from **real runtime state** only; decorative life states appear only when
a worker is idle. The system never animates fake progress.

## Implementation & status

- Workers are authored **2D SVG** art, rasterized to billboard standee sprites in the 3D office
  and reused as chips in the 2D fallback view. <Badge type="tip" text="Available now" />
- Animated sprite sheets / Lottie, modelled 3D characters, walk cycles + pathfinding, and richer
  life states are <Badge type="warning" text="Planned" />.

The asset registry is structured for richer formats so future Workshop appearance/motion packs can
drop in without touching scene code.
