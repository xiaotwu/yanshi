// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";

import { captureCrashReport, crashReporterStatus, initCrashReporter, scrubCrashPayload } from "./crash-reporter";

describe("crash reporter", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("is disabled until a crash-report DSN is configured", () => {
    expect(crashReporterStatus()).toBe("not_configured");
  });

  it("does not attach handlers or send payloads while unconfigured", () => {
    const addEventListener = vi.spyOn(window, "addEventListener");
    const fetch = vi.fn();
    const sendBeacon = vi.fn();
    vi.stubGlobal("fetch", fetch);
    Object.defineProperty(navigator, "sendBeacon", { value: sendBeacon, configurable: true });

    initCrashReporter();
    captureCrashReport({ code: "YANSHI_TEST_001", detail: { token: "not-a-real-token" } });

    expect(addEventListener).not.toHaveBeenCalled();
    expect(sendBeacon).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("scrubs secrets and email-like PII before sending", () => {
    const payload = scrubCrashPayload({
      message: "failed for jane@example.com with Bearer TEST_REDACTION_VALUE_123456",
      apiKey: "not-a-real-secret",
      nested: {
        token: "not-a-real-token",
        safe: "kept",
      },
    });

    expect(payload).toEqual({
      message: "failed for [redacted-email] with [redacted-secret]",
      apiKey: "[redacted-secret]",
      nested: {
        token: "[redacted-secret]",
        safe: "kept",
      },
    });
  });
});
