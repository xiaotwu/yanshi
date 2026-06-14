# Office Editor

The **Office Editor** (Workshop → Office Editor) is a visual 2D canvas for laying out the atelier.

## What you can do

- Drag **stations** and **areas** (work desks, rest, coffee, break, meeting) around the floor.
- Add and arrange **furniture** (desk, plant, shelf, couch, table, lamp) — draggable and
  removable.
- **Snap** to a grid and **Reset** the layout.

The layout persists as real office state and drives the 3D Atelier. It exports/imports as part of
a [Workshop pack](/customization/workshop).

## Scope

The layout describes positions that the Atelier renders. Path/collision metadata and real agent
pathfinding are **planned** — workers currently move with simple interpolation under the
[station rules](/concepts/atelier). Nothing here is stubbed or faked.

## Station rules still apply

Even with a custom layout, the occupancy guard holds: a worker's home station is owner-only, and
shared areas hand out non-overlapping slots. See [Yanshi Atelier](/concepts/atelier).
