// Station assignment + movement rules for the Atelier workers.
//
// Product rule (docs/YANSHI_ATELIER_WORKER_DESIGN.md): every worker has exactly one home
// station and normally stays there. Movement is behavior-gated (break room, rest, shared
// table, a wander loop around the worker's own desk) and always returns home. A home station
// may only ever be occupied by its owner — movement targets that would land inside another
// worker's home station are rejected (the worker stays home), and shared areas hand out
// deterministic per-worker slots so two workers never overlap on the same point.
//
// Pure module: no three.js, fully unit-testable. Project offices pass their own station
// layout overrides; standalone chats use the defaults.

export type StationId = string;

export interface WorkerStationAssignment {
  workerId: string;
  agentRole: string;
  stationId: StationId;
}

/** Only these reasons may take a worker away from its home station ("none" = stay home). */
export type WorkerMovementReason =
  | "none"
  | "break_room"
  | "rest"
  | "shared_table"
  | "wander"
  | "return_home";

/** Default office positions (x, z). Home stations + shared areas (spec §17). The six home
 *  stations form a balanced 2×3 grid across the floor (7×5 plane) so workers read as spread
 *  out rather than bunched in one corner; shared areas sit on the central band between rows. */
export const DEFAULT_STATIONS: Record<StationId, [number, number]> = {
  manager: [-2.6, -1.5],
  browser: [0, -1.5],
  computer: [2.6, -1.5],
  file: [-2.6, 1.5],
  reviewer: [0, 1.5],
  terminal: [2.6, 1.5],
  coffee: [-3.1, 0],
  rest: [-1.3, 0],
  meeting: [1.3, 0],
  break: [3.1, 0],
};

export const HOME_STATIONS: StationId[] = ["manager", "browser", "computer", "file", "reviewer", "terminal"];
export const SHARED_AREAS: StationId[] = ["coffee", "break", "rest", "meeting"];

/** Minimum distance a foreign worker must keep from someone else's home station. */
export const HOME_CLEARANCE = 0.45;

/** Derive the movement reason from real state. Task states pin the worker home — work happens
 *  at the worker's own desk; decorative life actions are the only reasons to leave. */
export function movementReasonFor(status: string, lifeAction: string | null | undefined): WorkerMovementReason {
  if (status === "working" || status === "waiting_approval" || status === "blocked" || status === "failed" || status === "done") {
    return "none";
  }
  switch (lifeAction) {
    case "coffee_break":
      return "break_room";
    case "nap":
      return "rest";
    case "chatting_with_neighbor":
      return "shared_table";
    case "walking_around":
      return "wander";
    // stretching / playing_phone happen in place at the worker's own station.
    default:
      return "none";
  }
}

export interface ResolveTargetOptions {
  workerId: string;
  homeStation: StationId;
  reason: WorkerMovementReason;
  /** Project office layout overrides (stationId → [x, z]); defaults fill the rest. */
  layout?: Record<string, number[]>;
  /** Clock time, used only by the wander loop. */
  time?: number;
}

function stationPosition(station: StationId, layout?: Record<string, number[]>): [number, number] {
  const override = layout?.[station] as [number, number] | undefined;
  return override ?? DEFAULT_STATIONS[station] ?? [0, 0];
}

/** Deterministic small slot offset inside a shared area so co-located workers never overlap.
 *  The home-station index is the slot key — homes are one-per-worker, so slots are collision-free
 *  for the core team; unknown stations fall back to a worker-id hash. */
function sharedSlotOffset(homeStation: StationId, workerId: string): [number, number] {
  let slot = HOME_STATIONS.indexOf(homeStation);
  if (slot < 0) {
    let hash = 0;
    for (let i = 0; i < workerId.length; i++) hash = (hash * 31 + workerId.charCodeAt(i)) | 0;
    slot = Math.abs(hash) % 6;
  }
  const angle = (slot / 6) * Math.PI * 2;
  const radius = 0.3;
  return [Math.cos(angle) * radius, Math.sin(angle) * radius];
}

function violatesForeignHome(point: [number, number], homeStation: StationId, layout?: Record<string, number[]>): boolean {
  for (const station of HOME_STATIONS) {
    if (station === homeStation) continue;
    const [hx, hz] = stationPosition(station, layout);
    const dx = point[0] - hx;
    const dz = point[1] - hz;
    if (Math.hypot(dx, dz) < HOME_CLEARANCE) return true;
  }
  return false;
}

const SHARED_AREA_FOR_REASON: Partial<Record<WorkerMovementReason, StationId>> = {
  break_room: "coffee",
  rest: "rest",
  shared_table: "meeting",
};

/**
 * Resolve where a worker should be right now. Guarantees:
 * - "none"/"return_home" → the worker's own home station, always allowed.
 * - shared-area reasons → the area position + a per-worker slot; if that point would intrude
 *   into another worker's home station (custom layouts), the worker stays home instead.
 * - "wander" → a slow loop around the worker's own desk, clamped away from foreign homes.
 */
export function resolveWorkerTarget(options: ResolveTargetOptions): [number, number] {
  const { workerId, homeStation, reason, layout, time = 0 } = options;
  const home = stationPosition(homeStation, layout);
  if (reason === "none" || reason === "return_home") return home;

  if (reason === "wander") {
    let hash = 0;
    for (let i = 0; i < workerId.length; i++) hash = (hash * 31 + workerId.charCodeAt(i)) | 0;
    const angle = time * 0.4 + (Math.abs(hash) % 7);
    const point: [number, number] = [home[0] + Math.cos(angle) * 0.5, home[1] + Math.sin(angle) * 0.5];
    return violatesForeignHome(point, homeStation, layout) ? home : point;
  }

  const area = SHARED_AREA_FOR_REASON[reason];
  if (!area) return home;
  const base = stationPosition(area, layout);
  const [ox, oz] = sharedSlotOffset(homeStation, workerId);
  const point: [number, number] = [base[0] + ox, base[1] + oz];
  return violatesForeignHome(point, homeStation, layout) ? home : point;
}

/** Build the canonical one-worker-per-home-station assignment list. */
export function buildStationAssignments(workers: Array<{ id: string; role: string }>): WorkerStationAssignment[] {
  const taken = new Set<StationId>();
  const assignments: WorkerStationAssignment[] = [];
  for (const worker of workers) {
    const station = HOME_STATIONS.includes(worker.role) && !taken.has(worker.role) ? worker.role : null;
    if (station) {
      taken.add(station);
      assignments.push({ workerId: worker.id, agentRole: worker.role, stationId: station });
    } else {
      // Overflow/unknown roles share the meeting area rather than stealing a home station.
      assignments.push({ workerId: worker.id, agentRole: worker.role, stationId: "meeting" });
    }
  }
  return assignments;
}
