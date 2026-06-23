import { Aperture, Armchair, Grid3x3, RotateCcw } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import type { FurnitureItem, LiveOfficeStateSummary } from "@yanshi/shared";

import { useT } from "../../i18n";
import {
  FURNITURE_COLORS,
  OFFICE_AREAS,
  OFFICE_SVG,
  STATION_COLORS,
  STATION_DEFAULTS,
  svgPointToWorld,
  worldToSvg,
} from "../../lib/atelier";
import { STATION_OPTIONS } from "../../lib/shared";
import { useRuntimeStore } from "../../stores/runtimeStore";
import { AtelierStage } from "../live-office";
import { MascotSkin, mascotRoleFromStation } from "./mascots/skins";
import { stationMascotViewModel } from "./mascots/viewModel";
import type { MascotViewModelsByStation } from "./mascots/viewModel";

const FURNITURE_TYPES = ["desk", "plant", "shelf", "couch", "table", "lamp"] as const;
const CAMERA_MODES = ["rear", "iso"] as const;

// Stable empty fallbacks so useEffect deps don't change on every render when officeState is null.
const EMPTY_FURNITURE: FurnitureItem[] = [];
const EMPTY_LAYOUT: Record<string, number[]> = {};

interface AtelierPreviewProps {
  officeState: LiveOfficeStateSummary | null;
  activeProjectId: string | null;
  selectedId: string | null;
  mascotViewModels?: MascotViewModelsByStation;
  reducedMotion?: boolean;
}

