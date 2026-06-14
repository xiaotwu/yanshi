/**
 * In-app keyboard shortcut registry. Defaults live here; user overrides persist in
 * `AppSettings.shortcuts` (command id → binding, empty string = cleared). Bindings use a
 * normalized "Meta+Shift+K" form and render as macOS symbols (⌘⇧K).
 *
 * Conflict detection is reliable *inside* Yanshi only (two commands on one binding). Conflicts
 * with macOS or other apps cannot be reliably detected — the settings UI says so honestly.
 */

export type ShortcutCategory = "general" | "navigation" | "composer" | "projects" | "atelier" | "developer" | "tools";

export interface ShortcutCommand {
  id: string;
  category: ShortcutCategory;
  /** Default binding, or null when the command ships unbound. */
  defaultBinding: string | null;
}

export const SHORTCUT_COMMANDS: ShortcutCommand[] = [
  { id: "new-task", category: "general", defaultBinding: "Meta+N" },
  { id: "open-search", category: "general", defaultBinding: "Meta+K" },
  { id: "open-settings", category: "general", defaultBinding: "Meta+," },
  { id: "open-projects", category: "projects", defaultBinding: "Meta+Shift+O" },
  { id: "new-project", category: "projects", defaultBinding: "Meta+Shift+N" },
  { id: "open-library", category: "navigation", defaultBinding: "Meta+Shift+L" },
  { id: "open-workshop", category: "navigation", defaultBinding: "Meta+Shift+W" },
  { id: "open-task-details", category: "navigation", defaultBinding: "Meta+D" },
  { id: "open-atelier", category: "atelier", defaultBinding: "Meta+L" },
  { id: "toggle-progress", category: "navigation", defaultBinding: "Meta+J" },
  { id: "toggle-sidebar", category: "navigation", defaultBinding: "Meta+B" },
  { id: "focus-composer", category: "composer", defaultBinding: "Meta+E" },
  { id: "submit-task", category: "composer", defaultBinding: "Meta+Enter" },
  { id: "upload-file", category: "composer", defaultBinding: "Meta+U" },
  { id: "pause-all", category: "tools", defaultBinding: "Meta+Shift+." },
  { id: "open-developer", category: "developer", defaultBinding: "Meta+Shift+D" },
];

const MODIFIER_ORDER = ["Meta", "Ctrl", "Alt", "Shift"] as const;
const SYMBOLS: Record<string, string> = { Meta: "⌘", Ctrl: "⌃", Alt: "⌥", Shift: "⇧", Enter: "↩", Escape: "⎋", " ": "Space", ArrowUp: "↑", ArrowDown: "↓", ArrowLeft: "←", ArrowRight: "→" };

/** Effective binding per command after applying overrides ("" override = unbound). */
export function resolveBindings(overrides: Record<string, string>): Map<string, string> {
  const map = new Map<string, string>();
  for (const command of SHORTCUT_COMMANDS) {
    const override = overrides[command.id];
    const binding = override !== undefined ? override : (command.defaultBinding ?? "");
    if (binding) map.set(command.id, binding);
  }
  return map;
}

/** Command ids that share a binding with another command (in-app conflicts). */
export function findConflicts(overrides: Record<string, string>): Map<string, string[]> {
  const byBinding = new Map<string, string[]>();
  for (const [id, binding] of resolveBindings(overrides)) {
    const list = byBinding.get(binding) ?? [];
    list.push(id);
    byBinding.set(binding, list);
  }
  const conflicts = new Map<string, string[]>();
  for (const ids of byBinding.values()) {
    if (ids.length < 2) continue;
    for (const id of ids) conflicts.set(id, ids.filter((other) => other !== id));
  }
  return conflicts;
}

/** Normalize a KeyboardEvent into a binding string, or null for bare modifiers. */
export function eventToBinding(event: Pick<KeyboardEvent, "key" | "metaKey" | "ctrlKey" | "altKey" | "shiftKey">): string | null {
  const key = event.key;
  if (key === "Meta" || key === "Control" || key === "Alt" || key === "Shift") return null;
  const parts: string[] = [];
  if (event.metaKey) parts.push("Meta");
  if (event.ctrlKey) parts.push("Ctrl");
  if (event.altKey) parts.push("Alt");
  if (event.shiftKey) parts.push("Shift");
  parts.push(key.length === 1 ? key.toUpperCase() : key);
  return parts.join("+");
}

/** Render "Meta+Shift+K" as "⌘⇧K". */
export function formatBinding(binding: string): string {
  if (!binding) return "";
  const parts = binding.split("+");
  const key = parts[parts.length - 1];
  const mods = parts.slice(0, -1);
  const ordered = MODIFIER_ORDER.filter((mod) => mods.includes(mod));
  return [...ordered.map((mod) => SYMBOLS[mod]), SYMBOLS[key] ?? key].join("");
}

/** True when the binding should fire even while an input/textarea has focus. */
export function firesInEditable(binding: string): boolean {
  return binding.includes("Meta+") || binding.includes("Ctrl+");
}

// --- Capture suspension -------------------------------------------------------------------
// While the shortcut editor is capturing a chord, NO app command may fire. The editor sets this
// flag (in addition to stopping propagation of the captured event) and the app-level dispatcher
// checks it — belt and braces so a captured chord can never trigger its current command.

let captureActive = false;

export function setShortcutCaptureActive(active: boolean): void {
  captureActive = active;
}

export function isShortcutCaptureActive(): boolean {
  return captureActive;
}

// --- Pre-save validation ------------------------------------------------------------------

export type BindingValidation = { ok: true } | { ok: false; conflictsWith: string[] };

/**
 * Validate a captured chord BEFORE persisting it. A conflicting chord must not be saved
 * silently — the editor shows the conflict and requires explicit resolution (replace or cancel).
 */
export function validateBinding(commandId: string, binding: string, overrides: Record<string, string>): BindingValidation {
  const conflictsWith: string[] = [];
  for (const [id, bound] of resolveBindings({ ...overrides, [commandId]: binding })) {
    if (id !== commandId && bound === binding) conflictsWith.push(id);
  }
  return conflictsWith.length > 0 ? { ok: false, conflictsWith } : { ok: true };
}
