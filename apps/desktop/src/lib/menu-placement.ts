// Viewport-aware placement for the composer "+" menu and its Add-to-Project
// flyout. Pure geometry so it is unit-testable: the
// resulting bounding box must sit inside the viewport minus COLLISION_PADDING —
// internal scrolling (maxHeight) is a fallback, not the containment mechanism.

export const COLLISION_PADDING = 12;
export const MENU_GAP = 8;
// The flyout overlaps the menu edge slightly so the pointer never crosses a
// dead zone (which would fire the menu's mouseleave close).
export const SUBMENU_OVERLAP = 2;

export interface AnchoredMenuPlacement {
  direction: "down" | "up";
  maxHeight: number;
}

// Dropdown anchored to a trigger, opening below by default. Flips upward when
// the space below cannot hold the content; if neither side fits, uses the
// larger side and clamps maxHeight to it so the box stays inside the viewport.
export function placeAnchoredMenu(
  trigger: { top: number; bottom: number },
  contentHeight: number,
  viewportHeight: number,
  padding: number = COLLISION_PADDING,
  gap: number = MENU_GAP,
): AnchoredMenuPlacement {
  const spaceBelow = viewportHeight - padding - trigger.bottom - gap;
  const spaceAbove = trigger.top - gap - padding;
  if (contentHeight <= spaceBelow) return { direction: "down", maxHeight: spaceBelow };
  if (contentHeight <= spaceAbove) return { direction: "up", maxHeight: spaceAbove };
  return spaceBelow >= spaceAbove
    ? { direction: "down", maxHeight: Math.max(spaceBelow, 0) }
    : { direction: "up", maxHeight: Math.max(spaceAbove, 0) };
}

export interface SubmenuPlacement {
  top: number;
  left: number;
  maxHeight: number;
}

export interface PanelPlacement {
  top: number;
  left: number;
  maxHeight: number;
}

// General fixed-position panel anchored to a rect (menus, account menu, "…" menus, context menus —
// for context menus pass a zero-size rect at the cursor). Opens below the anchor aligned to its
// start edge by default; flips above when the space below is too small, aligns to the end edge when
// the right side overflows, and clamps both axes plus maxHeight to the padded viewport.
export function placeFloatingPanel(
  anchor: { top: number; bottom: number; left: number; right: number },
  content: { width: number; height: number },
  viewport: { width: number; height: number },
  options: { padding?: number; gap?: number; align?: "start" | "end" } = {},
): PanelPlacement {
  const padding = options.padding ?? COLLISION_PADDING;
  const gap = options.gap ?? MENU_GAP;
  const vertical = placeAnchoredMenu(anchor, content.height, viewport.height, padding, gap);
  const height = Math.min(content.height, vertical.maxHeight);
  let top = vertical.direction === "down" ? anchor.bottom + gap : anchor.top - gap - height;
  top = Math.min(Math.max(top, padding), Math.max(viewport.height - padding - height, padding));

  let left = options.align === "end" ? anchor.right - content.width : anchor.left;
  if (left + content.width > viewport.width - padding) left = anchor.right - content.width;
  left = Math.min(Math.max(left, padding), Math.max(viewport.width - padding - content.width, padding));

  return { top, left, maxHeight: vertical.maxHeight };
}

// Fixed-position flyout anchored beside a menu row. Opens to the right of the
// menu, top-aligned with the row; flips to the left side when the right edge
// would overflow, and shifts up (independently of the row) when the bottom
// would overflow. Height is clamped to the viewport minus padding.
export function placeSubmenu(
  row: { top: number },
  menu: { left: number; right: number },
  content: { width: number; height: number },
  viewport: { width: number; height: number },
  padding: number = COLLISION_PADDING,
  overlap: number = SUBMENU_OVERLAP,
): SubmenuPlacement {
  const maxHeight = Math.max(viewport.height - padding * 2, 0);
  const height = Math.min(content.height, maxHeight);

  let left = menu.right - overlap;
  if (left + content.width > viewport.width - padding) {
    left = menu.left - content.width + overlap;
  }
  left = Math.min(Math.max(left, padding), Math.max(viewport.width - padding - content.width, padding));

  let top = row.top;
  if (top + height > viewport.height - padding) top = viewport.height - padding - height;
  if (top < padding) top = padding;

  return { top, left, maxHeight };
}
