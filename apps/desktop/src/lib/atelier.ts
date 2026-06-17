export const OFFICE_WORLD = { minX: -3.5, maxX: 3.5, minZ: -2.5, maxZ: 2.5 };
export const OFFICE_SVG = { w: 700, h: 500 };
export const STATION_DEFAULTS: Record<string, [number, number]> = {
  manager: [-2.4, -0.6],
  browser: [-0.9, -1.3],
  computer: [0.9, -1.3],
  file: [2.4, -0.6],
  reviewer: [0, 1.0],
  terminal: [2.2, 1.2],
};
export const OFFICE_AREAS = [
  { id: "coffee", x: -2.7, z: 1.4, label: "Coffee" },
  { id: "rest", x: -2.8, z: -1.7, label: "Rest" },
  { id: "break", x: 2.8, z: -1.7, label: "Break" },
  { id: "meeting", x: 0, z: -0.1, label: "Meeting" },
  { id: "workshop", x: 2.7, z: 1.7, label: "Workshop" },
];
export const STATION_COLORS: Record<string, string> = {
  manager: "#1faa6a",
  browser: "#3f7fb0",
  computer: "#9a5b2d",
  file: "#5b8d55",
  reviewer: "#b65c2f",
  terminal: "#6a6f86",
};

export function worldToSvg(x: number, z: number): [number, number] {
  return [
    ((x - OFFICE_WORLD.minX) / (OFFICE_WORLD.maxX - OFFICE_WORLD.minX)) * OFFICE_SVG.w,
    ((z - OFFICE_WORLD.minZ) / (OFFICE_WORLD.maxZ - OFFICE_WORLD.minZ)) * OFFICE_SVG.h,
  ];
}

export const FURNITURE_COLORS: Record<string, string> = {
  desk: "#9a6f4c",
  plant: "#4f9a5b",
  shelf: "#8b939b",
  couch: "#5f7f9a",
  table: "#b08a5e",
  lamp: "#d7b24a",
};

export function svgPointToWorld(sx: number, sy: number, snap: boolean): [number, number] {
  let x = (sx / OFFICE_SVG.w) * (OFFICE_WORLD.maxX - OFFICE_WORLD.minX) + OFFICE_WORLD.minX;
  let z = (sy / OFFICE_SVG.h) * (OFFICE_WORLD.maxZ - OFFICE_WORLD.minZ) + OFFICE_WORLD.minZ;
  if (snap) {
    x = Math.round(x / 0.2) * 0.2;
    z = Math.round(z / 0.2) * 0.2;
  }
  x = Math.min(OFFICE_WORLD.maxX - 0.3, Math.max(OFFICE_WORLD.minX + 0.3, x));
  z = Math.min(OFFICE_WORLD.maxZ - 0.3, Math.max(OFFICE_WORLD.minZ + 0.3, z));
  return [Math.round(x * 100) / 100, Math.round(z * 100) / 100];
}
