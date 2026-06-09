import { listen } from "@tauri-apps/api/event";
import { ArrowLeft, ArrowRight, Code2, Folder, LayoutGrid, Maximize2, PanelLeft, PanelRight, Play, Search, Shield, SquarePen } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { updateActiveRuns } from "./api/desktop";
import { AccountMenu } from "./components/account-menu";
import { CloseRunsModal, Onboarding } from "./components/modals";
import { ApprovalsView } from "./features/approvals";
import { DeveloperView } from "./features/developer";
import { LiveOfficePanel } from "./features/live-office";
import { NewTaskView } from "./features/new-task";
import { ProjectsView } from "./features/projects";
import { RunsView } from "./features/runs";
import { SearchModal } from "./features/search";
import type { SettingsSection } from "./features/settings";
import { SettingsView } from "./features/settings";
import { WorkshopView } from "./features/workshop";
import type { View } from "./lib/shared";
import { useRuntimeStore } from "./stores/runtimeStore";

const navItems: Array<{ id: View; label: string; icon: typeof Play }> = [
  { id: "new-task", label: "New Task", icon: SquarePen },
  { id: "projects", label: "Projects", icon: Folder },
  { id: "runs", label: "Runs", icon: Play },
  { id: "workshop", label: "Workshop", icon: LayoutGrid },
];

