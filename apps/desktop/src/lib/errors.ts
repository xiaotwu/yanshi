// App-wide error registry + toast queue.
//
// Every user-facing failure maps to a stable `YANSHI_<AREA>_<NNN>` code (documented in
// docs/ERROR_CATALOG.md) and surfaces as a red toast for ~8s: code + short localized reason +
// an optional action (Open Settings / Open logs). Unknown failures map to YANSHI_UNKNOWN_001.
// Structured diagnostic detail goes to the console (Developer Mode / logs) — never raw stack
// traces in the normal UI.

import { create } from "zustand";

import type { TKey } from "../i18n/en";

export type YanshiErrorCode = string;

export interface YanshiErrorDefinition {
  code: YanshiErrorCode;
  area: string;
  severity: "info" | "warning" | "error" | "critical";
  titleKey: TKey;
  reasonKey: TKey;
  /** Optional toast action. "settings" opens the given settings section; "logs" opens runtime logs. */
  action?: "settings" | "logs";
  settingsSection?: string;
}

const DEFINITIONS: YanshiErrorDefinition[] = [
  { code: "YANSHI_RUNTIME_001", area: "Runtime", severity: "critical", titleKey: "error.runtimeConnect.title", reasonKey: "error.runtimeConnect.reason", action: "logs" },
  { code: "YANSHI_RUNTIME_002", area: "Runtime", severity: "error", titleKey: "error.eventStream.title", reasonKey: "error.eventStream.reason", action: "logs" },
  { code: "YANSHI_RUNTIME_003", area: "Runtime", severity: "error", titleKey: "error.runtimeRestart.title", reasonKey: "error.runtimeRestart.reason", action: "logs" },
  { code: "YANSHI_PROVIDER_001", area: "Provider", severity: "warning", titleKey: "error.providerMissing.title", reasonKey: "error.providerMissing.reason", action: "settings", settingsSection: "providers" },
  { code: "YANSHI_PROVIDER_002", area: "Provider", severity: "error", titleKey: "error.providerTest.title", reasonKey: "error.providerTest.reason", action: "settings", settingsSection: "providers" },
  { code: "YANSHI_PROVIDER_003", area: "Provider", severity: "error", titleKey: "error.providerSave.title", reasonKey: "error.providerSave.reason" },
  { code: "YANSHI_BROWSER_001", area: "Browser", severity: "warning", titleKey: "error.browserEngine.title", reasonKey: "error.browserEngine.reason" },
  { code: "YANSHI_COMPUTER_001", area: "Computer", severity: "warning", titleKey: "error.computerAccess.title", reasonKey: "error.computerAccess.reason", action: "settings", settingsSection: "permissions" },
  { code: "YANSHI_COMPUTER_002", area: "Computer", severity: "warning", titleKey: "error.computerScreen.title", reasonKey: "error.computerScreen.reason", action: "settings", settingsSection: "permissions" },
  { code: "YANSHI_DOCKER_001", area: "Docker", severity: "warning", titleKey: "error.docker.title", reasonKey: "error.docker.reason" },
  { code: "YANSHI_FILE_001", area: "File", severity: "error", titleKey: "error.fileUpload.title", reasonKey: "error.fileUpload.reason" },
  { code: "YANSHI_FILE_002", area: "File", severity: "error", titleKey: "error.fileOp.title", reasonKey: "error.fileOp.reason" },
  { code: "YANSHI_WORKSHOP_001", area: "Workshop", severity: "error", titleKey: "error.workshopImport.title", reasonKey: "error.workshopImport.reason" },
  { code: "YANSHI_WORKSHOP_002", area: "Workshop", severity: "warning", titleKey: "error.workshopUnsafe.title", reasonKey: "error.workshopUnsafe.reason" },
  { code: "YANSHI_ATELIER_001", area: "Atelier", severity: "error", titleKey: "error.atelier.title", reasonKey: "error.atelier.reason" },
  { code: "YANSHI_ACP_001", area: "ACP", severity: "error", titleKey: "error.acp.title", reasonKey: "error.acp.reason", action: "settings", settingsSection: "agents" },
  { code: "YANSHI_MCP_001", area: "MCP", severity: "error", titleKey: "error.mcp.title", reasonKey: "error.mcp.reason", action: "settings", settingsSection: "mcp" },
  { code: "YANSHI_SHORTCUT_001", area: "Shortcuts", severity: "warning", titleKey: "error.shortcutConflict.title", reasonKey: "error.shortcutConflict.reason", action: "settings", settingsSection: "shortcuts" },
  { code: "YANSHI_SHORTCUT_002", area: "Shortcuts", severity: "warning", titleKey: "error.shortcutGlobal.title", reasonKey: "error.shortcutGlobal.reason" },
  { code: "YANSHI_SETTINGS_001", area: "Settings", severity: "error", titleKey: "error.settingsSave.title", reasonKey: "error.settingsSave.reason" },
  { code: "YANSHI_PROJECT_001", area: "Projects", severity: "error", titleKey: "error.project.title", reasonKey: "error.project.reason" },
  { code: "YANSHI_AUTOMATION_001", area: "Automations", severity: "error", titleKey: "error.automation.title", reasonKey: "error.automation.reason" },
  { code: "YANSHI_UI_001", area: "UI", severity: "error", titleKey: "error.ui.title", reasonKey: "error.ui.reason" },
  { code: "YANSHI_UNKNOWN_001", area: "Unknown", severity: "error", titleKey: "error.unknown.title", reasonKey: "error.unknown.reason" },
];

