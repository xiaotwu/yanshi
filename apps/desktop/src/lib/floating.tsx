import { useLayoutEffect, useRef, useState } from "react";
import type { CSSProperties, RefObject } from "react";

import { placeFloatingPanel } from "./menu-placement";

// Pre-placement style: render off-screen but measurable so the first paint never flashes
// a mis-placed panel.
const MEASURING: CSSProperties = { position: "fixed", top: 0, left: 0, visibility: "hidden" };

/**
 * Viewport-safe placement for fixed-position floating panels (dropdown menus, "…" menus,
 * account menu, context menus). Measures the panel before paint and places it with
 * `placeFloatingPanel` (flip vertically, shift horizontally, clamp + internal scroll).
 *
 * `getAnchor` returns the anchor rect — an element rect for menus, or a zero-size rect at the
 * cursor for context menus.
 */
export function useFloatingPanel(
  open: boolean,
  getAnchor: () => DOMRect | { top: number; bottom: number; left: number; right: number } | null,
  deps: unknown[] = [],
  options: { padding?: number; gap?: number; align?: "start" | "end" } = {},
): { panelRef: RefObject<HTMLDivElement | null>; panelStyle: CSSProperties | undefined } {
  const panelRef = useRef<HTMLDivElement>(null);
  const [style, setStyle] = useState<CSSProperties | undefined>();
  const { padding, gap, align } = options;

  useLayoutEffect(() => {
    if (!open) {
      setStyle(undefined);
      return;
    }
    const el = panelRef.current;
    const anchor = getAnchor();
    if (!el || !anchor) return;
    const placement = placeFloatingPanel(
      anchor,
      { width: el.offsetWidth, height: el.scrollHeight + (el.offsetHeight - el.clientHeight) },
      { width: window.innerWidth, height: window.innerHeight },
      { padding, gap, align },
    );
    setStyle({
      position: "fixed",
      top: placement.top,
      left: placement.left,
      maxHeight: placement.maxHeight,
      overflowY: "auto",
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, padding, gap, align, ...deps]);

  return { panelRef, panelStyle: open ? (style ?? MEASURING) : undefined };
}

/** Close an open floating panel on any outside pointer-down or window resize. */
export function useDismiss(open: boolean, refs: Array<RefObject<HTMLElement | null>>, onClose: () => void): void {
  useLayoutEffect(() => {
    if (!open) return;
    const onDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (refs.some((ref) => ref.current?.contains(target))) return;
      onClose();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    window.addEventListener("resize", onClose);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onClose);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, onClose]);
}
