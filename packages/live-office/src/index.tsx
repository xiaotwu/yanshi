import { Html, OrbitControls } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import type { CameraMode, FurnitureItem, LifeAction, LiveAgentState } from "@yanshi/shared";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Group, MathUtils, SRGBColorSpace, TextureLoader } from "three";
import type { SpriteMaterial, Texture } from "three";

import { DEFAULT_STATIONS, movementReasonFor, resolveWorkerTarget } from "./stations";
import { puppetDataUrl, puppetExpression } from "./worker-art";
import type { PuppetExpression } from "./worker-art";

// Sprite textures rasterized from the generated puppet SVGs — cached per (role, expression).
const puppetTextures = new Map<string, Texture>();
function usePuppetTexture(role: string, expr: PuppetExpression): Texture {
  return useMemo(() => {
    const key = `${role}:${expr}`;
    let texture = puppetTextures.get(key);
    if (!texture) {
      texture = new TextureLoader().load(puppetDataUrl(role, expr));
      texture.colorSpace = SRGBColorSpace;
      puppetTextures.set(key, texture);
    }
    return texture;
  }, [role, expr]);
}

/**
 * Deterministically free the WebGL context when the scene unmounts. WKWebView (the Tauri webview)
 * caps live contexts and only reclaims them on GC — without this, repeatedly opening/closing the
 * Atelier exhausted the cap and the window could not be reopened until a force quit.
 */
function FreeContextOnUnmount() {
  const gl = useThree((state) => state.gl);
  useEffect(
    () => () => {
      // Defer past React Three Fiber's own teardown, then force the loss so the slot frees now.
      // (R3F v9 usually loses the context itself — this is the guarantee for when it doesn't.)
      window.setTimeout(() => {
        try {
          const context = gl.getContext() as WebGLRenderingContext | null;
          if (context && !context.isContextLost()) gl.forceContextLoss();
        } catch {
          // Best-effort; an already-lost context is exactly the state we want.
        }
      }, 0);
    },
    [gl],
  );
  return null;
}

export interface LiveOfficeSceneProps {
  agents: LiveAgentState[];
  compact?: boolean;
  cameraMode?: CameraMode;
  stationLayout?: Record<string, number[]>;
  furniture?: FurnitureItem[];
  dark?: boolean;
  /** Reduced render quality (lower DPR, no shadows) when GPU acceleration is disabled in settings. */
  lowPower?: boolean;
  /** Localized hover-card text, keyed `state.<status>` / `life.<action>` / `queue`. English defaults apply. */
  labels?: Record<string, string>;
  /** Developer Mode: floating name+state debug labels over each worker (normal mode is tooltip-only). */
  debugLabels?: boolean;
}

function FurnitureMesh({ item }: { item: FurnitureItem }) {
  const color = { desk: "#9a6f4c", plant: "#4f9a5b", shelf: "#8b939b", couch: "#5f7f9a", table: "#b08a5e", lamp: "#d7b24a" }[item.type] ?? "#8b939b";
  if (item.type === "plant" || item.type === "lamp") {
    return (
      <group position={[item.x, 0, item.z]}>
        <mesh position={[0, item.type === "lamp" ? 0.34 : 0.18, 0]} castShadow>
          {item.type === "lamp" ? <coneGeometry args={[0.12, 0.18, 12]} /> : <sphereGeometry args={[0.16, 12, 12]} />}
          <meshStandardMaterial color={color} emissive={item.type === "lamp" ? color : "#000"} emissiveIntensity={item.type === "lamp" ? 0.4 : 0} roughness={0.7} />
        </mesh>
        <mesh position={[0, 0.06, 0]}>
          <cylinderGeometry args={[0.04, 0.05, 0.12, 8]} />
          <meshStandardMaterial color="#6a6f86" />
        </mesh>
      </group>
    );
  }
  const height = item.type === "shelf" ? 0.5 : 0.18;
  return (
    <mesh position={[item.x, height / 2, item.z]} castShadow>
      <boxGeometry args={[0.4, height, 0.3]} />
      <meshStandardMaterial color={color} roughness={0.75} metalness={0.1} />
    </mesh>
  );
}

const ACTIVE_GLOW = "#2fc279";

// Office areas come from the station module (home stations + shared areas + occupancy guard).
const STATIONS = DEFAULT_STATIONS;

