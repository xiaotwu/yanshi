import { readFileSync } from "node:fs";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { en } from "../i18n/en";
import { zh } from "../i18n/zh";
import { codeForMissingRequirement, ERROR_REGISTRY, resolveError, TOAST_DURATION_MS, useErrorToasts } from "./errors";

describe("error registry", () => {
  it("uses the YANSHI_<AREA>_<NNN> format with unique codes", () => {
    const codes = Object.keys(ERROR_REGISTRY);
    expect(codes.length).toBeGreaterThanOrEqual(20);
    expect(new Set(codes).size).toBe(codes.length);
    for (const code of codes) expect(code).toMatch(/^YANSHI_[A-Z]+_\d{3}$/);
  });

  it("has localized title + reason for every code in both locales", () => {
    for (const definition of Object.values(ERROR_REGISTRY)) {
      expect(en[definition.titleKey], definition.code).toBeTruthy();
      expect(en[definition.reasonKey], definition.code).toBeTruthy();
      expect(zh[definition.titleKey], definition.code).toBeTruthy();
      expect(zh[definition.reasonKey], definition.code).toBeTruthy();
    }
  });

  it("maps unknown codes to YANSHI_UNKNOWN_001", () => {
    expect(resolveError("YANSHI_NOPE_999").code).toBe("YANSHI_UNKNOWN_001");
    expect(resolveError(null).code).toBe("YANSHI_UNKNOWN_001");
    expect(resolveError("YANSHI_ACP_001").code).toBe("YANSHI_ACP_001");
  });

  it("maps runtime missing-requirement ids to catalog codes", () => {
    expect(codeForMissingRequirement("playwright_browser_binaries")).toBe("YANSHI_BROWSER_001");
    expect(codeForMissingRequirement("macos_permissions")).toBe("YANSHI_COMPUTER_001");
    expect(codeForMissingRequirement("macos_screencapture")).toBe("YANSHI_COMPUTER_002");
    expect(codeForMissingRequirement("docker_daemon")).toBe("YANSHI_DOCKER_001");
    expect(codeForMissingRequirement("model_provider")).toBe("YANSHI_PROVIDER_001");
    expect(codeForMissingRequirement("something_else")).toBeNull();
  });

  it("is fully documented in docs/ERROR_CATALOG.md", () => {
    const catalog = readFileSync(join(__dirname, "../../../../docs/ERROR_CATALOG.md"), "utf8");
    for (const code of Object.keys(ERROR_REGISTRY)) {
      expect(catalog.includes(`## ${code}`), `${code} missing from catalog`).toBe(true);
    }
  });
});

describe("toast queue", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useErrorToasts.setState({ toasts: [] });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("stacks toasts, dedupes repeats, and auto-dismisses after ~8s", () => {
    const { push } = useErrorToasts.getState();
    push("YANSHI_RUNTIME_001");
    push("YANSHI_RUNTIME_001"); // deduped inside the window
    push("YANSHI_PROVIDER_002");
    expect(useErrorToasts.getState().toasts.map((toast) => toast.code)).toEqual(["YANSHI_RUNTIME_001", "YANSHI_PROVIDER_002"]);

    vi.advanceTimersByTime(TOAST_DURATION_MS + 50);
    expect(useErrorToasts.getState().toasts).toHaveLength(0);
  });

  it("supports manual dismiss and caps the stack", () => {
    const { push } = useErrorToasts.getState();
    push("YANSHI_RUNTIME_001");
    const id = useErrorToasts.getState().toasts[0].id;
    useErrorToasts.getState().dismiss(id);
    expect(useErrorToasts.getState().toasts).toHaveLength(0);

    for (const code of ["YANSHI_FILE_001", "YANSHI_FILE_002", "YANSHI_MCP_001", "YANSHI_ACP_001", "YANSHI_UI_001"]) push(code);
    expect(useErrorToasts.getState().toasts.length).toBeLessThanOrEqual(4);
  });
});
