import { describe, expect, it } from "vitest";

import { COLLISION_PADDING, MENU_GAP, placeAnchoredMenu, placeSubmenu } from "./menu-placement";

// Geometry from the Codex regression failure (LOGS/35-add-to-project-containment-check.json):
// viewport 1200x818, "+" trigger ends at y≈480.5 (menu used to open at 488.5 and
// run to 848.4), menu content 412px tall, submenu 176x124 anchored at row top 771.5.
const VIEWPORT = { width: 1200, height: 818 };
const TRIGGER = { top: 442.5, bottom: 480.5 };
const MENU_CONTENT_HEIGHT = 412;

function menuBox(trigger: { top: number; bottom: number }, contentHeight: number, viewportHeight: number) {
  const placement = placeAnchoredMenu(trigger, contentHeight, viewportHeight);
  const height = Math.min(contentHeight, placement.maxHeight);
  const top = placement.direction === "down" ? trigger.bottom + MENU_GAP : trigger.top - MENU_GAP - height;
  return { top, bottom: top + height, placement };
}

describe("placeAnchoredMenu", () => {
  it("flips the QA-failing menu upward and keeps it inside the 818px viewport", () => {
    const { top, bottom, placement } = menuBox(TRIGGER, MENU_CONTENT_HEIGHT, VIEWPORT.height);
    expect(placement.direction).toBe("up");
    expect(top).toBeGreaterThanOrEqual(COLLISION_PADDING);
    expect(bottom).toBeLessThanOrEqual(VIEWPORT.height - COLLISION_PADDING);
  });

  it("opens downward when there is room below", () => {
    const { bottom, placement } = menuBox({ top: 80, bottom: 118 }, MENU_CONTENT_HEIGHT, VIEWPORT.height);
    expect(placement.direction).toBe("down");
    expect(bottom).toBeLessThanOrEqual(VIEWPORT.height - COLLISION_PADDING);
  });

  it("clamps maxHeight when neither side can hold the content (short viewports)", () => {
    const viewportHeight = 480;
    const { top, bottom, placement } = menuBox({ top: 200, bottom: 238 }, MENU_CONTENT_HEIGHT, viewportHeight);
    expect(placement.maxHeight).toBeLessThan(MENU_CONTENT_HEIGHT);
    expect(top).toBeGreaterThanOrEqual(COLLISION_PADDING);
    expect(bottom).toBeLessThanOrEqual(viewportHeight - COLLISION_PADDING);
  });
});

describe("placeSubmenu", () => {
  const MENU = { left: 335, right: 525 };
  const SUBMENU = { width: 176, height: 124 };

  it("shifts the QA-failing submenu up so its box stays inside the viewport", () => {
    const placement = placeSubmenu({ top: 771.5 }, MENU, SUBMENU, VIEWPORT);
    expect(placement.top).toBeGreaterThanOrEqual(COLLISION_PADDING);
    expect(placement.top + SUBMENU.height).toBeLessThanOrEqual(VIEWPORT.height - COLLISION_PADDING);
    expect(placement.left + SUBMENU.width).toBeLessThanOrEqual(VIEWPORT.width - COLLISION_PADDING);
  });

  it("keeps the row-aligned top when there is room below", () => {
    const placement = placeSubmenu({ top: 300 }, MENU, SUBMENU, VIEWPORT);
    expect(placement.top).toBe(300);
    expect(placement.left).toBeGreaterThan(MENU.right - 10);
  });

  it("flips to the left side of the menu when the right edge would overflow", () => {
    const rightMenu = { left: 980, right: 1170 };
    const placement = placeSubmenu({ top: 300 }, rightMenu, SUBMENU, VIEWPORT);
    expect(placement.left + SUBMENU.width).toBeLessThanOrEqual(VIEWPORT.width - COLLISION_PADDING);
    expect(placement.left).toBeLessThan(rightMenu.left);
  });

  it("clamps height and pins to padding when the submenu is taller than the viewport", () => {
    const tall = { width: 176, height: 900 };
    const placement = placeSubmenu({ top: 700 }, MENU, tall, VIEWPORT);
    expect(placement.top).toBe(COLLISION_PADDING);
    expect(placement.maxHeight).toBe(VIEWPORT.height - COLLISION_PADDING * 2);
  });
});
