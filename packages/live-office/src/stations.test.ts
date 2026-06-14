import { describe, expect, it } from "vitest";

import {
  buildStationAssignments,
  DEFAULT_STATIONS,
  HOME_CLEARANCE,
  HOME_STATIONS,
  movementReasonFor,
  resolveWorkerTarget,
} from "./stations";

const distance = (a: [number, number], b: [number, number]) => Math.hypot(a[0] - b[0], a[1] - b[1]);

describe("station assignments", () => {
  it("gives every role its own home station exactly once", () => {
    const workers = HOME_STATIONS.map((role, i) => ({ id: `w${i}`, role }));
    const assignments = buildStationAssignments(workers);
    const stations = assignments.map((a) => a.stationId);
    expect(new Set(stations).size).toBe(stations.length);
    for (const a of assignments) expect(a.stationId).toBe(a.agentRole);
  });

  it("never assigns a duplicate or unknown role to someone else's home station", () => {
    const assignments = buildStationAssignments([
      { id: "a", role: "manager" },
      { id: "b", role: "manager" },
      { id: "c", role: "mystery" },
    ]);
    expect(assignments[0].stationId).toBe("manager");
    expect(assignments[1].stationId).toBe("meeting");
    expect(assignments[2].stationId).toBe("meeting");
  });
});

describe("movement gating", () => {
  it("pins workers home for every task state", () => {
    for (const status of ["working", "waiting_approval", "blocked", "failed", "done"]) {
      expect(movementReasonFor(status, "coffee_break")).toBe("none");
    }
  });

  it("maps life actions to movement reasons; in-place actions stay home", () => {
    expect(movementReasonFor("idle", "coffee_break")).toBe("break_room");
    expect(movementReasonFor("idle", "nap")).toBe("rest");
    expect(movementReasonFor("idle", "chatting_with_neighbor")).toBe("shared_table");
    expect(movementReasonFor("idle", "walking_around")).toBe("wander");
    expect(movementReasonFor("idle", "stretching")).toBe("none");
    expect(movementReasonFor("idle", "playing_phone")).toBe("none");
    expect(movementReasonFor("idle", null)).toBe("none");
  });
});

describe("resolveWorkerTarget occupancy guard", () => {
  it("'none' and 'return_home' resolve to the worker's own home station", () => {
    for (const reason of ["none", "return_home"] as const) {
      expect(resolveWorkerTarget({ workerId: "w1", homeStation: "browser", reason })).toEqual(DEFAULT_STATIONS.browser);
    }
  });

  it("respects project layout overrides for the home station", () => {
    const layout = { browser: [5, 5] };
    expect(resolveWorkerTarget({ workerId: "w1", homeStation: "browser", reason: "none", layout })).toEqual([5, 5]);
  });

  it("gives different workers non-overlapping slots in the same shared area", () => {
    const a = resolveWorkerTarget({ workerId: "agent_browser", homeStation: "browser", reason: "break_room" });
    const b = resolveWorkerTarget({ workerId: "agent_file", homeStation: "file", reason: "break_room" });
    expect(distance(a, b)).toBeGreaterThan(0.1);
    // Both stay near the coffee area, not at anyone's home station.
    expect(distance(a, DEFAULT_STATIONS.coffee)).toBeLessThan(0.5);
    expect(distance(b, DEFAULT_STATIONS.coffee)).toBeLessThan(0.5);
  });

  it("rejects a shared-area target that would intrude into another worker's home station", () => {
    // Custom layout placing the meeting table directly on the reviewer's home station.
    const layout = { meeting: DEFAULT_STATIONS.reviewer as unknown as number[] };
    const target = resolveWorkerTarget({ workerId: "agent_browser", homeStation: "browser", reason: "shared_table", layout });
    expect(target).toEqual(DEFAULT_STATIONS.browser); // stayed home instead of stealing the station
  });

  it("clamps wander loops away from foreign home stations", () => {
    // Put the computer's home right next to the browser's so the wander circle would cross it.
    const layout = { computer: [DEFAULT_STATIONS.browser[0] + 0.5, DEFAULT_STATIONS.browser[1]] };
    for (let time = 0; time < 16; time += 0.5) {
      const point = resolveWorkerTarget({ workerId: "agent_browser", homeStation: "browser", reason: "wander", layout, time });
      const intrudes = distance(point, layout.computer as [number, number]) < HOME_CLEARANCE;
      expect(intrudes).toBe(false);
    }
  });

  it("never lands any movement target inside someone else's default home station", () => {
    for (const home of HOME_STATIONS) {
      for (const reason of ["break_room", "rest", "shared_table"] as const) {
        const point = resolveWorkerTarget({ workerId: `agent_${home}`, homeStation: home, reason });
        for (const other of HOME_STATIONS) {
          if (other === home) continue;
          expect(distance(point, DEFAULT_STATIONS[other])).toBeGreaterThanOrEqual(HOME_CLEARANCE);
        }
      }
    }
  });
});
