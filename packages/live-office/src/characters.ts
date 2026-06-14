// Asset-ready character architecture for the Yanshi Atelier.
//
// Today every worker is rendered with the procedural "Q-style" mechanical fallback (see index.tsx).
// This registry exists so higher-quality GLB/GLTF character assets — produced later by 3D tooling or
// shipped via a Workshop motion/appearance pack — can be dropped in WITHOUT touching the scene code:
// resolve a role to a CharacterAsset, and the renderer picks the GLB when present, else the fallback.
//
// Nothing here fakes a loaded asset: `glb` is null until a real file path is registered.

export type AtelierRole = "manager" | "browser" | "computer" | "file" | "reviewer" | "terminal";

/** Worker activity states the renderer can animate. Real task states come from the runtime; idle/life
 *  states are derived from fatigue + behavior mode and are decorative (never fake task progress). */
export type AnimationState =
  | "idle"
  | "typing"
  | "thinking"
  | "browsing"
  | "reading"
  | "terminal"
  | "reviewing"
  | "organizing"
  | "creating"
  | "waiting_approval"
  | "celebrating"
  | "blocked"
  | "failed"
  // decorative life animations (idle/fatigue driven)
  | "coffee"
  | "stretch"
  | "nap"
  | "snack"
  | "walk"
  | "phone";

export type AccessoryKind = "headset" | "globe" | "monitor" | "folder" | "clipboard" | "terminal" | "none";

export interface CharacterAsset {
  role: AtelierRole;
  /** Procedural accent + accessory used by the fallback worker. */
  accent: string;
  accessory: AccessoryKind;
  /** Future GLB/GLTF asset path (registered by an appearance pack). null → use procedural fallback. */
  glb: string | null;
}

/** Role → procedural accessory. The fallback worker reads this to add a role prop. */
export const roleAccessoryMap: Record<AtelierRole, AccessoryKind> = {
  manager: "clipboard",
  browser: "globe",
  computer: "monitor",
  file: "folder",
  reviewer: "headset",
  terminal: "terminal",
};

/** Maps a runtime/live status to an animation state the renderer understands. */
export const animationMap: Record<string, AnimationState> = {
  working: "typing",
  thinking: "thinking",
  reviewing: "reviewing",
  waiting_approval: "waiting_approval",
  blocked: "blocked",
  failed: "failed",
  done: "celebrating",
  idle: "idle",
};

/** Decorative life actions (driven by idle + fatigue + behavior mode), kept separate from task state. */
export const lifeAnimationMap: Record<string, AnimationState> = {
  coffee: "coffee",
  stretch: "stretch",
  nap: "nap",
  snack: "snack",
  walk: "walk",
  phone: "phone",
};

const DEFAULT_ACCENTS: Record<AtelierRole, string> = {
  manager: "#2fc279",
  browser: "#5f7f9a",
  computer: "#b08a5e",
  file: "#4f9a5b",
  reviewer: "#9a6f4c",
  terminal: "#6a6f86",
};

/** The character registry. GLB paths are null until an appearance pack registers real assets. */
export const characterRegistry: Record<AtelierRole, CharacterAsset> = Object.fromEntries(
  (Object.keys(roleAccessoryMap) as AtelierRole[]).map((role) => [
    role,
    { role, accent: DEFAULT_ACCENTS[role], accessory: roleAccessoryMap[role], glb: null } as CharacterAsset,
  ]),
) as Record<AtelierRole, CharacterAsset>;

export function resolveCharacter(role: string): CharacterAsset {
  return characterRegistry[(role as AtelierRole)] ?? { role: "manager", accent: DEFAULT_ACCENTS.manager, accessory: "none", glb: null };
}

/** True when no GLB asset is registered for the role → the procedural fallback worker is used. */
export function usesFallbackProceduralWorker(role: string): boolean {
  return resolveCharacter(role).glb === null;
}

/** Registration hook for a future Workshop appearance pack. Honest: only sets a path; loading is the
 *  renderer's job and is a no-op until GLB support lands. */
export function registerCharacterAsset(role: AtelierRole, glbPath: string): void {
  if (characterRegistry[role]) characterRegistry[role].glb = glbPath;
}

// ---------------------------------------------------------------------------------------------
// Worker character design system (docs/YANSHI_ATELIER_WORKER_DESIGN.md).
//
// Six chibi role designs in three posture families establish the visual language of the
// 偃师/Yanshi workers: cute, compact desk-workers with one crisp identifying silhouette element
// per role. This is an honest intermediate stage — the figures are procedural three.js
// primitives driven by these design tokens; modelled/animated assets remain future work and
// nothing here pretends otherwise (see workerCharacterRegistry / usesFallbackProceduralWorker).

export type WorkerArchetype = "coordinator" | "scout" | "maker";

export const roleArchetypeMap: Record<AtelierRole, WorkerArchetype> = {
  manager: "coordinator",
  reviewer: "coordinator",
  browser: "scout",
  computer: "scout",
  file: "maker",
  terminal: "maker",
};

export type WorkerHeadwear = "antenna" | "visor" | "cap" | "headset" | "beanie" | "monocle";

