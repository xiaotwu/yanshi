import { ExternalLink, Maximize2, X } from "lucide-react";
import { lazy, Suspense } from "react";

import { popOutLiveOffice } from "../api/desktop";
import { useRuntimeStore } from "../stores/runtimeStore";

export const LiveOfficeScene = lazy(() => import("@yanshi/live-office").then((module) => ({ default: module.LiveOfficeScene })));

export function LiveOfficePanel({
  activeRunId,
  full,
  onClose,
  onFull,
}: {
  activeRunId: string | null;
  full: boolean;
  onClose: () => void;
  onFull: () => void;
}) {
  const { liveAgents, approvals, runs, officeState } = useRuntimeStore();
  const run = runs.find((item) => item.id === activeRunId);
  return (
    <section className={full ? "live-office full" : "live-office"}>
      <div className="office-toolbar">
        <strong>{full ? "Live Office" : run?.task ?? "Live Office"}</strong>
        <div>
          {!full && (
            <button className="icon-button" title="Full Office View" onClick={onFull}>
              <Maximize2 size={16} />
            </button>
          )}
          <button className="icon-button" title="Pop out Live Office" onClick={() => void popOutLiveOffice()}>
            <ExternalLink size={16} />
          </button>
          <button className="icon-button" title="Close Live Office" onClick={onClose}>
            <X size={16} />
          </button>
        </div>
      </div>
      <div className="office-canvas">
        <Suspense fallback={<div className="scene-loading">Loading office</div>}>
          <LiveOfficeScene
            agents={liveAgents}
            compact={!full}
            cameraMode={officeState?.cameraMode ?? "rear"}
            stationLayout={officeState?.stationLayout ?? {}}
            furniture={officeState?.furniture ?? []}
            dark={document.documentElement.dataset.theme === "dark"}
          />
        </Suspense>
      </div>
      <div className="office-meta">
        <span>{liveAgents.filter((agent) => agent.status === "working").length} active</span>
        <span>{approvals.length} approvals</span>
      </div>
      <div className="agent-queue-list">
        {liveAgents.map((agent) => (
          <div key={agent.id} className="agent-queue-pill" title={`${agent.name}: ${agent.status}`}>
            <span>{agent.name}</span>
            {agent.queueCount > 0 && <b>{agent.queueCount}</b>}
          </div>
        ))}
      </div>
    </section>
  );
}
