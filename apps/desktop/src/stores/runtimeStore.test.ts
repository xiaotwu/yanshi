import { describe, expect, it } from "vitest";

import { wsBackoffDelay } from "./runtimeStore";

describe("wsBackoffDelay", () => {
  it("backs off exponentially and caps at 15s, never stopping", () => {
    expect(wsBackoffDelay(1)).toBe(1000);
    expect(wsBackoffDelay(2)).toBe(2000);
    expect(wsBackoffDelay(3)).toBe(4000);
    expect(wsBackoffDelay(5)).toBe(15000);
    expect(wsBackoffDelay(50)).toBe(15000);
  });
});
