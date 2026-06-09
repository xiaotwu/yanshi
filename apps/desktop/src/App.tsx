import { listen } from "@tauri-apps/api/event";
import { Archive, Boxes, Code2, FileSearch, Home, Play, Search, Settings, Shield } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import iconUrl from "../../../icon.png";
import { updateActiveRuns } from "./api/desktop";
import { CloseRunsModal, Onboarding } from "./components/modals";
import { ApprovalsView } from "./features/approvals";
import { ArtifactsView } from "./features/artifacts";
import { DeveloperView } from "./features/developer";
import { LiveOfficePanel } from "./features/live-office";
import { NewTaskView } from "./features/new-task";
import { ProjectsView } from "./features/projects";
import { RunsView } from "./features/runs";
import { SearchView } from "./features/search";
import { SettingsView } from "./features/settings";
import { WorkshopView } from "./features/workshop";
import type { View } from "./lib/shared";
import { useRuntimeStore } from "./stores/runtimeStore";

const navItems: Array<{ id: View; label: string; icon: typeof Home }> = [
  { id: "new-task", label: "New Task", icon: Home },
  { id: "search", label: "Search", icon: Search },
  { id: "projects", label: "Projects", icon: Boxes },
  { id: "runs", label: "Runs", icon: Play },
  { id: "workshop", label: "Workshop", icon: Archive },
  { id: "settings", label: "Settings", icon: Settings },
];

export function App() {
  const [view, setView] = useState<View>("new-task");
  const [officeOpen, setOfficeOpen] = useState(false);
  const [officeFull, setOfficeFull] = useState(new URLSearchParams(window.location.search).get("liveOffice") === "1");
  const officeTouchedRef = useRef(false);
  const { hydrate, connectEvents, approvals, activeRunId, events, appSettings, runs } = useRuntimeStore();
  const developerEnabled = appSettings?.developerMode ?? false;
  const theme = appSettings?.theme ?? "system";
  const [closePrompt, setClosePrompt] = useState(false);
  const activeRunCount = runs.filter((run) => run.status === "running" || run.status === "pending_approval").length;

  useEffect(() => {
    void updateActiveRuns(activeRunCount);
  }, [activeRunCount]);

  useEffect(() => {
    if (!("__TAURI_INTERNALS__" in window)) return;
    const unlisten = listen("desktop:close-prompt", () => setClosePrompt(true));
    return () => {
      void unlisten.then((callback) => callback());
    };
  }, []);

  useEffect(() => {
    void hydrate();
    connectEvents();
  }, [connectEvents, hydrate]);

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      const resolved = theme === "system" ? (media.matches ? "dark" : "light") : theme;
      document.documentElement.dataset.theme = resolved;
    };
    apply();
    if (theme === "system") {
      media.addEventListener("change", apply);
      return () => media.removeEventListener("change", apply);
    }
  }, [theme]);

  useEffect(() => {
    if (!appSettings || officeTouchedRef.current) return;
    setOfficeOpen(appSettings.liveOfficeDefaultOpen || officeFull);
  }, [appSettings, officeFull]);

  useEffect(() => {
    const latestEvent = events.at(-1)?.event;
    if (latestEvent?.type === "run.started" && appSettings?.liveOfficeAutoOpen) {
      setOfficeOpen(true);
    }
  }, [appSettings?.liveOfficeAutoOpen, events]);

  useEffect(() => {
    if (!("__TAURI_INTERNALS__" in window)) return;
    const unlisten = Promise.all([
      listen("desktop:show-runs", () => setView("runs")),
      listen("desktop:open-live-office", () => {
        officeTouchedRef.current = true;
        setOfficeOpen(true);
        setOfficeFull(true);
      }),
      listen("desktop:pause-all", () => {
        void useRuntimeStore.getState().pauseAllRuns();
      }),
    ]);
    return () => {
      void unlisten.then((callbacks) => {
        callbacks.forEach((callback) => callback());
      });
    };
  }, []);

  const closeOffice = () => {
    officeTouchedRef.current = true;
    setOfficeOpen(false);
    setOfficeFull(false);
  };

  const conditionalItems = useMemo(() => {
    const items: Array<{ id: View; label: string; icon: typeof Home }> = [];
    if (approvals.length > 0) items.push({ id: "approvals", label: "Approvals", icon: Shield });
    if (events.some((entry) => entry.event.type === "artifact.created")) items.push({ id: "artifacts", label: "Artifacts", icon: FileSearch });
    if (developerEnabled) items.push({ id: "developer", label: "Developer", icon: Code2 });
    return items;
  }, [approvals.length, developerEnabled, events]);

  return (
    <div className={officeOpen ? "app-shell office-visible" : "app-shell"}>
      <aside className="sidebar">
        <div className="brand">
          <img src={iconUrl} alt="" />
          <span>Yanshi</span>
        </div>
        <nav>
          {[...navItems, ...conditionalItems].map((item) => (
            <button
              key={item.id}
              className={view === item.id ? "nav-item active" : "nav-item"}
              onClick={() => setView(item.id)}
              title={item.label}
            >
              <item.icon size={18} />
              <span>{item.label}</span>
            </button>
          ))}
        </nav>
      </aside>

      <main className="main-pane">
        {view === "new-task" && <NewTaskView onRuns={() => setView("runs")} />}
        {view === "search" && <SearchView onNavigate={setView} />}
        {view === "projects" && <ProjectsView />}
        {view === "runs" && <RunsView />}
        {view === "workshop" && <WorkshopView />}
        {view === "settings" && <SettingsView />}
        {view === "approvals" && <ApprovalsView />}
        {view === "artifacts" && <ArtifactsView />}
        {view === "developer" && <DeveloperView />}
      </main>

      {officeOpen && (
        <aside className="office-pane">
          <LiveOfficePanel
            activeRunId={activeRunId}
            full={false}
            onClose={closeOffice}
            onFull={() => {
              officeTouchedRef.current = true;
              setOfficeFull(true);
              setOfficeOpen(true);
            }}
          />
        </aside>
      )}
      {officeFull && (
        <div className="office-full-view">
          <LiveOfficePanel activeRunId={activeRunId} full onClose={closeOffice} onFull={() => undefined} />
        </div>
      )}
      {appSettings && !appSettings.onboarded && <Onboarding onStart={() => setView("runs")} />}
      {closePrompt && <CloseRunsModal count={activeRunCount} onClose={() => setClosePrompt(false)} />}
    </div>
  );
}
