// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { MASCOT_ROLES, MascotSkin, mascotRoleFromStation } from "./skins";

describe("MascotSkin", () => {
  afterEach(() => cleanup());

  it("defines the six signed-off Workshop role skins", () => {
    expect(MASCOT_ROLES).toEqual(["manager", "browser", "computer", "file", "reviewer", "terminal"]);
  });

  it("renders every role through the shared mascot rig with role-specific props", () => {
    for (const role of MASCOT_ROLES) {
      const { container, unmount } = render(
        <MascotSkin role={role} accessibleName={`${role} mascot`} expression="focused" statusText="Working" />,
      );
      const mascot = screen.getByRole("img", { name: `${role} mascot` });

      expect(mascot).toHaveClass("yanshi-mascot");
      expect(mascot).toHaveClass(`yanshi-mascot--role-${role}`);
      expect(mascot).toHaveAttribute("data-mascot-role", role);
      expect(screen.getByTestId("mascot-layer-dragon-horns")).toBeInTheDocument();
      expect(screen.getByTestId(`mascot-role-prop-${role}`)).toBeInTheDocument();
      expect(container.querySelector("svg")?.outerHTML).not.toMatch(/\b(?:fill|stroke)="#[0-9a-fA-F]{3,8}"/);
      unmount();
    }
  });

  it("falls back unknown stations to manager without inventing a new skin", () => {
    expect(mascotRoleFromStation("browser")).toBe("browser");
    expect(mascotRoleFromStation("")).toBe("manager");
    expect(mascotRoleFromStation("custom-agent")).toBe("manager");
    expect(mascotRoleFromStation(null)).toBe("manager");
  });
});
