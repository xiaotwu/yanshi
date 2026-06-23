import { invoke } from "@tauri-apps/api/core";
import type { DesktopRuntimeStatus, MacosPermissionStatus } from "@yanshi/shared";

export interface UpdateCheckResult {
  status: "not_configured" | "up_to_date" | "available" | "error";
  version?: string | null;
  currentVersion?: string | null;
  error?: string | null;
}

export async function getDesktopRuntimeStatus(): Promise<DesktopRuntimeStatus | null> {
  if (!("__TAURI_INTERNALS__" in window)) return null;
  try {
    return await invoke<DesktopRuntimeStatus>("runtime_status");
  } catch {
    return null;
  }
}

export async function restartDesktopRuntime(): Promise<DesktopRuntimeStatus | null> {
  if (!("__TAURI_INTERNALS__" in window)) return null;
  return invoke<DesktopRuntimeStatus>("restart_runtime");
}

export async function openDesktopRuntimeLogs(): Promise<void> {
  if (!("__TAURI_INTERNALS__" in window)) return;
  await invoke("open_runtime_logs");
}

export async function getMacosPermissionStatus(): Promise<MacosPermissionStatus | null> {
  if (!("__TAURI_INTERNALS__" in window)) return null;
  try {
    return await invoke<MacosPermissionStatus>("macos_permission_status");
  } catch {
    return null;
  }
}

export async function sendDesktopNotification(title: string, body: string): Promise<void> {
  if (!("__TAURI_INTERNALS__" in window)) return;
  await invoke("desktop_notify", { request: { title, body } });
}

export async function popOutLiveOffice(): Promise<void> {
  if (!("__TAURI_INTERNALS__" in window)) return;
  await invoke("pop_out_live_office");
}

export function canRevealFiles(): boolean {
  return "__TAURI_INTERNALS__" in window;
}

export async function revealPath(path: string): Promise<void> {
  if (!("__TAURI_INTERNALS__" in window)) return;
  await invoke("reveal_path", { path });
}

export async function updateActiveRuns(count: number): Promise<void> {
  if (!("__TAURI_INTERNALS__" in window)) return;
  await invoke("update_active_runs", { count });
}

export function updaterConfigured(): boolean {
  return import.meta.env.VITE_YANSHI_UPDATER_ENABLED === "true";
}

export async function checkForUpdates(): Promise<UpdateCheckResult> {
  if (!("__TAURI_INTERNALS__" in window) || !updaterConfigured()) {
    return { status: "not_configured" };
  }
  try {
    return await invoke<UpdateCheckResult>("check_for_updates");
  } catch (error) {
    return { status: "error", error: error instanceof Error ? error.message : String(error) };
  }
}

export async function hideMainWindow(): Promise<void> {
  if (!("__TAURI_INTERNALS__" in window)) return;
  await invoke("hide_main_window");
}

export async function quitApp(): Promise<void> {
  if (!("__TAURI_INTERNALS__" in window)) return;
  await invoke("quit_app");
}
