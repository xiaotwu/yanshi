import { Share2, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { useT } from "../../i18n";
import { useRuntimeStore } from "../../stores/runtimeStore";
import { WorkshopInstalled } from "../workshop";
import { AtelierPreview } from "./AtelierPreview";
import { ForgeWorkerFlow } from "./ForgeWorkerFlow";
import { SharePanel } from "./SharePanel";
import { WorkerInspector } from "./WorkerInspector";
import { WorkerRail } from "./WorkerRail";
import { buildMascotViewModels } from "./mascots/viewModel";

function usePrefersReducedMotion(): boolean {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setPrefersReducedMotion(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  return prefersReducedMotion;
}

function useDocumentVisible(): boolean {
  const [visible, setVisible] = useState(() => (typeof document === "undefined" ? true : document.visibilityState !== "hidden"));

  useEffect(() => {
    if (typeof document === "undefined") return;
    const update = () => setVisible(document.visibilityState !== "hidden");
    document.addEventListener("visibilitychange", update);
    return () => document.removeEventListener("visibilitychange", update);
  }, []);

  return visible;
}

export function WorkshopWorkspace() {
  const { t } = useT();
  const {
    agentProfiles,
    liveAgents,
    activeProjectId,
    activeRunId,
    officeState,
    runs,
    approvals,
    events,
    providerHealth,
    loadAgentProfiles,
    loadOfficeState,
    createAgentProfile,
  } = useRuntimeStore();
  const prefersReducedMotion = usePrefersReducedMotion();
  const documentVisible = useDocumentVisible();
  const mascotReducedMotion = prefersReducedMotion || !documentVisible;
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [forgeOpen, setForgeOpen] = useState(false);
  // Slide-over inspector state for <760px viewports. On wider layouts the
  // inspector is always visible as a grid column, so this only has a visual
  // effect at the narrow breakpoint (CSS keeps it hidden via transform).
  const [inspectorOpen, setInspectorOpen] = useState(false);

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
    setForgeOpen(true);
  };

  const handleForgeCreate = async ({ name, station }: { name: string; station: string }) => {
    const id = await createAgentProfile({ name, station, behaviorMode: "balanced", accent: "#7a6f86" });
    setSelectedId(id);
    setForgeOpen(false);
  };

  const handleSelect = (id: string | null) => {
    setSelectedId(id);
    // On narrow screens, selecting a worker opens the slide-over inspector.
    setInspectorOpen(id !== null);
  };

  // Resolve selectedId to the station of the selected agent profile.
  const selectedProfile = agentProfiles.find((p) => p.id === selectedId);
  const selectedStation = selectedProfile?.station ?? null;
  const mascotViewModels = useMemo(
    () =>
      buildMascotViewModels(
        agentProfiles,
        {
          activeRunId,
          runs,
          approvals,
          events,
          providerHealth,
          reducedMotion: mascotReducedMotion,
        },
        t,
      ),
    [activeRunId, agentProfiles, approvals, events, mascotReducedMotion, providerHealth, runs, t],
  );

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
          mascotViewModels={mascotViewModels.byProfileId}
          selectedId={selectedId}
          onSelect={handleSelect}
          onForge={handleForge}
        />
      </div>
      {forgeOpen && (
        <ForgeWorkerFlow
          onCreate={handleForgeCreate}
          onClose={() => setForgeOpen(false)}
        />
      )}
      <div className="zaowutai-preview" data-testid="workshop-preview">
        <AtelierPreview
          officeState={officeState}
          activeProjectId={activeProjectId}
          selectedId={selectedStation}
          mascotViewModels={mascotViewModels.byStation}
          reducedMotion={mascotReducedMotion}
        />
      </div>
      <aside
        className={`zaowutai-inspector${inspectorOpen ? " open" : ""}`}
        data-testid="workshop-inspector"
      >
        {/* Close control — only visible at the narrow breakpoint where the
            inspector is a slide-over; hidden via CSS on wider layouts. */}
        <button
          className="zaowutai-inspector-close"
          aria-label="Close inspector"
          title="Close inspector"
          onClick={() => setInspectorOpen(false)}
        >
          <X size={14} />
        </button>
        {selectedProfile ? (
          <WorkerInspector profile={selectedProfile} mascotViewModel={mascotViewModels.byProfileId[selectedProfile.id]} />
        ) : (
          <WorkshopInstalled />
        )}
      </aside>
    </div>
  );
}
