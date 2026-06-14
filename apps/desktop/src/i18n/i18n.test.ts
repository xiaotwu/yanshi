import { describe, expect, it } from "vitest";

import { en } from "./en";
import { detectSystemLocale, resolveLocale, translate } from "./index";
import { zh } from "./zh";

describe("i18n", () => {
  it("zh-CN has a translation for every en-US key (no missing keys)", () => {
    const enKeys = Object.keys(en).sort();
    const zhKeys = Object.keys(zh).sort();
    expect(zhKeys).toEqual(enKeys);
  });

  it("has no empty translations", () => {
    for (const [key, value] of Object.entries(zh)) {
      expect(value, `zh-CN value for ${key}`).toBeTruthy();
    }
    for (const [key, value] of Object.entries(en)) {
      expect(value, `en-US value for ${key}`).toBeTruthy();
    }
  });

  it("resolveLocale honors explicit choices and falls back for system", () => {
    expect(resolveLocale("en-US")).toBe("en-US");
    expect(resolveLocale("zh-CN")).toBe("zh-CN");
    expect(["en-US", "zh-CN"]).toContain(resolveLocale("system"));
    expect(["en-US", "zh-CN"]).toContain(resolveLocale(undefined));
  });

  it("detectSystemLocale returns a supported locale", () => {
    expect(["en-US", "zh-CN"]).toContain(detectSystemLocale());
  });

  it("interpolates variables", () => {
    expect(translate("en-US", "atelier.active", { count: 3 })).toContain("3");
    expect(translate("zh-CN", "atelier.active", { count: 3 })).toContain("3");
  });
});
