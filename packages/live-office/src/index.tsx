import { Environment, Html, OrbitControls } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import type { LiveAgentState } from "@yanshi/shared";
import { Suspense, useMemo, useRef } from "react";
import type { Mesh } from "three";

export interface LiveOfficeSceneProps {
  agents: LiveAgentState[];
  compact?: boolean;
}

const stationPositions: Record<string, [number, number, number]> = {
  manager: [-2.4, 0.35, -0.6],
  browser: [-0.8, 0.35, -1.2],
  computer: [0.8, 0.35, -1.2],
  file: [2.4, 0.35, -0.6],
  reviewer: [0, 0.35, 1.1],
  terminal: [2.2, 0.35, 1.2],
};

function AgentActor({ agent }: { agent: LiveAgentState }) {
  const meshRef = useRef<Mesh>(null);
  const position = stationPositions[agent.station] ?? [0, 0.35, 0];
  const color = useMemo(() => {
    if (agent.status === "waiting_approval") return "#b65c2f";
    if (agent.status === "blocked" || agent.status === "failed") return "#b43b40";
    if (agent.status === "working") return "#278474";
    if (agent.status === "done") return "#5b8d55";
    return "#687380";
  }, [agent.status]);

  useFrame((_, delta) => {
    if (!meshRef.current) return;
    const active = agent.status === "working" || agent.status === "waiting_approval";
    meshRef.current.rotation.y += active ? delta * 0.6 : delta * 0.08;
    meshRef.current.position.y = position[1] + Math.sin(Date.now() / 500) * (active ? 0.03 : 0.01);
  });

  return (
    <group position={position}>
      <mesh ref={meshRef} castShadow>
        <capsuleGeometry args={[0.18, 0.42, 8, 16]} />
        <meshStandardMaterial color={color} roughness={0.65} metalness={0.08} />
      </mesh>
      <mesh position={[0, 0.43, 0]} castShadow>
        <sphereGeometry args={[0.17, 18, 18]} />
        <meshStandardMaterial color="#f0d6bf" roughness={0.8} />
      </mesh>
      <Html distanceFactor={8} position={[0, 0.9, 0]} center>
        <div className="office-label">
          <strong>{agent.name}</strong>
          <span>{agent.status.replace("_", " ")}</span>
        </div>
      </Html>
    </group>
  );
}

function OfficeFloor() {
  return (
    <group>
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
        <planeGeometry args={[6.2, 4.2]} />
        <meshStandardMaterial color="#f3eee5" roughness={0.9} />
      </mesh>
      {Object.entries(stationPositions).map(([station, position]) => (
        <mesh key={station} position={[position[0], 0.04, position[2]]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[0.42, 36]} />
          <meshStandardMaterial color="#d8c1a2" roughness={0.75} />
        </mesh>
      ))}
      <mesh position={[0, 0.18, 0.15]}>
        <boxGeometry args={[1.2, 0.18, 0.55]} />
        <meshStandardMaterial color="#8a7660" roughness={0.8} />
      </mesh>
    </group>
  );
}

function Scene({ agents }: { agents: LiveAgentState[] }) {
  return (
    <>
      <ambientLight intensity={1.2} />
      <directionalLight castShadow position={[2, 5, 3]} intensity={1.6} />
      <OfficeFloor />
      {agents.map((agent) => (
        <AgentActor key={agent.id} agent={agent} />
      ))}
      <Environment preset="apartment" />
      <OrbitControls enablePan={false} minDistance={4.5} maxDistance={8} maxPolarAngle={Math.PI / 2.25} />
    </>
  );
}

export function LiveOfficeScene({ agents, compact = false }: LiveOfficeSceneProps) {
  return (
    <Canvas
      camera={{ position: compact ? [3.8, 3.4, 4.6] : [4.8, 4.4, 5.4], fov: compact ? 42 : 38 }}
      dpr={[1, 1.5]}
      frameloop="always"
      shadows
    >
      <Suspense fallback={null}>
        <Scene agents={agents} />
      </Suspense>
    </Canvas>
  );
}
