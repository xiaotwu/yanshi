import { describe, expect, it } from "vitest";

import { agentLabel, outputFileName, projectColor, projectIcon } from "./shared";

describe("project helpers", () => {
  it("returns the stored emoji icon or a folder default", () => {
    expect(projectIcon({ settings: { icon: "🧪" } })).toBe("🧪");
    expect(projectIcon({ settings: {} })).toBe("📁");
    expect(projectIcon({})).toBe("📁");
  });

  it("returns the stored color or the accent token", () => {
    expect(projectColor({ settings: { color: "#5f7f9a" } })).toBe("#5f7f9a");
    expect(projectColor({ settings: {} })).toBe("var(--accent)");
  });
});

describe("agentLabel", () => {
  it("maps known agent ids to readable names and falls back to the brand", () => {
    expect(agentLabel("agent_manager")).toBe("Manager");
    expect(agentLabel("agent_browser")).toBe("Browser");
    expect(agentLabel("agent_unknown")).toBe("Yanshi");
  });
});

describe("outputFileName (right panel / Library file labels)", () => {
  it("uses the basename of the path as the primary label", () => {
    expect(outputFileName("/x/y/report.md", "File scan")).toBe("report.md");
    expect(outputFileName("/workspace/latest-file-scan.json", "File scan")).toBe("latest-file-scan.json");
    expect(outputFileName("relative/dir/brief.md", null)).toBe("brief.md");
  });

  it("falls back to the artifact title only when no path exists", () => {
    expect(outputFileName(null, "File scan")).toBe("File scan");
    expect(outputFileName("", "Docker terminal log")).toBe("Docker terminal log");
  });

  it("never invents metadata", () => {
    expect(outputFileName(null, null)).toBe("");
    expect(outputFileName(undefined, "  ")).toBe("");
  });
});