const STATUS_TEXT: Record<LiveAgentState["status"], string> = {
  idle: "Idle",
  working: "Working",
  waiting_approval: "Waiting approval",
  blocked: "Blocked",
  failed: "Failed",
  done: "Done",
};

const LIFE_TEXT: Record<LifeAction, string> = {
  coffee_break: "Coffee",
  stretching: "Stretching",
  nap: "Resting",
  walking_around: "Walking",
  playing_phone: "On phone",
  chatting_with_neighbor: "Chatting",
};

/** Worker position rule (stations.ts): home station unless a behavior-gated movement reason
 *  applies, with the occupancy guard ensuring nobody lands in another worker's home station
 *  and shared areas hand out non-overlapping per-worker slots. */
function targetPosition(agent: LiveAgentState, stationLayout: Record<string, number[]>, time: number): [number, number] {
  return resolveWorkerTarget({
    workerId: agent.id,
    homeStation: agent.station,
    reason: movementReasonFor(agent.status, agent.lifeAction),
    layout: stationLayout,
    time,
  });
}

// Small role props that sit on each worker's desk to make agents recognizable.
const ROLE_PROP: Record<string, { color: string; shape: "screen" | "globe" | "box" | "clip" | "cube" | "antenna" }> = {
  // The coordinator figure wears its antenna now; the desk prop is a clipboard.
  manager: { color: "#cfa94e", shape: "clip" },
  browser: { color: "#3f7fb0", shape: "globe" },
  computer: { color: "#9a5b2d", shape: "screen" },
  file: { color: "#5b8d55", shape: "box" },
  reviewer: { color: "#b65c2f", shape: "clip" },
  terminal: { color: "#6a6f86", shape: "cube" },
};

function RoleProp({ role }: { role: string }) {
  const prop = ROLE_PROP[role] ?? ROLE_PROP.file;
  if (prop.shape === "antenna") {
    return (
      <group position={[0, 0.96, 0]}>
        <mesh>
          <cylinderGeometry args={[0.012, 0.012, 0.14, 8]} />
          <meshStandardMaterial color="#9aa3ad" metalness={0.6} roughness={0.4} />
        </mesh>
        <mesh position={[0, 0.09, 0]}>
          <sphereGeometry args={[0.035, 12, 12]} />
          <meshStandardMaterial color={prop.color} emissive={prop.color} emissiveIntensity={0.4} />
        </mesh>
      </group>
    );
  }
  const geometry =
    prop.shape === "globe" ? (
      <sphereGeometry args={[0.1, 16, 16]} />
    ) : prop.shape === "screen" ? (
      <boxGeometry args={[0.18, 0.12, 0.02]} />
    ) : prop.shape === "cube" ? (
      <boxGeometry args={[0.12, 0.12, 0.12]} />
    ) : prop.shape === "clip" ? (
      <boxGeometry args={[0.12, 0.16, 0.02]} />
    ) : (
      <boxGeometry args={[0.16, 0.1, 0.12]} />
    );
  return (
    <mesh position={[0.32, 0.16, 0.18]} castShadow>
      {geometry}
      <meshStandardMaterial color={prop.color} roughness={0.6} metalness={0.2} />
    </mesh>
  );
}

