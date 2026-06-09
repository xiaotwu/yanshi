import { Environment, Html, OrbitControls } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import type { CameraMode, LifeAction, LiveAgentState } from "@yanshi/shared";
import { Suspense, useMemo, useRef, useState } from "react";
import { Group, MathUtils, Mesh } from "three";

export interface LiveOfficeSceneProps {
  agents: LiveAgentState[];
  compact?: boolean;
  cameraMode?: CameraMode;
  stationLayout?: Record<string, number[]>;
  dark?: boolean;
}

const ACTIVE_GLOW = "#2fc279";

// Office areas (x, z on the floor). Work stations + rest/social areas (spec §17).
const STATIONS: Record<string, [number, number]> = {
  manager: [-2.4, -0.6],
  browser: [-0.9, -1.3],
  computer: [0.9, -1.3],
  file: [2.4, -0.6],
  reviewer: [0, 1.0],
  terminal: [2.2, 1.2],
  coffee: [-2.7, 1.4],
  break: [2.8, -1.7],
  rest: [-2.8, -1.7],
  meeting: [0, -0.1],
};

const LIFE_AREA: Record<LifeAction, keyof typeof STATIONS | "self" | "wander"> = {
  coffee_break: "coffee",
  stretching: "self",
  nap: "rest",
  walking_around: "wander",
  playing_phone: "self",
  chatting_with_neighbor: "meeting",
};

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

function targetPosition(agent: LiveAgentState, stationLayout: Record<string, number[]>, time: number): [number, number] {
  const own = (stationLayout[agent.station] as [number, number] | undefined) ?? STATIONS[agent.station] ?? [0, 0];
  const working = agent.status === "working" || agent.status === "waiting_approval";
  if (working || !agent.lifeAction) return own;
  const area = LIFE_AREA[agent.lifeAction];
  if (area === "self") return own;
  if (area === "wander") {
    // Slow loop around the agent's own desk so idle workers feel alive.
    const angle = time * 0.4 + agent.id.length;
    return [own[0] + Math.cos(angle) * 0.5, own[1] + Math.sin(angle) * 0.5];
  }
  return STATIONS[area] ?? own;
}

function AgentActor({ agent, stationLayout }: { agent: LiveAgentState; stationLayout: Record<string, number[]> }) {
  const groupRef = useRef<Group>(null);
  const bodyRef = useRef<Mesh>(null);
  const [hovered, setHovered] = useState(false);

  const statusColor = useMemo(() => {
    if (agent.status === "waiting_approval") return "#d08a3a";
    if (agent.status === "blocked" || agent.status === "failed") return "#d2655f";
    if (agent.status === "working") return ACTIVE_GLOW;
    if (agent.status === "done") return "#5fbf86";
    return "#94a0a8";
  }, [agent.status]);

  useFrame((state, delta) => {
    const group = groupRef.current;
    const body = bodyRef.current;
    if (!group || !body) return;
    const t = state.clock.elapsedTime;
    const [tx, tz] = targetPosition(agent, stationLayout, t);
    group.position.x = MathUtils.lerp(group.position.x, tx, Math.min(1, delta * 2));
    group.position.z = MathUtils.lerp(group.position.z, tz, Math.min(1, delta * 2));

    const working = agent.status === "working";
    const livelinessByMode = agent.behaviorMode === "playful" ? 1.4 : agent.behaviorMode === "professional" ? 0.6 : 1;
    body.rotation.y += (working ? delta * 0.8 : delta * 0.12) * livelinessByMode;

    // Animation height varies by state: typing bob when working, slow sway when idle, low when napping.
    let bob = working ? 0.04 : 0.015 * livelinessByMode;
    let lift = 0.35;
    if (agent.lifeAction === "nap") {
      bob = 0.004;
      lift = 0.18;
    } else if (agent.lifeAction === "stretching") {
      lift = 0.35 + Math.abs(Math.sin(t * 1.5)) * 0.12;
    }
    body.position.y = lift + Math.sin(t * (working ? 5 : 2)) * bob;
  });

  const start = (stationLayout[agent.station] as [number, number] | undefined) ?? STATIONS[agent.station] ?? [0, 0];

  return (
    <group ref={groupRef} position={[start[0], 0, start[1]]}>
      <mesh
        ref={bodyRef}
        castShadow
        onPointerOver={(event) => {
          event.stopPropagation();
          setHovered(true);
        }}
        onPointerOut={() => setHovered(false)}
      >
        <capsuleGeometry args={[0.18, 0.42, 8, 16]} />
        <meshStandardMaterial color={agent.accent} roughness={0.55} metalness={0.18} emissive={statusColor} emissiveIntensity={agent.status === "working" ? 0.5 : 0.08} />
      </mesh>
      <mesh position={[0, 0.62, 0]} castShadow>
        <sphereGeometry args={[0.16, 18, 18]} />
        <meshStandardMaterial color="#f0d6bf" roughness={0.8} />
      </mesh>
      {/* Status dot */}
      <mesh position={[0, 0.92, 0]}>
        <sphereGeometry args={[0.05, 12, 12]} />
        <meshStandardMaterial color={statusColor} emissive={statusColor} emissiveIntensity={0.6} />
      </mesh>

      {/* Queue bubble */}
      {agent.queueCount > 0 && (
        <Html position={[0.28, 0.98, 0]} center distanceFactor={6}>
          <div className="office-queue">{agent.queueCount}</div>
        </Html>
      )}

      {/* Always-on small label */}
      <Html position={[0, 1.18, 0]} center distanceFactor={6}>
        <div className="office-label">
          <strong>{agent.name}</strong>
          <span>{agent.lifeAction && agent.status !== "working" ? LIFE_TEXT[agent.lifeAction] : STATUS_TEXT[agent.status]}</span>
        </div>
      </Html>

      {/* Hover card */}
      {hovered && (
        <Html position={[0, 0.55, 0]} center distanceFactor={5} zIndexRange={[40, 0]}>
          <div className="office-hovercard">
            <div className="office-hovercard-head">
              <strong>{agent.name}</strong>
              <em>{agent.role}</em>
            </div>
            <div className="office-hovercard-row">{STATUS_TEXT[agent.status]}</div>
            {agent.currentTask && <div className="office-hovercard-task">{agent.currentTask}</div>}
            <div className="office-hovercard-row">Queue: {agent.queueCount}</div>
            <div className="office-fatigue">
              <span style={{ width: `${Math.round(agent.fatigue * 100)}%` }} />
            </div>
          </div>
        </Html>
      )}
    </group>
  );
}

