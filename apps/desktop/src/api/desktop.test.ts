// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";

const { invoke } = vi.hoisted(() => ({ invoke: vi.fn() }));

vi.mock("@tauri-apps/api/core", () => ({ invoke }));

import { checkForUpdates, updaterConfigured } from "./desktop";

describe("desktop updater bridge", () => {
  afterEach(() => {
    invoke.mockReset();
    delete (window as Window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__;
  });

  it("keeps update checks inert when updater config is absent", async () => {
    Object.defineProperty(window, "__TAURI_INTERNALS__", { value: {}, configurable: true });

    expect(updaterConfigured()).toBe(false);
    await expect(checkForUpdates()).resolves.toEqual({ status: "not_configured" });
    expect(invoke).not.toHaveBeenCalled();
  });
});