function AgentActor({
  agent,
  stationLayout,
  labels,
  debugLabels,
  reduceMotion,
}: {
  agent: LiveAgentState;
  stationLayout: Record<string, number[]>;
  labels?: Record<string, string>;
  debugLabels?: boolean;
  reduceMotion: boolean;
}) {
  const groupRef = useRef<Group>(null);
  const bodyRef = useRef<Group>(null);
  const [hovered, setHovered] = useState(false);
  const spriteMatRef = useRef<SpriteMaterial>(null);
  const expr = puppetExpression(agent.status, agent.lifeAction);
  const texture = usePuppetTexture(agent.station, expr);

  const statusColor = useMemo(() => {
    if (agent.status === "waiting_approval") return "#d08a3a";
    if (agent.status === "blocked" || agent.status === "failed") return "#d2655f";
    if (agent.status === "working") return ACTIVE_GLOW;
    if (agent.status === "done") return "#5fbf86";
    return "#94a0a8";
  }, [agent.status]);

  // Hover-card text comes through `labels` (localized by the host app); English fallback.
  const text = (key: string, fallback: string) => labels?.[key] ?? fallback;
  const stateText =
    agent.lifeAction && agent.status !== "working"
      ? text(`life.${agent.lifeAction}`, LIFE_TEXT[agent.lifeAction])
      : text(`state.${agent.status}`, STATUS_TEXT[agent.status]);

  const blocked = agent.status === "blocked" || agent.status === "failed";
  const celebrating = agent.status === "done";

  useFrame((state, delta) => {
    const group = groupRef.current;
    const body = bodyRef.current;
    if (!group || !body) return;
    const t = state.clock.elapsedTime;
    const [tx, tz] = targetPosition(agent, stationLayout, t);
    // Reduced motion: snap to position and hold a static pose — state stays readable through
    // the expression art and the status ring without any continuous animation.
    if (reduceMotion) {
      group.position.x = tx;
      group.position.z = tz;
      if (spriteMatRef.current) spriteMatRef.current.rotation = 0;
      body.position.y = agent.lifeAction === "nap" ? -0.04 : 0.06;
      return;
    }
    group.position.x = MathUtils.lerp(group.position.x, tx, Math.min(1, delta * 2));
    group.position.z = MathUtils.lerp(group.position.z, tz, Math.min(1, delta * 2));

    const working = agent.status === "working";
    const livelinessByMode = agent.behaviorMode === "playful" ? 1.4 : agent.behaviorMode === "professional" ? 0.6 : 1;
    // Chibi motion on the standee: a small screen-plane tilt — typing shiver when working,
    // slow sway when idle, still when blocked/waiting.
    const wobble =
      blocked || agent.status === "waiting_approval"
        ? 0
        : working
          ? Math.sin(t * 7) * 0.035
          : Math.sin(t * 1.1 + agent.id.length) * 0.05 * livelinessByMode;
    if (spriteMatRef.current) spriteMatRef.current.rotation = wobble;

    // Height varies by state: typing bob when working, celebratory bounce on completion,
    // slow breathing when idle, low when napping, sagged when blocked.
    let bob = working ? 0.035 : 0.014 * livelinessByMode;
    let lift = 0.06;
    let freq = working ? 5 : 1.6;
    if (blocked) {
      bob = 0.004;
      lift = 0.0;
    } else if (celebrating) {
      bob = 0.07;
      freq = 4;
    } else if (agent.lifeAction === "nap") {
      bob = 0.005;
      lift = -0.04;
    } else if (agent.lifeAction === "stretching") {
      lift = 0.06 + Math.abs(Math.sin(t * 1.5)) * 0.12;
    }
    body.position.y = lift + Math.sin(t * freq) * bob;
  });

  const start = (stationLayout[agent.station] as [number, number] | undefined) ?? STATIONS[agent.station] ?? [0, 0];

  return (
    <group ref={groupRef} position={[start[0], 0, start[1]]}>
      {/* Status ground ring — soft green glow when actively working, dim otherwise. */}
      <mesh position={[0, 0.015, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.22, 0.32, 28]} />
        <meshBasicMaterial color={statusColor} transparent opacity={agent.status === "working" ? 0.6 : agent.status === "idle" ? 0.12 : 0.3} />
      </mesh>
      {/* Soft contact shadow under the standee */}
      <mesh position={[0, 0.011, 0]} rotation={[-Math.PI / 2, 0, 0]} scale={[1, 0.55, 1]}>
        <circleGeometry args={[0.27, 24]} />
        <meshBasicMaterial color="#000000" transparent opacity={0.16} />
      </mesh>
      {/* Yanshi Puppet standee — the 2D chibi worker art (worker-art.ts) rendered as a
          billboard sprite. alphaTest keeps real depth vs. desks; toneMapped=false preserves
          the authored palette exactly. Expression comes from real runtime state only. */}
      <group
        ref={bodyRef}
        onPointerOver={(event) => {
          event.stopPropagation();
          setHovered(true);
        }}
        onPointerOut={() => setHovered(false)}
      >
        <sprite position={[0, 0.46, 0]} scale={[0.78, 0.94, 1]}>
          <spriteMaterial ref={spriteMatRef} map={texture} transparent alphaTest={0.35} toneMapped={false} />
        </sprite>
      </group>

      {/* Queue bubble */}
      {agent.queueCount > 0 && (
        <Html position={[0.26, 0.82, 0]} center distanceFactor={6}>
          <div className="office-queue">{agent.queueCount}</div>
        </Html>
      )}

      {/* Floating debug label — Developer Mode only; normal mode is tooltip-only (spec §2.8) */}
      {debugLabels && (
        <Html position={[0, 1.0, 0]} center distanceFactor={6}>
          <div className="office-label">
            <strong>{agent.name}</strong>
            <span>{stateText}</span>
          </div>
        </Html>
      )}

      {/* Hover card — the single normal-mode home for state text (localized via `labels`) */}
      {hovered && (
        <Html position={[0, 0.55, 0]} center distanceFactor={5} zIndexRange={[40, 0]}>
          <div className="office-hovercard">
            <div className="office-hovercard-head">
              <strong>{agent.name}</strong>
              <em>{agent.role}</em>
            </div>
            <div className="office-hovercard-row">{stateText}</div>
            {agent.currentTask && <div className="office-hovercard-task">{agent.currentTask}</div>}
            <div className="office-hovercard-row">
              {text("queue", "Queue")}: {agent.queueCount}
            </div>
            <div className="office-fatigue">
              <span style={{ width: `${Math.round(agent.fatigue * 100)}%` }} />
            </div>
          </div>
        </Html>
      )}
    </group>
  );
}

