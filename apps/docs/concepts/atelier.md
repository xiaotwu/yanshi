# Yanshi Atelier · 偃师工坊

The **Yanshi Atelier** is the animated worker world. It is not decoration for its own sake — it is
a visual mirror of **real runtime state**.

![Yanshi Atelier — workers at their stations](/screens/atelier-dark.png)

## Workers mirror real state

Each worker represents a real agent. When a task is active, a worker's pose reflects the live
runtime status (working, waiting for approval, blocked, completed). When nothing is running,
workers show decorative idle/life animations (a coffee break, a nap) — clearly labeled as
decorative and **never** implying progress that is not happening.

## The Yanshi Puppets

Workers are the **Yanshi Puppets (偃师傀)** — an original chibi design system: a large soft head,
a compact body, mechanical "puppet-ear" fins, and a small mechanism-seal mark. Six role variants
(Manager, Reviewer, Browser, Computer, File, Terminal) share one visual family, each with a
distinct silhouette cue, palette, and desk prop.

![Yanshi Puppet roles and expressions](/screens/workers.png)

::: info Status
Workers render as authored 2D SVG art shown as billboard standees in the 3D office, and reused in
the 2D fallback view. Animated sprite sheets and modelled 3D characters are
<Badge type="warning" text="Planned" />. See [Worker Design](/customization/worker-design).
:::

## Stations

Every worker has one **home station** and normally stays there. Movement is behavior-gated — a
worker only leaves for a real reason (break room, rest, a shared table) and then returns home. An
occupancy guard ensures no worker ever occupies another worker's station, and shared areas hand
out non-overlapping slots.

## Rendering & accessibility

- Hover a worker for a localized card (role, status, current task, queue, fatigue).
- Normal mode is tooltip-only; **Developer Mode** adds floating debug labels and meta counts.
- `prefers-reduced-motion` switches to static poses.
- The **GPU Acceleration** setting controls render quality; if WebGL is unavailable or fails, the
  Atelier shows a friendly fallback (retry / simplified worker list) and never blanks the app.
