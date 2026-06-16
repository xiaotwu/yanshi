import type { TKey } from "../i18n/en";

/**
 * Accent color customization. Pure presentation preference stored client-side (localStorage) and
 * applied via a `data-accent` attribute on the root element, which CSS overrides into the accent
 * tokens. "mint" is the default (no attribute).
 */
export interface AccentPreset {
  id: string;
  labelKey: TKey;
  color: string;
}

export const ACCENTS: AccentPreset[] = [
  { id: "mint", labelKey: "accent.mint", color: "#1faa6a" },
  { id: "blue", labelKey: "accent.blue", color: "#2f7fe0" },
  { id: "violet", labelKey: "accent.violet", color: "#7c5cf0" },
  { id: "amber", labelKey: "accent.amber", color: "#d9892a" },
];

const STORAGE_KEY = "yanshi.accent";

export function getAccent(): string {
  try {
    return window.localStorage.getItem(STORAGE_KEY) || "mint";
  } catch {
    return "mint";
  }
}

/** Apply an accent (or the persisted one) to the document root. */
export function applyAccent(id?: string): void {
  const accent = id ?? getAccent();
  const root = document.documentElement;
  if (accent === "mint") root.removeAttribute("data-accent");
  else root.setAttribute("data-accent", accent);
}

export function setAccent(id: string): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, id);
  } catch {
    /* persistence best-effort */
  }
  applyAccent(id);
}