const WORK_STATIONS = ["manager", "browser", "computer", "file", "reviewer", "terminal"] as const;

/** Mini work desk per station: desk top, a tiny screen facing the worker, the role prop and a
 *  mug — gives every chibi worker a "working at their desk" scene per the design reference. */
function StationDesk({ role, position, dark }: { role: string; position: [number, number]; dark: boolean }) {
  const top = dark ? "#6e5a44" : "#9a7b58";
  const leg = dark ? "#3b332b" : "#7a6248";
  return (
    <group position={[position[0], 0, position[1] + 0.34]}>
      <mesh castShadow position={[0, 0.2, 0]}>
        <boxGeometry args={[0.56, 0.04, 0.3]} />
        <meshStandardMaterial color={top} roughness={0.7} />
      </mesh>
      <mesh position={[0.24, 0.1, 0]}>
        <boxGeometry args={[0.04, 0.2, 0.26]} />
        <meshStandardMaterial color={leg} roughness={0.8} />
      </mesh>
      <mesh position={[-0.24, 0.1, 0]}>
        <boxGeometry args={[0.04, 0.2, 0.26]} />
        <meshStandardMaterial color={leg} roughness={0.8} />
      </mesh>
      {/* Tiny screen tilted toward the worker */}
      <mesh position={[0, 0.3, 0.06]} rotation={[-0.35, Math.PI, 0]}>
        <boxGeometry args={[0.2, 0.13, 0.015]} />
        <meshStandardMaterial color="#22272e" roughness={0.35} emissive={dark ? "#3b4b57" : "#9fb4c2"} emissiveIntensity={0.35} />
      </mesh>
      {/* Mug */}
      <mesh position={[-0.2, 0.245, -0.06]}>
        <cylinderGeometry args={[0.025, 0.025, 0.045, 10]} />
        <meshStandardMaterial color="#cf7d5e" roughness={0.7} />
      </mesh>
      {/* RoleProp's internal offset is [0.32, 0.16, 0.18]; this wrapper lands it on the desk top. */}
      <group position={[-0.14, 0.08, -0.26]}>
        <RoleProp role={role} />
      </group>
    </group>
  );
}

function Furniture({ dark }: { dark: boolean }) {
  const floor = dark ? "#1c1b19" : "#f0eeea";
  const padWork = dark ? "#23282b" : "#d9e4de";
  const padRest = dark ? "#2a2420" : "#e7ddd0";
  return (
    <group>
      {/* Floor */}
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[7, 5]} />
        <meshStandardMaterial color={floor} roughness={0.95} />
      </mesh>
      {/* Soft rug under the meeting table — makes the room feel furnished, not empty */}
      <mesh position={[0, 0.012, -0.1]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[1.15, 36]} />
        <meshStandardMaterial color={dark ? "#242a2c" : "#e3e9e4"} roughness={0.95} />
      </mesh>
      {/* Station pads */}
      {Object.entries(STATIONS).map(([name, [x, z]]) => (
        <mesh key={name} position={[x, 0.02, z]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[0.4, 32]} />
          <meshStandardMaterial color={name === "coffee" || name === "break" || name === "rest" ? padRest : padWork} roughness={0.8} />
        </mesh>
      ))}
      {/* Per-role mini desks (chibi workers sit behind them) */}
      {WORK_STATIONS.map((role) => (
        <StationDesk key={role} role={role} position={STATIONS[role]} dark={dark} />
      ))}
      {/* Meeting table */}
      <mesh position={[0, 0.16, -0.1]} castShadow>
        <boxGeometry args={[1.3, 0.14, 0.6]} />
        <meshStandardMaterial color="#8a7660" roughness={0.8} />
      </mesh>
      {/* Coffee bar */}
      <mesh position={[STATIONS.coffee[0], 0.2, STATIONS.coffee[1] - 0.35]} castShadow>
        <boxGeometry args={[0.7, 0.4, 0.25]} />
        <meshStandardMaterial color="#9a6f4c" roughness={0.7} />
      </mesh>
      {/* Rest couch */}
      <mesh position={[STATIONS.rest[0], 0.12, STATIONS.rest[1]]} castShadow>
        <boxGeometry args={[0.8, 0.24, 0.4]} />
        <meshStandardMaterial color="#6f8a86" roughness={0.85} />
      </mesh>
    </group>
  );
}