export function AtelierPreview({ officeState, activeProjectId, selectedId, mascotViewModels, reducedMotion = false }: AtelierPreviewProps) {
  const { t } = useT();
  const { saveOfficeState } = useRuntimeStore();
  const svgRef = useRef<SVGSVGElement>(null);

  const [snap, setSnap] = useState(true);
  const [showFurnitureMenu, setShowFurnitureMenu] = useState(false);
  const [showCameraMenu, setShowCameraMenu] = useState(false);

  const furniture = officeState?.furniture ?? EMPTY_FURNITURE;
  const layout = officeState?.stationLayout ?? EMPTY_LAYOUT;

  // Local draggable positions — initialised from officeState, updated live during drag.
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
  }, [layout, furniture]); // eslint-disable-line react-hooks/exhaustive-deps

  // Convert pointer event → SVG coordinates → world coordinates.
  const pointerToSvgWorld = (event: React.PointerEvent): [number, number] => {
    const rect = svgRef.current!.getBoundingClientRect();
    const sx = ((event.clientX - rect.left) / rect.width) * OFFICE_SVG.w;
    const sy = ((event.clientY - rect.top) / rect.height) * OFFICE_SVG.h;
    return svgPointToWorld(sx, sy, snap);
  };

  const commitDrag = (key: string, pos: [number, number]) => {
    if (!officeState) return;
    if (key.startsWith("f:")) {
      const id = key.slice(2);
      void saveOfficeState(activeProjectId, {
        furniture: furniture.map((item) => (item.id === id ? { ...item, x: pos[0], z: pos[1] } : item)),
      });
    } else {
      void saveOfficeState(activeProjectId, {
        stationLayout: { ...officeState.stationLayout, [key]: pos },
      });
    }
  };

  const handlePointerMove = (event: React.PointerEvent) => {
    if (!dragging) return;
    const pos = pointerToSvgWorld(event);
    setPositions((prev) => ({ ...prev, [dragging]: pos }));
  };

  const handlePointerUp = () => {
    if (dragging) commitDrag(dragging, positions[dragging]);
    setDragging(null);
  };

  // Toolbar actions.
  const addFurniture = (type: string) => {
    void saveOfficeState(activeProjectId, {
      furniture: [...furniture, { id: `f_${Date.now()}_${Math.round(Math.random() * 1e4)}`, type, x: 0, z: 0 }],
    });
    setShowFurnitureMenu(false);
  };

  const setCameraMode = (mode: string) => {
    void saveOfficeState(activeProjectId, { cameraMode: mode as import("@yanshi/shared").CameraMode });
    setShowCameraMenu(false);
  };

  const resetLayout = () => {
    void saveOfficeState(activeProjectId, { stationLayout: {}, furniture: [] });
  };

  return (
    <div className="atelier-preview">
      {/* Backdrop: the 3D live scene */}
      <div className="atelier-preview-stage">
        <AtelierStage compact={false} showWorkers={false} />
      </div>

      {/* Editable SVG overlay */}
      <svg
        ref={svgRef}
        className="atelier-preview-overlay"
        viewBox={`0 0 ${OFFICE_SVG.w} ${OFFICE_SVG.h}`}
        preserveAspectRatio="xMidYMid meet"
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
      >
        {/* Area labels */}
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

        {/* Station markers */}
        {STATION_OPTIONS.map((station) => {
          const pos = positions[station] ?? STATION_DEFAULTS[station];
          const [cx, cy] = worldToSvg(pos[0], pos[1]);
          const isSelected = station === selectedId;
          const isDragging = dragging === station;
          const role = mascotRoleFromStation(station);
          const mascot = mascotViewModels?.[role] ?? stationMascotViewModel(station, t, reducedMotion);
          return (
            <g
              key={station}
              data-testid={`station-marker-${station}`}
              transform={`translate(${cx} ${cy})`}
              className={isDragging ? "office-station dragging" : "office-station"}
              aria-selected={isSelected}
              onPointerDown={(event) => {
                (event.target as Element).setPointerCapture?.(event.pointerId);
                setDragging(station);
              }}
            >
              <circle
                className="office-station-ring"
                r={isSelected ? 28 : 24}
                fill={STATION_COLORS[station] ?? "var(--ws-brass)"}
                stroke={isSelected ? "var(--ws-brass)" : "transparent"}
                strokeWidth={isSelected ? 3 : 0}
              />
              <foreignObject
                x={-28}
                y={-52}
                width={56}
                height={76}
                className="office-station-mascot"
                pointerEvents="none"
              >
                <div className="office-station-mascot-frame">
                  <MascotSkin
                    role={mascot.role}
                    accessibleName={mascot.accessibleName}
                    statusText={mascot.statusText}
                    expression={mascot.expression}
                    size="rail"
                    reducedMotion={mascot.reducedMotion}
                  />
                </div>
              </foreignObject>
              <text y={32} className="office-station-label">
                {station}
              </text>
            </g>
          );
        })}

        {/* Furniture markers */}
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

      {/* Floating icon toolbar */}
      <div className="atelier-preview-toolbar">
        {/* Add Furniture */}
        <div className="atelier-toolbar-group">
          <button
            className="atelier-toolbar-btn"
            aria-label={t("workshop.addFurniture")}
            title={t("workshop.addFurniture")}
            onClick={() => {
              setShowFurnitureMenu((v) => !v);
              setShowCameraMenu(false);
            }}
          >
            <Armchair size={16} />
          </button>
          {showFurnitureMenu && (
            <div className="atelier-toolbar-popover">
              {FURNITURE_TYPES.map((type) => (
                <button key={type} className="atelier-popover-item" onClick={() => addFurniture(type)}>
                  {type}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Camera mode */}
        <div className="atelier-toolbar-group">
          <button
            className="atelier-toolbar-btn"
            aria-label={t("workshop.camera")}
            title={t("workshop.camera")}
            onClick={() => {
              setShowCameraMenu((v) => !v);
              setShowFurnitureMenu(false);
            }}
          >
            <Aperture size={16} />
          </button>
          {showCameraMenu && (
            <div className="atelier-toolbar-popover">
              {CAMERA_MODES.map((mode) => (
                <button
                  key={mode}
                  className={`atelier-popover-item${officeState?.cameraMode === mode ? " active" : ""}`}
                  onClick={() => setCameraMode(mode)}
                >
                  {t(`workshop.camera${mode.charAt(0).toUpperCase()}${mode.slice(1)}` as import("../../i18n/en").TKey)}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Snap toggle */}
        <button
          className={`atelier-toolbar-btn${snap ? " active" : ""}`}
          aria-label={t("workshop.snap")}
          title={t("workshop.snap")}
          onClick={() => setSnap((v) => !v)}
          aria-pressed={snap}
        >
          <Grid3x3 size={16} />
        </button>

        {/* Reset layout */}
        <button
          className="atelier-toolbar-btn"
          aria-label={t("workshop.resetLayout")}
          title={t("workshop.resetLayout")}
          onClick={resetLayout}
        >
          <RotateCcw size={16} />
        </button>
      </div>
    </div>
  );
}
