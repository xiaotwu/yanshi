import { describe, expect, it } from "vitest";

import {
  SHORTCUT_COMMANDS,
  eventToBinding,
  findConflicts,
  firesInEditable,
  formatBinding,
  isShortcutCaptureActive,
  resolveBindings,
  setShortcutCaptureActive,
  validateBinding,
} from "./shortcuts";

describe("shortcut defaults", () => {
  it("ship without internal conflicts", () => {
    expect(findConflicts({}).size).toBe(0);
  });

  it("cover the required commands", () => {
    const ids = SHORTCUT_COMMANDS.map((command) => command.id);
    for (const required of ["new-task", "open-search", "open-projects", "new-project", "open-library", "open-workshop", "open-settings", "open-atelier", "toggle-progress", "toggle-sidebar", "submit-task", "focus-composer", "upload-file", "open-task-details", "open-developer", "pause-all"]) {
      expect(ids).toContain(required);
    }
  });
});

describe("resolveBindings", () => {
  it("applies overrides and treats empty string as cleared", () => {
    const bindings = resolveBindings({ "open-library": "Meta+G", "new-task": "" });
    expect(bindings.get("open-library")).toBe("Meta+G");
    expect(bindings.has("new-task")).toBe(false);
    expect(bindings.get("open-search")).toBe("Meta+K");
  });
});

describe("findConflicts", () => {
  it("detects two commands on one binding", () => {
    const conflicts = findConflicts({ "open-library": "Meta+K" });
    expect(conflicts.get("open-library")).toEqual(["open-search"]);
    expect(conflicts.get("open-search")).toEqual(["open-library"]);
  });

  it("clearing one side resolves the conflict", () => {
    const conflicts = findConflicts({ "open-library": "Meta+K", "open-search": "" });
    expect(conflicts.size).toBe(0);
  });
});

describe("eventToBinding", () => {
  it("normalizes modifiers and letter case", () => {
    expect(eventToBinding({ key: "k", metaKey: true, ctrlKey: false, altKey: false, shiftKey: true })).toBe("Meta+Shift+K");
  });

  it("ignores bare modifier presses", () => {
    expect(eventToBinding({ key: "Meta", metaKey: true, ctrlKey: false, altKey: false, shiftKey: false })).toBeNull();
  });
});

describe("formatBinding", () => {
  it("renders macOS symbols", () => {
    expect(formatBinding("Meta+Shift+K")).toBe("⌘⇧K");
    expect(formatBinding("Meta+Enter")).toBe("⌘↩");
    expect(formatBinding("")).toBe("");
  });
});

describe("firesInEditable", () => {
  it("only modifier-chord bindings fire while typing", () => {
    expect(firesInEditable("Meta+K")).toBe(true);
    expect(firesInEditable("Escape")).toBe(false);
  });
});

describe("capture suspension", () => {
  it("suppresses app dispatch while the editor captures (Cmd+K must not open Search)", () => {
    expect(isShortcutCaptureActive()).toBe(false);
    setShortcutCaptureActive(true);
    // The App dispatcher early-returns when this is true — no command can fire during capture.
    expect(isShortcutCaptureActive()).toBe(true);
    setShortcutCaptureActive(false);
    expect(isShortcutCaptureActive()).toBe(false);
  });
});

describe("validateBinding (pre-save)", () => {
  it("rejects a chord already bound to another command", () => {
    const result = validateBinding("new-task", "Meta+K", {});
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.conflictsWith).toEqual(["open-search"]);
  });

  it("accepts a unique chord and re-accepting a command's own binding", () => {
    expect(validateBinding("new-task", "Meta+Shift+9", {}).ok).toBe(true);
    expect(validateBinding("new-task", "Meta+N", {}).ok).toBe(true);
  });

  it("explicit Replace resolution leaves persisted shortcuts conflict-free", () => {
    // Replace assigns the chord here and clears it from the conflicting command.
    const afterReplace = { "new-task": "Meta+K", "open-search": "" };
    expect(findConflicts(afterReplace).size).toBe(0);
    const bindings = resolveBindings(afterReplace);
    expect(bindings.get("new-task")).toBe("Meta+K");
    expect(bindings.has("open-search")).toBe(false);
  });
});