function Scene({
  agents,
  stationLayout,
  furniture,
  dark,
  labels,
  debugLabels,
  reduceMotion,
}: {
  agents: LiveAgentState[];
  stationLayout: Record<string, number[]>;
  furniture: FurnitureItem[];
  dark: boolean;
  labels?: Record<string, string>;
  debugLabels?: boolean;
  reduceMotion: boolean;
}) {
  return (
    <>
      <ambientLight intensity={dark ? 0.62 : 1.05} />
      {/* Warm key light with a tight, soft shadow camera sized to the 7×5 floor. */}
      <directionalLight
        castShadow
        position={[2.6, 5.2, 3]}
        intensity={dark ? 0.95 : 1.45}
        color={dark ? "#cfe2ff" : "#fff4e2"}
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0004}
        shadow-radius={6}
        shadow-camera-near={1}
        shadow-camera-far={16}
        shadow-camera-left={-5}
        shadow-camera-right={5}
        shadow-camera-top={5}
        shadow-camera-bottom={-5}
      />
      {/* Cool fill from the opposite side for gentle dimensional separation (no extra shadow). */}
      <directionalLight position={[-3, 2.4, -2]} intensity={dark ? 0.3 : 0.45} color={dark ? "#3a4658" : "#dfe8ff"} />
      <Furniture dark={dark} />
      {furniture.map((item) => (
        <FurnitureMesh key={item.id} item={item} />
      ))}
      {agents.map((agent) => (
        <AgentActor key={agent.id} agent={agent} stationLayout={stationLayout} labels={labels} debugLabels={debugLabels} reduceMotion={reduceMotion} />
      ))}
      {/* Local hemisphere fill instead of drei's <Environment> — the preset HDRs load over the
          network, which suspends the whole scene to a blank canvas in the packaged/offline app. */}
      <hemisphereLight args={[dark ? "#2a3440" : "#dfeaf2", dark ? "#11161b" : "#b8a98e", dark ? 0.55 : 0.7]} />
      <OrbitControls enablePan={false} minDistance={4.5} maxDistance={9} maxPolarAngle={Math.PI / 2.2} />
    </>
  );
}

export function LiveOfficeScene({
  agents,
  compact = false,
  cameraMode = "rear",
  stationLayout = {},
  furniture = [],
  dark = false,
  lowPower = false,
  labels,
  debugLabels = false,
}: LiveOfficeSceneProps) {
  const cameraPosition: [number, number, number] =
    cameraMode === "iso" ? [6, 6, 6] : compact ? [3.8, 3.4, 4.8] : [5, 4.6, 5.6];
  // OS-level reduced-motion preference: workers hold static poses (state stays readable through
  // posture, eyes, and the status ring). Checked once per mount.
  const reduceMotion = useMemo(
    () => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches === true,
    [],
  );
  return (
    <Canvas
      camera={{ position: cameraPosition, fov: compact ? 42 : 38 }}
      dpr={lowPower ? [0.75, 1] : [1, 1.5]}
      frameloop={reduceMotion ? "demand" : "always"}
      shadows={lowPower ? false : "soft"}
    >
      <FreeContextOnUnmount />
      <Suspense fallback={null}>
        <Scene
          agents={agents}
          stationLayout={stationLayout}
          furniture={furniture}
          dark={dark}
          labels={labels}
          debugLabels={debugLabels}
          reduceMotion={reduceMotion}
        />
      </Suspense>
    </Canvas>
  );
}

export * from "./characters";
