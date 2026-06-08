import { invoke } from "@tauri-apps/api/core";
import type { DesktopRuntimeStatus, MacosPermissionStatus } from "@yanshi/shared";

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