export const ERROR_REGISTRY: Record<YanshiErrorCode, YanshiErrorDefinition> = Object.fromEntries(
  DEFINITIONS.map((definition) => [definition.code, definition]),
);

export function resolveError(code: string | null | undefined): YanshiErrorDefinition {
  return (code && ERROR_REGISTRY[code]) || ERROR_REGISTRY.YANSHI_UNKNOWN_001;
}

/** Maps runtime missing-requirement identifiers (honest tool states) to catalog codes. */
export function codeForMissingRequirement(requirement: string): YanshiErrorCode | null {
  if (requirement.includes("playwright") || requirement.startsWith("browser_")) return "YANSHI_BROWSER_001";
  if (requirement.includes("screen")) return "YANSHI_COMPUTER_002";
  if (requirement.includes("macos_permissions") || requirement.includes("accessibility") || requirement.includes("control_bridge")) return "YANSHI_COMPUTER_001";
  if (requirement.startsWith("docker")) return "YANSHI_DOCKER_001";
  if (requirement === "model_provider") return "YANSHI_PROVIDER_001";
  return null;
}

// ---------------------------------------------------------------------------------------------
// Toast queue

export const TOAST_DURATION_MS = 8000;
const DEDUPE_WINDOW_MS = 5000;
const MAX_TOASTS = 4;

export interface ErrorToast {
  id: number;
  code: YanshiErrorCode;
  at: number;
}

interface ToastState {
  toasts: ErrorToast[];
  push: (code: YanshiErrorCode) => void;
  dismiss: (id: number) => void;
}

let nextToastId = 1;
const timers = new Map<number, ReturnType<typeof setTimeout>>();

export const useErrorToasts = create<ToastState>((set, get) => ({
  toasts: [],
  push: (code) => {
    const now = Date.now();
    // Same code within the dedupe window refreshes instead of stacking duplicates.
    if (get().toasts.some((toast) => toast.code === code && now - toast.at < DEDUPE_WINDOW_MS)) return;
    const toast: ErrorToast = { id: nextToastId++, code, at: now };
    set((state) => ({ toasts: [...state.toasts.slice(-(MAX_TOASTS - 1)), toast] }));
    timers.set(
      toast.id,
      setTimeout(() => get().dismiss(toast.id), TOAST_DURATION_MS),
    );
  },
  dismiss: (id) => {
    const timer = timers.get(id);
    if (timer) clearTimeout(timer);
    timers.delete(id);
    set((state) => ({ toasts: state.toasts.filter((toast) => toast.id !== id) }));
  },
}));

/**
 * Report a user-facing error: shows the red toast and logs structured detail for Developer
 * Mode / logs. `detail` is diagnostic only — it never renders in the normal UI.
 */
export function reportError(code: YanshiErrorCode | null | undefined, detail?: unknown): void {
  const definition = resolveError(code);
  // Structured diagnostics for Developer Mode / console logs (no stack traces in the UI).
  console.error(`[yanshi] ${definition.code} (${definition.area}/${definition.severity})`, detail ?? "");
  useErrorToasts.getState().push(definition.code);
}
