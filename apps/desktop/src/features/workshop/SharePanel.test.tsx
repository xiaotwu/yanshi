// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

// Stub i18n so t() returns the key as a plain string.
vi.mock("../../i18n", () => ({
  useT: () => ({ t: (key: string) => key }),
}));

// Stub the workshop module so WorkshopInstalled and WorkshopExport render
// lightweight stand-ins that still surface the expected translation keys.
vi.mock("../workshop", () => ({
  WorkshopInstalled: () => (
    <div>
      <span>workshop.importPack</span>
    </div>
  ),
  WorkshopExport: () => (
    <div>
      <button>workshop.exportPack</button>
    </div>
  ),
}));

import { SharePanel } from "./SharePanel";

describe("SharePanel", () => {
  afterEach(() => cleanup());

  it("renders an import control (workshop.importPack)", () => {
    render(<SharePanel />);
    expect(screen.getByText("workshop.importPack")).toBeInTheDocument();
  });

  it("renders an export control (workshop.exportPack)", () => {
    render(<SharePanel />);
    expect(screen.getByText("workshop.exportPack")).toBeInTheDocument();
  });

  it("does not render any enable/disable toggle (no switch role)", () => {
    render(<SharePanel />);
    expect(screen.queryByRole("switch")).toBeNull();
  });
});
