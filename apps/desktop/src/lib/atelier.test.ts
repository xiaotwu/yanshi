import { describe, expect, it } from "vitest";
import { OFFICE_SVG, STATION_DEFAULTS, svgPointToWorld, worldToSvg } from "./atelier";

describe("atelier math", () => {
  it("worldToSvg maps world origin into the SVG box", () => {
    const [x, y] = worldToSvg(0, 0);
    expect(x).toBeGreaterThan(0);
    expect(x).toBeLessThan(OFFICE_SVG.w);
    expect(y).toBeGreaterThan(0);
    expect(y).toBeLessThan(OFFICE_SVG.h);
  });

  it("svgPointToWorld snaps to a 0.2 grid when snap=true", () => {
    const [x, z] = svgPointToWorld(OFFICE_SVG.w / 2, OFFICE_SVG.h / 2, true);
    expect(Math.round((x / 0.2) % 1)).toBe(0);
    expect(Math.round((z / 0.2) % 1)).toBe(0);
  });

  it("svgPointToWorld clamps inside the world bounds", () => {
    const [x, z] = svgPointToWorld(99999, 99999, false);
    expect(x).toBeLessThanOrEqual(3.2); // maxX(3.5) - 0.3 margin
    expect(z).toBeLessThanOrEqual(2.2); // maxZ(2.5) - 0.3 margin
  });

  it("every default station has a coordinate", () => {
    for (const station of ["manager", "browser", "computer", "file", "reviewer", "terminal"]) {
      expect(STATION_DEFAULTS[station]).toHaveLength(2);
    }
  });
});
