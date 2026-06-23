import { describe, expect, it } from "vitest";

import { crashReporterStatus, scrubCrashPayload } from "./crash-reporter";

describe("crash reporter", () => {
  it("is disabled until a crash-report DSN is configured", () => {
    expect(crashReporterStatus()).toBe("not_configured");
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