function Furniture({ dark }: { dark: boolean }) {
  const floor = dark ? "#1a1e20" : "#eef1f0";
  const padWork = dark ? "#23282b" : "#d9e4de";
  const padRest = dark ? "#2a2420" : "#e7ddd0";
  return (
    <group>
      {/* Floor */}
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[7, 5]} />
        <meshStandardMaterial color={floor} roughness={0.95} />
      </mesh>
      {/* Station pads */}
      {Object.entries(STATIONS).map(([name, [x, z]]) => (
        <mesh key={name} position={[x, 0.02, z]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[0.4, 32]} />
          <meshStandardMaterial color={name === "coffee" || name === "break" || name === "rest" ? padRest : padWork} roughness={0.8} />
        </mesh>
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

function Scene({ agents, stationLayout, dark }: { agents: LiveAgentState[]; stationLayout: Record<string, number[]>; dark: boolean }) {
  return (
    <>
      <ambientLight intensity={dark ? 0.7 : 1.15} />
      <directionalLight castShadow position={[2, 5, 3]} intensity={dark ? 0.9 : 1.5} />
      <Furniture dark={dark} />
      {agents.map((agent) => (
        <AgentActor key={agent.id} agent={agent} stationLayout={stationLayout} />
      ))}
      <Environment preset={dark ? "night" : "apartment"} />
      <OrbitControls enablePan={false} minDistance={4.5} maxDistance={9} maxPolarAngle={Math.PI / 2.2} />
    </>
  );
}

export function LiveOfficeScene({ agents, compact = false, cameraMode = "rear", stationLayout = {}, dark = false }: LiveOfficeSceneProps) {
  const cameraPosition: [number, number, number] =
    cameraMode === "iso" ? [6, 6, 6] : compact ? [3.8, 3.4, 4.8] : [5, 4.6, 5.6];
  return (
    <Canvas camera={{ position: cameraPosition, fov: compact ? 42 : 38 }} dpr={[1, 1.5]} frameloop="always" shadows>
      <Suspense fallback={null}>
        <Scene agents={agents} stationLayout={stationLayout} dark={dark} />
      </Suspense>
    </Canvas>
  );
}
