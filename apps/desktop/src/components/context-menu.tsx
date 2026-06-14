import { useCallback, useEffect, useState } from "react";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { useDismiss, useFloatingPanel } from "../lib/floating";

export interface ContextMenuItem {
  id: string;
  label: string;
  icon?: LucideIcon;
  danger?: boolean;
  /** Disabled items stay visible and explain why via `disabledReason`. */
  disabled?: boolean;
  disabledReason?: string;
  onSelect: () => void;
}

export type ContextMenuEntry = ContextMenuItem | "divider";

interface MenuState {
  x: number;
  y: number;
  items: ContextMenuEntry[];
}

/**
 * App-wide right-click menu. `useContextMenu` returns an `open(event, items)` handler for
 * `onContextMenu` plus the rendered menu element. Placement is viewport-safe (shared floating
 * placement), dismissal is outside-click/ESC/resize, and items are keyboard-navigable
 * (arrows + Enter) — real actions only; impossible actions are disabled with a reason.
 */
export function useContextMenu(): {
  openContextMenu: (event: React.MouseEvent, items: ContextMenuEntry[]) => void;
  contextMenu: ReactNode;
} {
  const [menu, setMenu] = useState<MenuState | null>(null);
  const close = useCallback(() => setMenu(null), []);
  const { panelRef, panelStyle } = useFloatingPanel(
    Boolean(menu),
    () => (menu ? { top: menu.y, bottom: menu.y, left: menu.x, right: menu.x } : null),
    [menu],
    { gap: 2 },
  );
  useDismiss(Boolean(menu), [panelRef], close);

  const openContextMenu = useCallback((event: React.MouseEvent, items: ContextMenuEntry[]) => {
    event.preventDefault();
    event.stopPropagation();
    setMenu({ x: event.clientX, y: event.clientY, items });
  }, []);

  // Keyboard navigation among enabled items.
  useEffect(() => {
    if (!menu) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
      event.preventDefault();
      const buttons = [...(panelRef.current?.querySelectorAll<HTMLButtonElement>("button:not(:disabled)") ?? [])];
      if (buttons.length === 0) return;
      const index = buttons.findIndex((button) => button === document.activeElement);
      const next = event.key === "ArrowDown" ? (index + 1) % buttons.length : (index - 1 + buttons.length) % buttons.length;
      buttons[next].focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menu, panelRef]);

  const contextMenu = menu ? (
    <div className="context-menu" role="menu" ref={panelRef} style={panelStyle}>
      {menu.items.map((entry, index) =>
        entry === "divider" ? (
          <div key={`divider-${index}`} className="menu-divider" />
        ) : (
          <button
            key={entry.id}
            role="menuitem"
            className={`menu-row${entry.danger ? " danger-text" : ""}`}
            disabled={entry.disabled}
            title={entry.disabled ? entry.disabledReason : undefined}
            onClick={() => {
              close();
              entry.onSelect();
            }}
          >
            {entry.icon && <entry.icon size={15} />} {entry.label}
            {entry.disabled && entry.disabledReason && <small className="menu-reason">{entry.disabledReason}</small>}
          </button>
        ),
      )}
    </div>
  ) : null;

  return { openContextMenu, contextMenu };
}
