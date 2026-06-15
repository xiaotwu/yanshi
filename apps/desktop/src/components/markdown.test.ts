import { describe, expect, it } from "vitest";

import { safeUrl } from "./markdown";

describe("safeUrl (Markdown link scheme allowlist)", () => {
  it("allows http(s), mailto, relative, and anchor links", () => {
    expect(safeUrl("https://example.com")).toBe("https://example.com");
    expect(safeUrl("http://example.com/x")).toBe("http://example.com/x");
    expect(safeUrl("mailto:a@b.com")).toBe("mailto:a@b.com");
    expect(safeUrl("/library")).toBe("/library");
    expect(safeUrl("#section")).toBe("#section");
  });

  it("rejects script-capable / unsupported schemes (XSS guard)", () => {
    expect(safeUrl("javascript:alert(1)")).toBeNull();
    expect(safeUrl("  JavaScript:alert(1)")).toBeNull();
    expect(safeUrl("data:text/html,<script>alert(1)</script>")).toBeNull();
    expect(safeUrl("vbscript:msgbox(1)")).toBeNull();
    expect(safeUrl("file:///etc/passwd")).toBeNull();
  });
});