export function App() {
  const [nav, setNav] = useState<{ stack: View[]; index: number }>({ stack: ["new-task"], index: 0 });
  const view = nav.stack[nav.index];
  const canBack = nav.index > 0;
  const canForward = nav.index < nav.stack.length - 1;
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [officeOpen, setOfficeOpen] = useState(false);
  const [officeFull, setOfficeFull] = useState(new URLSearchParams(window.location.search).get("liveOffice") === "1");
  const [searchOpen, setSearchOpen] = useState(false);
  const [settingsSection, setSettingsSection] = useState<SettingsSection>("general");
  const [onboardDone, setOnboardDone] = useState(false);
  const [closePrompt, setClosePrompt] = useState(false);
  const officeTouchedRef = useRef(false);
  const { hydrate, connectEvents, approvals, activeRunId, events, appSettings, runs, saveAppSettings, createRun } = useRuntimeStore();
  const developerEnabled = appSettings?.developerMode ?? false;
  const theme = appSettings?.theme ?? "system";
  const activeRunCount = runs.filter((run) => run.status === "running" || run.status === "pending_approval").length;

  const navigate = useCallback((next: View) => {
    setNav((prev) => {
      if (prev.stack[prev.index] === next) return prev;
      const stack = [...prev.stack.slice(0, prev.index + 1), next];
      return { stack, index: stack.length - 1 };
    });
  }, []);
  const goBack = () => setNav((prev) => ({ ...prev, index: Math.max(0, prev.index - 1) }));
  const goForward = () => setNav((prev) => ({ ...prev, index: Math.min(prev.stack.length - 1, prev.index + 1) }));

  const openSettings = (section: SettingsSection) => {
    setSettingsSection(section);
    navigate("settings");
  };

  useEffect(() => {
    void updateActiveRuns(activeRunCount);
  }, [activeRunCount]);

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

  // Initial office state from settings (runs once after settings load; respects user intent).
  useEffect(() => {
    if (!appSettings || officeTouchedRef.current) return;
    setOfficeOpen(appSettings.liveOfficeDefaultOpen || officeFull);
  }, [appSettings, officeFull]);

  // Auto-open only on a FRESH run.started (avoids the launch flash from replayed historical events).
  useEffect(() => {
    const latest = events.at(-1)?.event;
    if (latest?.type !== "run.started" || !appSettings?.liveOfficeAutoOpen) return;
    const ts = Date.parse(latest.timestamp);
    if (!Number.isNaN(ts) && Date.now() - ts < 8000) setOfficeOpen(true);
  }, [appSettings?.liveOfficeAutoOpen, events]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!("__TAURI_INTERNALS__" in window)) return;
    const unlisten = listen("desktop:close-prompt", () => setClosePrompt(true));
    return () => void unlisten.then((callback) => callback());
  }, []);

  useEffect(() => {
    if (!("__TAURI_INTERNALS__" in window)) return;
    const unlisten = Promise.all([
      listen("desktop:show-runs", () => navigate("runs")),
      listen("desktop:open-live-office", () => {
        officeTouchedRef.current = true;
        setOfficeOpen(true);
        setOfficeFull(true);
      }),
      listen("desktop:pause-all", () => void useRuntimeStore.getState().pauseAllRuns()),
    ]);
    return () => void unlisten.then((callbacks) => callbacks.forEach((callback) => callback()));
  }, [navigate]);

  const closeOffice = () => {
    officeTouchedRef.current = true;
    setOfficeOpen(false);
    setOfficeFull(false);
  };

  const toggleOffice = () => {
    officeTouchedRef.current = true;
    setOfficeOpen((open) => !open);
  };

  const conditionalItems = useMemo(() => {
    const items: Array<{ id: View; label: string; icon: typeof Play }> = [];
    if (approvals.length > 0) items.push({ id: "approvals", label: "Approvals", icon: Shield });
    if (developerEnabled) items.push({ id: "developer", label: "Developer", icon: Code2 });
    return items;
  }, [approvals.length, developerEnabled]);

  // Non-blocking demo: open the (real, animated) Live Office immediately and start a real run in the
  // background so a slow/unreachable runtime can never freeze the UI.
  const dismissOnboarding = () => {
    setOnboardDone(true);
    void saveAppSettings({ onboarded: true });
  };
  const tryDemo = () => {
    setOnboardDone(true);
    void saveAppSettings({ onboarded: true });
    officeTouchedRef.current = true;
    setOfficeOpen(true);
    void createRun("List workspace files", "default", null);
    navigate("runs");
  };

  const showOnboarding = Boolean(appSettings && !appSettings.onboarded && !onboardDone);

  return (
    <div className={`app-shell${sidebarOpen ? "" : " sidebar-collapsed"}${officeOpen ? " office-visible" : ""}`}>
      <header className="titlebar" data-tauri-drag-region>
        <div className="titlebar-left">
          <button className="chrome-button" title="Toggle sidebar" onClick={() => setSidebarOpen((open) => !open)}>
            <PanelLeft size={16} />
          </button>
          <button className="chrome-button" title="Back" disabled={!canBack} onClick={goBack}>
            <ArrowLeft size={16} />
          </button>
          <button className="chrome-button" title="Forward" disabled={!canForward} onClick={goForward}>
            <ArrowRight size={16} />
          </button>
        </div>
        <div className="titlebar-right">
          <button className="chrome-button" title="Full Office View" onClick={() => { officeTouchedRef.current = true; setOfficeOpen(true); setOfficeFull(true); }}>
            <Maximize2 size={15} />
          </button>
          <button className={officeOpen ? "chrome-button active" : "chrome-button"} title="Toggle Live Office" onClick={toggleOffice}>
            <PanelRight size={16} />
          </button>
        </div>
      </header>

      {sidebarOpen && (
        <aside className="sidebar">
          <nav>
            <button className={view === "new-task" ? "nav-item active" : "nav-item"} onClick={() => navigate("new-task")} title="New Task">
              <SquarePen size={18} />
              <span>New Task</span>
            </button>
            <button className="nav-item" onClick={() => setSearchOpen(true)} title="Search">
              <Search size={18} />
              <span>Search</span>
            </button>
            {[...navItems.slice(1), ...conditionalItems].map((item) => (
              <button key={item.id} className={view === item.id ? "nav-item active" : "nav-item"} onClick={() => navigate(item.id)} title={item.label}>
                <item.icon size={18} />
                <span>{item.label}</span>
              </button>
            ))}
          </nav>
          <div className="sidebar-footer">
            <AccountMenu onOpenSettings={openSettings} />
          </div>
        </aside>
      )}

      <main className="main-pane">
        {view === "new-task" && <NewTaskView onRuns={() => navigate("runs")} />}
        {view === "projects" && <ProjectsView />}
        {view === "runs" && <RunsView />}
        {view === "workshop" && <WorkshopView />}
        {view === "settings" && <SettingsView initialSection={settingsSection} />}
        {view === "approvals" && <ApprovalsView />}
        {view === "developer" && <DeveloperView />}
      </main>

      {officeOpen && (
        <aside className="office-pane">
          <LiveOfficePanel
            activeRunId={activeRunId}
            full={false}
            onClose={closeOffice}
            onFull={() => { officeTouchedRef.current = true; setOfficeFull(true); setOfficeOpen(true); }}
          />
        </aside>
      )}
      {officeFull && (
        <div className="office-full-view">
          <LiveOfficePanel activeRunId={activeRunId} full onClose={closeOffice} onFull={() => undefined} />
        </div>
      )}
      {searchOpen && <SearchModal onClose={() => setSearchOpen(false)} onNavigate={navigate} onNewTask={() => navigate("new-task")} />}
      {showOnboarding && <Onboarding onTryDemo={tryDemo} onDismiss={dismissOnboarding} />}
      {closePrompt && <CloseRunsModal count={activeRunCount} onClose={() => setClosePrompt(false)} />}
    </div>
  );
}
