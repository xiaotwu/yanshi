import { useEffect } from "react";

import { useT } from "../../i18n";
import { useRuntimeStore } from "../../stores/runtimeStore";
import { AgentEditor, OfficeEditor, WorkshopInstalled } from "../workshop"; // temporary, replaced in Tasks 4-8

export function WorkshopWorkspace() {
  const { t } = useT();
  const { agentProfiles, activeProjectId, loadAgentProfiles } = useRuntimeStore();
  useEffect(() => {
    if (agentProfiles.length === 0) void loadAgentProfiles();
  }, [agentProfiles.length, loadAgentProfiles]);
  void activeProjectId; // consumed by future panes (Tasks 4-8)
  return (
    <div className="zaowutai" aria-label={t("nav.workshop")}>
      <div className="zaowutai-rail" data-testid="workshop-rail">
        <AgentEditor />
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
