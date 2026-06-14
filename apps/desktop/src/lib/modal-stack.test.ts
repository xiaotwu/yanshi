import { describe, expect, it } from "vitest";

import { isTopModal, openModalCount, pushModal, releaseModal } from "./modal-stack";

describe("modal stack (nested-dialog ESC layering)", () => {
  it("only the most recently opened modal is top", () => {
    const settings = pushModal();
    expect(isTopModal(settings)).toBe(true);

    const providerConfig = pushModal();
    // One ESC: the provider config modal may close, Settings may not.
    expect(isTopModal(providerConfig)).toBe(true);
    expect(isTopModal(settings)).toBe(false);

    releaseModal(providerConfig);
    // Second ESC: Settings is top again and may close.
    expect(isTopModal(settings)).toBe(true);

    releaseModal(settings);
    expect(openModalCount()).toBe(0);
  });

  it("tolerates out-of-order release and double release", () => {
    const first = pushModal();
    const second = pushModal();
    releaseModal(first);
    expect(isTopModal(second)).toBe(true);
    releaseModal(second);
    releaseModal(second);
    expect(openModalCount()).toBe(0);
    expect(isTopModal(second)).toBe(false);
  });
});
