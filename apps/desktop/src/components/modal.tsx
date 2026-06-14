import { X } from "lucide-react";
import { useEffect, useRef } from "react";
import type { ReactNode } from "react";

import { useT } from "../i18n";
import { isTopModal, pushModal, releaseModal } from "../lib/modal-stack";

const FOCUSABLE = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

/**
 * Shared centered floating window. Every large surface (Search, Settings, New Project, Atelier,
 * Workshop dialogs, shortcut editor) renders through this so the behavior is uniform:
 * centered + viewport-clamped, internal scrolling, animated open, ESC + backdrop close
 * (opt-out for destructive/unsaved flows), focus trapped while open, focus restored on close.
 */
export function Modal({
  onClose,
  children,
  className = "",
  size = "md",
  labelledBy,
  closeOnBackdrop = true,
  closeOnEscape = true,
}: {
  onClose: () => void;
  children: ReactNode;
  className?: string;
  size?: "sm" | "md" | "lg" | "xl";
  labelledBy?: string;
  closeOnBackdrop?: boolean;
  closeOnEscape?: boolean;
}) {
  const surfaceRef = useRef<HTMLDivElement>(null);

  // One stable stack token per mounted modal (survives effect re-runs, so a parent re-render
  // can never re-push its token above a nested child's).
  const stackTokenRef = useRef<symbol | null>(null);
  useEffect(() => {
    const token = pushModal();
    stackTokenRef.current = token;
    return () => releaseModal(token);
  }, []);

  // Focus trap + restore. The surface itself is focusable as a fallback target.
  useEffect(() => {
    const surface = surfaceRef.current;
    if (!surface) return;
    const previous = document.activeElement as HTMLElement | null;
    const autofocus = surface.querySelector<HTMLElement>("[data-autofocus]") ?? surface.querySelector<HTMLElement>(FOCUSABLE);
    (autofocus ?? surface).focus();

    // ESC must work no matter where focus is, so it listens on window; the Tab trap
    // stays on the surface. With nested modals, only the topmost layer may close —
    // one ESC, one layer.
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && closeOnEscape && stackTokenRef.current && isTopModal(stackTokenRef.current)) {
        event.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", onEscape);
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return;
      const focusable = [...surface.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => !el.hasAttribute("disabled"));
      if (focusable.length === 0) {
        event.preventDefault();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && (document.activeElement === first || document.activeElement === surface)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    surface.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onEscape);
      surface.removeEventListener("keydown", onKey);
      previous?.focus?.();
    };
  }, [closeOnEscape, onClose]);

  return (
    <div className="modal-overlay" onMouseDown={closeOnBackdrop ? onClose : undefined}>
      <div
        ref={surfaceRef}
        className={`modal-surface modal-${size} ${className}`.trim()}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        tabIndex={-1}
        onMouseDown={(event) => event.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

export function ModalHeader({ title, id, onClose, children }: { title: string; id?: string; onClose: () => void; children?: ReactNode }) {
  const { t } = useT();
  return (
    <header className="modal-head">
      <h2 id={id}>{title}</h2>
      <div className="modal-head-actions">
        {children}
        <button className="icon-button ghost" onClick={onClose} aria-label={t("common.close")} title={t("common.close")}>
          <X size={16} />
        </button>
      </div>
    </header>
  );
}
