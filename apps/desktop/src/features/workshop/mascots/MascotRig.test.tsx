// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { MASCOT_EXPRESSIONS, MascotRig } from "./MascotRig";

describe("MascotRig", () => {
  afterEach(() => cleanup());

  it("renders an accessible inline SVG image", () => {
    render(<MascotRig accessibleName="Aster the Yanshi" expression="neutral" statusText="Idle" />);

    const mascot = screen.getByRole("img", { name: "Aster the Yanshi" });
    expect(mascot.tagName.toLowerCase()).toBe("svg");
    expect(mascot).toHaveClass("yanshi-mascot");
    expect(screen.getByText("Idle")).toBeInTheDocument();
  });

  it("renders one expression layer for each signed-off expression", () => {
    expect(MASCOT_EXPRESSIONS).toEqual(["neutral", "happy", "thinking", "focused", "surprised", "error", "sleeping"]);

    for (const expression of MASCOT_EXPRESSIONS) {
      const { unmount } = render(
        <MascotRig accessibleName={`${expression} mascot`} expression={expression} statusText={expression} />,
      );
      expect(screen.getByTestId(`mascot-expression-${expression}`)).toBeInTheDocument();
      expect(screen.getByRole("img", { name: `${expression} mascot` })).toHaveClass(`yanshi-mascot--expr-${expression}`);
      unmount();
    }
  });

  it("uses CSS variables instead of hard-coded SVG hex colors", () => {
    const { container } = render(<MascotRig accessibleName="Token mascot" expression="focused" statusText="Working" />);

    const svg = container.querySelector("svg");
    expect(svg).not.toBeNull();
    expect(svg?.outerHTML).not.toMatch(/\b(?:fill|stroke)="#[0-9a-fA-F]{3,8}"/);
    expect(svg?.outerHTML).toContain("var(--ym-face)");
    expect(svg?.outerHTML).toContain("var(--ym-accent)");
  });

  it("renders the selected paper-lantern dragon apprentice skin", () => {
    render(<MascotRig accessibleName="Lantern apprentice" expression="neutral" statusText="Idle" />);

    expect(screen.getByTestId("mascot-layer-dragon-horns")).toBeInTheDocument();
    expect(screen.getByTestId("mascot-layer-apron-tab")).toBeInTheDocument();
    expect(screen.getByTestId("mascot-layer-talisman-seal")).toBeInTheDocument();
    expect(screen.queryByTestId("mascot-layer-seal-fins")).not.toBeInTheDocument();
  });

  it("exposes reduced-motion-safe static hooks", () => {
    render(<MascotRig accessibleName="Still mascot" expression="sleeping" statusText="Offline" reducedMotion />);

    const mascot = screen.getByRole("img", { name: "Still mascot" });
    expect(mascot).toHaveClass("yanshi-mascot--reduced-motion");
    expect(mascot).not.toHaveClass("yanshi-mascot--animated");
    expect(screen.getByTestId("mascot-state-accents")).toHaveAttribute("data-reduced-motion", "true");
  });
});
