import { Share2 } from "lucide-react";
import { useEffect, useState } from "react";

import { useT } from "../../i18n";
import { useRuntimeStore } from "../../stores/runtimeStore";
import { WorkshopInstalled } from "../workshop"; // kept for Task 7
import { AtelierPreview } from "./AtelierPreview";
import { SharePanel } from "./SharePanel";
import { WorkerInspector } from "./WorkerInspector";
import { WorkerRail } from "./WorkerRail";

export function WorkshopWorkspace() {
  const { t } = useT();
  const { agentProfiles, liveAgents, activeProjectId, officeState, loadAgentProfiles, loadOfficeState, createAgentProfile } = useRuntimeStore();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [shareOpen, setShareOpen] = useState(false);

  useEffect(() => {
    if (agentProfiles.length === 0) void loadAgentProfiles();
  }, [agentProfiles.length, loadAgentProfiles]);

  // Default to first profile once loaded.
  useEffect(() => {
    if (selectedId === null && agentProfiles.length > 0) {
      setSelectedId(agentProfiles[0].id);
    }
  }, [selectedId, agentProfiles]);

  // Load office state scoped to the active project.
  useEffect(() => {
    void loadOfficeState(activeProjectId);
  }, [activeProjectId, loadOfficeState]);

  const handleForge = () => {
    // Stub for Task 8 guided flow: insert a default-configured new agent profile.
    void createAgentProfile({ name: "New Agent", station: "manager", behaviorMode: "balanced", accent: "#7a6f86" });
  };

  // Resolve selectedId to the station of the selected agent profile.
  const selectedProfile = agentProfiles.find((p) => p.id === selectedId);
  const selectedStation = selectedProfile?.station ?? null;

  return (
    <div className="zaowutai" aria-label={t("nav.workshop")}>
      <div className="zaowutai-topbar" data-testid="workshop-topbar">
        <button
          className="ws-share-btn"
          aria-label={t("workshop.share")}
          title={t("workshop.share")}
          aria-expanded={shareOpen}
          onClick={() => setShareOpen((prev) => !prev)}
        >
          <Share2 size={18} />
        </button>
        {shareOpen && <SharePanel />}
      </div>
      <div className="zaowutai-rail" data-testid="workshop-rail">
        <WorkerRail
          profiles={agentProfiles}
          liveAgents={liveAgents}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onForge={handleForge}
        />
      </div>
      <div className="zaowutai-preview" data-testid="workshop-preview">
        <AtelierPreview
          officeState={officeState}
          activeProjectId={activeProjectId}
          selectedId={selectedStation}
        />
      </div>
      <aside className="zaowutai-inspector" data-testid="workshop-inspector">
        {selectedProfile ? (
          <WorkerInspector profile={selectedProfile} />
        ) : (
          <WorkshopInstalled />
        )}
      </aside>
    </div>
  );
}
