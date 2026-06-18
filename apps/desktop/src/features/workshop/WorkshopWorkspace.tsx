import { useEffect, useState } from "react";

import { useT } from "../../i18n";
import { useRuntimeStore } from "../../stores/runtimeStore";
import { OfficeEditor, WorkshopInstalled } from "../workshop"; // temporary, replaced in Tasks 5-8
import { WorkerRail } from "./WorkerRail";

export function WorkshopWorkspace() {
  const { t } = useT();
  const { agentProfiles, liveAgents, activeProjectId, loadAgentProfiles, createAgentProfile } = useRuntimeStore();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    if (agentProfiles.length === 0) void loadAgentProfiles();
  }, [agentProfiles.length, loadAgentProfiles]);

  // Default to first profile once loaded.
  useEffect(() => {
    if (selectedId === null && agentProfiles.length > 0) {
      setSelectedId(agentProfiles[0].id);
    }
  }, [selectedId, agentProfiles]);

  void activeProjectId; // consumed by future panes (Tasks 5-8)

  const handleForge = () => {
    // Stub for Task 8 guided flow: insert a default-configured new agent profile.
    void createAgentProfile({ name: "New Agent", station: "manager", behaviorMode: "balanced", accent: "#7a6f86" });
  };

  return (
    <div className="zaowutai" aria-label={t("nav.workshop")}>
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
        <OfficeEditor />
      </div>
      <aside className="zaowutai-inspector" data-testid="workshop-inspector">
        <WorkshopInstalled />
      </aside>
    </div>
  );
}
