import { Archive, Plus, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { runtimeApi } from "../api/client";
import { BEHAVIOR_OPTIONS, STATION_OPTIONS } from "../lib/shared";
import { useRuntimeStore } from "../stores/runtimeStore";

export type WorkshopTab = "installed" | "agents" | "office" | "export";

export function WorkshopView() {
  const [tab, setTab] = useState<WorkshopTab>("installed");
  const tabs: Array<{ id: WorkshopTab; label: string }> = [
    { id: "installed", label: "Installed" },
    { id: "agents", label: "Agent Editor" },
    { id: "office", label: "Office Editor" },
    { id: "export", label: "Create / Export" },
  ];
  return (
    <section className="content-stack">
      <h2>Workshop</h2>
      <div className="project-tabs">
        {tabs.map((item) => (
          <button key={item.id} className={tab === item.id ? "active" : ""} onClick={() => setTab(item.id)}>
            {item.label}
          </button>
        ))}
      </div>
      {tab === "installed" && <WorkshopInstalled />}
      {tab === "agents" && <AgentEditor />}
      {tab === "office" && <OfficeEditor />}
      {tab === "export" && <WorkshopExport />}
    </section>
  );
}

export function WorkshopInstalled() {
  const [result, setResult] = useState<string>("");
  const { workshopPacks, importWorkshopPack, setWorkshopPackEnabled, loading, error } = useRuntimeStore();
  const importPack = async (file: File | undefined) => {
    if (!file) return;
    await importWorkshopPack(file);
    setResult(`Imported ${file.name}.`);
  };
  return (
    <>
      <label className="drop-zone">
        <Archive size={22} />
        <span>{loading ? "Importing…" : "Import pack"}</span>
        <input type="file" accept=".zip" onChange={(event) => void importPack(event.target.files?.[0])} />
      </label>
      {(error || result) && <p className={error ? "inline-error" : "muted"}>{error ?? result}</p>}
      <div className="event-feed">
        {workshopPacks.length === 0 ? (
          <p className="transcript-empty">No packs installed.</p>
        ) : (
          workshopPacks.map((pack) => (
            <article key={pack.id} className="workshop-pack-row">
              <Archive size={18} />
              <div>
                <strong>
                  {pack.name} {pack.version}
                </strong>
                <span>{pack.securityStatus}</span>
              </div>
              <label title={pack.enabled ? "Disable" : "Enable"}>
                <input
                  type="checkbox"
                  checked={pack.enabled}
                  onChange={(event) => void setWorkshopPackEnabled(pack.id, event.target.checked)}
                  disabled={loading}
                />
              </label>
            </article>
          ))
        )}
      </div>
    </>
  );
}

export function AgentEditor() {
  const { agentProfiles, saveAgentProfile, createAgentProfile, deleteAgentProfile, loadAgentProfiles } = useRuntimeStore();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (agentProfiles.length === 0) void loadAgentProfiles();
  }, [agentProfiles.length, loadAgentProfiles]);

  const selected = agentProfiles.find((p) => p.id === selectedId) ?? agentProfiles[0] ?? null;
  const [draft, setDraft] = useState(selected);
  useEffect(() => setDraft(selected), [selected?.id]);

  if (agentProfiles.length === 0 || !draft) return <p className="muted">Loading agents…</p>;

  const save = async () => {
    setBusy(true);
    try {
      await saveAgentProfile(draft.id, {
        name: draft.name,
        station: draft.station,
        behaviorMode: draft.behaviorMode,
        accent: draft.accent,
        taskPriority: draft.taskPriority,
        personality: draft.personality,
        prompt: draft.prompt,
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="agent-editor">
      <div className="agent-pick">
        {agentProfiles.map((profile) => (
          <button key={profile.id} className={profile.id === draft.id ? "active" : ""} onClick={() => setSelectedId(profile.id)}>
            <span className="agent-dot" style={{ background: profile.accent }} />
            {profile.name}
          </button>
        ))}
        <button
          onClick={() =>
            void createAgentProfile({ name: "New Agent", station: "manager", behaviorMode: "balanced", accent: "#7a6f86" })
          }
        >
          <Plus size={14} /> New
        </button>
      </div>
      <div className="agent-fields">
        <label>
          Name
          <input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} />
        </label>
        <label>
          Station
          <select value={draft.station} onChange={(event) => setDraft({ ...draft, station: event.target.value })}>
            {STATION_OPTIONS.map((station) => (
              <option key={station} value={station}>
                {station}
              </option>
            ))}
          </select>
        </label>
        <label>
          Behavior
          <select value={draft.behaviorMode} onChange={(event) => setDraft({ ...draft, behaviorMode: event.target.value as import("@yanshi/shared").BehaviorMode })}>
            {BEHAVIOR_OPTIONS.map((mode) => (
              <option key={mode} value={mode}>
                {mode}
              </option>
            ))}
          </select>
        </label>
        <label>
          Accent
          <input type="color" value={draft.accent} onChange={(event) => setDraft({ ...draft, accent: event.target.value })} />
        </label>
        <label>
          Task priority ({draft.taskPriority})
          <input
            type="range"
            min={1}
            max={10}
            value={draft.taskPriority}
            onChange={(event) => setDraft({ ...draft, taskPriority: Number(event.target.value) })}
          />
        </label>
        <label>
          Personality
          <input value={draft.personality} onChange={(event) => setDraft({ ...draft, personality: event.target.value })} />
        </label>
        <label>
          Prompt
          <textarea value={draft.prompt} onChange={(event) => setDraft({ ...draft, prompt: event.target.value })} />
        </label>
        <div className="settings-actions">
          <button onClick={() => void save()} disabled={busy}>
            Save
          </button>
          {draft.id.startsWith("agent_") === false && (
            <button className="danger-text" onClick={() => void deleteAgentProfile(draft.id)} disabled={busy}>
              Delete
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

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

export function OfficeLayoutCanvas({
  layout,
  furniture,
  snap,
  onCommit,
  onFurnitureCommit,
}: {
  layout: Record<string, number[]>;
  furniture: import("@yanshi/shared").FurnitureItem[];
  snap: boolean;
  onCommit: (station: string, pos: [number, number]) => void;
  onFurnitureCommit: (id: string, pos: [number, number]) => void;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [positions, setPositions] = useState<Record<string, [number, number]>>({});
  const [dragging, setDragging] = useState<string | null>(null);

  useEffect(() => {
    const next: Record<string, [number, number]> = {};
    for (const station of STATION_OPTIONS) {
      const override = layout[station];
      next[station] = override && override.length >= 2 ? [override[0], override[1]] : STATION_DEFAULTS[station];
    }
    for (const item of furniture) next[`f:${item.id}`] = [item.x, item.z];
    setPositions(next);
  }, [layout, furniture]);

  const pointerToWorld = (event: { clientX: number; clientY: number }): [number, number] => {
    const rect = svgRef.current!.getBoundingClientRect();
    const sx = ((event.clientX - rect.left) / rect.width) * OFFICE_SVG.w;
    const sy = ((event.clientY - rect.top) / rect.height) * OFFICE_SVG.h;
    let x = (sx / OFFICE_SVG.w) * (OFFICE_WORLD.maxX - OFFICE_WORLD.minX) + OFFICE_WORLD.minX;
    let z = (sy / OFFICE_SVG.h) * (OFFICE_WORLD.maxZ - OFFICE_WORLD.minZ) + OFFICE_WORLD.minZ;
    if (snap) {
      x = Math.round(x / 0.2) * 0.2;
      z = Math.round(z / 0.2) * 0.2;
    }
    x = Math.min(OFFICE_WORLD.maxX - 0.3, Math.max(OFFICE_WORLD.minX + 0.3, x));
    z = Math.min(OFFICE_WORLD.maxZ - 0.3, Math.max(OFFICE_WORLD.minZ + 0.3, z));
    return [Math.round(x * 100) / 100, Math.round(z * 100) / 100];
  };

  const commitDrag = (key: string, pos: [number, number]) => {
    if (key.startsWith("f:")) onFurnitureCommit(key.slice(2), pos);
    else onCommit(key, pos);
  };

  return (
    <svg
      ref={svgRef}
      className="office-canvas-2d"
      viewBox={`0 0 ${OFFICE_SVG.w} ${OFFICE_SVG.h}`}
      preserveAspectRatio="xMidYMid meet"
      onPointerMove={(event) => {
        if (!dragging) return;
        const pos = pointerToWorld(event);
        setPositions((prev) => ({ ...prev, [dragging]: pos }));
      }}
      onPointerUp={() => {
        if (dragging) commitDrag(dragging, positions[dragging]);
        setDragging(null);
      }}
      onPointerLeave={() => {
        if (dragging) commitDrag(dragging, positions[dragging]);
        setDragging(null);
      }}
    >
      {Array.from({ length: 8 }).map((_, i) => (
        <line key={`v${i}`} x1={(i / 7) * OFFICE_SVG.w} y1={0} x2={(i / 7) * OFFICE_SVG.w} y2={OFFICE_SVG.h} className="grid-line" />
      ))}
      {Array.from({ length: 6 }).map((_, i) => (
        <line key={`h${i}`} x1={0} y1={(i / 5) * OFFICE_SVG.h} x2={OFFICE_SVG.w} y2={(i / 5) * OFFICE_SVG.h} className="grid-line" />
      ))}
      {OFFICE_AREAS.map((area) => {
        const [cx, cy] = worldToSvg(area.x, area.z);
        return (
          <g key={area.id}>
            <rect x={cx - 48} y={cy - 26} width={96} height={52} rx={10} className="office-area" />
            <text x={cx} y={cy + 4} className="office-area-label">
              {area.label}
            </text>
          </g>
        );
      })}
      {STATION_OPTIONS.map((station) => {
        const pos = positions[station] ?? STATION_DEFAULTS[station];
        const [cx, cy] = worldToSvg(pos[0], pos[1]);
        return (
          <g
            key={station}
            transform={`translate(${cx} ${cy})`}
            className={dragging === station ? "office-station dragging" : "office-station"}
            onPointerDown={(event) => {
              (event.target as Element).setPointerCapture?.(event.pointerId);
              setDragging(station);
            }}
          >
            <circle r={18} fill={STATION_COLORS[station]} />
            <text y={32} className="office-station-label">
              {station}
            </text>
          </g>
        );
      })}
      {furniture.map((item) => {
        const key = `f:${item.id}`;
        const pos = positions[key] ?? [item.x, item.z];
        const [cx, cy] = worldToSvg(pos[0], pos[1]);
        return (
          <g
            key={key}
            transform={`translate(${cx} ${cy})`}
            className={dragging === key ? "office-furniture dragging" : "office-furniture"}
            onPointerDown={(event) => {
              (event.target as Element).setPointerCapture?.(event.pointerId);
              setDragging(key);
            }}
          >
            <rect x={-14} y={-14} width={28} height={28} rx={6} fill={FURNITURE_COLORS[item.type] ?? "#8b939b"} />
            <text y={28} className="office-furniture-label">
              {item.type}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export function OfficeEditor() {
  const { officeState, saveOfficeState, loadOfficeState } = useRuntimeStore();
  const [snap, setSnap] = useState(true);

  useEffect(() => {
    if (!officeState) void loadOfficeState(null);
  }, [officeState, loadOfficeState]);

  if (!officeState) return <p className="muted">Loading office…</p>;

  const furniture = officeState.furniture ?? [];
  const commit = (station: string, pos: [number, number]) =>
    void saveOfficeState(null, { stationLayout: { ...officeState.stationLayout, [station]: pos } });
  const commitFurniture = (id: string, pos: [number, number]) =>
    void saveOfficeState(null, { furniture: furniture.map((item) => (item.id === id ? { ...item, x: pos[0], z: pos[1] } : item)) });
  const addFurniture = (type: string) =>
    void saveOfficeState(null, { furniture: [...furniture, { id: `f_${Date.now()}_${Math.round(Math.random() * 1e4)}`, type, x: 0, z: 0 }] });
  const removeFurniture = (id: string) =>
    void saveOfficeState(null, { furniture: furniture.filter((item) => item.id !== id) });

  return (
    <div className="office-editor">
      <div className="office-editor-grid">
        <label className="setting-row">
          <span>Behavior</span>
          <select value={officeState.behaviorMode} onChange={(event) => void saveOfficeState(null, { behaviorMode: event.target.value as import("@yanshi/shared").BehaviorMode })}>
            {BEHAVIOR_OPTIONS.map((mode) => (
              <option key={mode} value={mode}>
                {mode}
              </option>
            ))}
          </select>
        </label>
        <label className="setting-row">
          <span>Camera</span>
          <select value={officeState.cameraMode} onChange={(event) => void saveOfficeState(null, { cameraMode: event.target.value as import("@yanshi/shared").CameraMode })}>
            <option value="rear">Rear</option>
            <option value="iso">Isometric</option>
          </select>
        </label>
      </div>
      <div className="office-editor-toolbar">
        <span className="muted">Drag stations and furniture to lay out the office.</span>
        <div className="office-editor-actions">
          <button className={snap ? "ghost-button on" : "ghost-button"} onClick={() => setSnap((value) => !value)}>
            Snap {snap ? "on" : "off"}
          </button>
          <button className="ghost-button" onClick={() => void saveOfficeState(null, { stationLayout: {}, furniture: [] })}>
            Reset layout
          </button>
        </div>
      </div>
      <div className="office-editor-toolbar">
        <span className="muted">Add furniture</span>
        <div className="office-editor-actions">
          {["desk", "plant", "shelf", "couch", "table", "lamp"].map((type) => (
            <button key={type} className="ghost-button" onClick={() => addFurniture(type)}>
              + {type}
            </button>
          ))}
        </div>
      </div>
      <OfficeLayoutCanvas layout={officeState.stationLayout} furniture={furniture} snap={snap} onCommit={commit} onFurnitureCommit={commitFurniture} />
      {furniture.length > 0 && (
        <div className="furniture-list">
          {furniture.map((item) => (
            <span key={item.id} className="flag-chip file-chip">
              {item.type}
              <button onClick={() => removeFurniture(item.id)} title="Remove">
                <X size={12} />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export function WorkshopExport() {
  const [status, setStatus] = useState<string | null>(null);
  const download = async () => {
    setStatus("Exporting…");
    try {
      const response = await fetch(runtimeApi.exportPackUrl());
      if (!response.ok) throw new Error(await response.text());
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "yanshi-team.zip";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      setStatus("Exported yanshi-team.zip");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Export failed.");
    }
  };
  return (
    <div className="content-stack" style={{ padding: 0 }}>
      <p className="muted">Export your agent team and office theme as a pack. The file re-imports under Installed.</p>
      <div className="settings-actions">
        <button onClick={() => void download()}>Export pack</button>
      </div>
      {status && <p className="muted">{status}</p>}
    </div>
  );
}