export interface WorkerRoleDesign {
  role: AtelierRole;
  archetype: WorkerArchetype;
  displayName: string;
  /** Soft suit color for the round body. */
  body: string;
  /** Trim used for the headwear and feet. */
  trim: string;
  /** Eye color. */
  visor: string;
  /** Chibi head radius multiplier — the head dominates the silhouette. */
  headScale: number;
  /** Squat body height multiplier. */
  bodyScale: number;
  /** Resting posture: upright (leader), lean (explorer), hunch (builder). */
  posture: "upright" | "lean" | "hunch";
  /** Distinct headwear silhouette — the role's primary identification cue. */
  headwear: WorkerHeadwear;
}

/** Six distinct role designs (spec §2.4): one silhouette cue + palette per runtime agent. */
export const ROLE_DESIGNS: Record<AtelierRole, WorkerRoleDesign> = {
  manager: { role: "manager", archetype: "coordinator", displayName: "Manager", body: "#e9b85c", trim: "#8a5a2b", visor: "#2e3138", headScale: 1.18, bodyScale: 1.0, posture: "upright", headwear: "antenna" },
  reviewer: { role: "reviewer", archetype: "coordinator", displayName: "Reviewer", body: "#c08a52", trim: "#7a5230", visor: "#2e3138", headScale: 1.1, bodyScale: 0.96, posture: "upright", headwear: "monocle" },
  browser: { role: "browser", archetype: "scout", displayName: "Browser", body: "#6fa8dc", trim: "#33567e", visor: "#22272e", headScale: 1.08, bodyScale: 0.92, posture: "lean", headwear: "visor" },
  computer: { role: "computer", archetype: "scout", displayName: "Computer", body: "#8d86c9", trim: "#4f4a82", visor: "#22272e", headScale: 1.08, bodyScale: 0.92, posture: "lean", headwear: "headset" },
  file: { role: "file", archetype: "maker", displayName: "File", body: "#8fbf9f", trim: "#4a7a5a", visor: "#2e3138", headScale: 1.0, bodyScale: 0.88, posture: "hunch", headwear: "cap" },
  terminal: { role: "terminal", archetype: "maker", displayName: "Terminal", body: "#5f8f82", trim: "#39564e", visor: "#2e3138", headScale: 1.0, bodyScale: 0.88, posture: "hunch", headwear: "beanie" },
};

export function roleDesignFor(role: string): WorkerRoleDesign {
  return ROLE_DESIGNS[role as AtelierRole] ?? ROLE_DESIGNS.file;
}

// --- WorkerCharacterAsset registry (spec §2.7) -------------------------------------------------
//
// Future-ready asset registry. Since the Yanshi Puppet redesign the workers are real generated
// SVG art (worker-art.ts — embedded, no external files, `path: null` because nothing loads from
// disk). Richer formats (sprite sheets / Lottie / GLB) can still be registered per state later
// (e.g. via a Workshop appearance pack) and a loader can prefer them. Nothing here fakes an
// asset that does not exist.

export type WorkerState = AnimationState;

export interface WorkerStateAsset {
  source: "procedural" | "svg" | "sprite" | "lottie" | "gltf";
  path: string | null;
}

export interface WorkerCharacterAsset {
  id: string;
  role: AtelierRole;
  displayName: string;
  assetType: "procedural" | "svg" | "sprite" | "lottie" | "gltf";
  states: Record<WorkerState, WorkerStateAsset>;
  props: string[];
  accentColor: string;
  supportsReducedMotion: boolean;
}

const ALL_WORKER_STATES: WorkerState[] = [
  "idle", "typing", "thinking", "browsing", "reading", "terminal", "reviewing", "organizing",
  "creating", "waiting_approval", "celebrating", "blocked", "failed",
  "coffee", "stretch", "nap", "snack", "walk", "phone",
];

const ROLE_PROPS: Record<AtelierRole, string[]> = {
  manager: ["planning-board", "antenna-bulb"],
  reviewer: ["stamp", "checklist", "monocle"],
  browser: ["globe", "visor-band"],
  computer: ["mini-monitor", "headset"],
  file: ["folder-stack", "work-cap"],
  terminal: ["console-block", "beanie"],
};

function generatedSvgStates(): Record<WorkerState, WorkerStateAsset> {
  return Object.fromEntries(ALL_WORKER_STATES.map((state) => [state, { source: "svg", path: null }])) as Record<
    WorkerState,
    WorkerStateAsset
  >;
}

export const workerCharacterRegistry: Record<AtelierRole, WorkerCharacterAsset> = Object.fromEntries(
  (Object.keys(ROLE_DESIGNS) as AtelierRole[]).map((role) => [
    role,
    {
      id: `worker_${role}`,
      role,
      displayName: ROLE_DESIGNS[role].displayName,
      assetType: "svg",
      states: generatedSvgStates(),
      props: ROLE_PROPS[role],
      accentColor: DEFAULT_ACCENTS[role],
      supportsReducedMotion: true,
    } satisfies WorkerCharacterAsset,
  ]),
) as Record<AtelierRole, WorkerCharacterAsset>;
