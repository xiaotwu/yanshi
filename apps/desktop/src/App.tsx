import { listen } from "@tauri-apps/api/event";
import {
  ArrowLeft,
  ArrowRight,
  ClipboardCopy,
  Code2,
  FolderPlus,
  LayoutGrid,
  LibraryBig,
  PanelLeft,
  PanelRight,
  Pencil,
  Play,
  Search,
  Settings2,
  Shield,
  Sparkles,
  SquarePen,
  Trash2,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { updateActiveRuns } from "./api/desktop";
import { AccountMenu } from "./components/account-menu";
import { useContextMenu } from "./components/context-menu";
import { CreateProjectModal } from "./components/create-project-modal";
import { CloseRunsModal, Onboarding } from "./components/modals";
import { ErrorToasts } from "./components/error-toasts";
import { ApprovalsView } from "./features/approvals";
import { DeveloperView } from "./features/developer";
import { AtelierModal, AtelierWindow } from "./features/live-office";
import { LibraryView } from "./features/library";
import { NewTaskView } from "./features/new-task";
import { ProgressPanel } from "./features/progress-panel";
import { ProjectHomeView, ProjectsView } from "./features/projects";
import { ChatView } from "./features/runs";
import { SearchModal } from "./features/search";
import type { SettingsSection } from "./features/settings";
import { SettingsModal } from "./features/settings";
import { WorkshopModal } from "./features/workshop";
import { useT } from "./i18n";
import type { TKey } from "./i18n/en";
import { ProjectGlyph, projectIcon } from "./lib/shared";
import type { View } from "./lib/shared";
import { eventToBinding, firesInEditable, isShortcutCaptureActive, resolveBindings } from "./lib/shortcuts";
import { useRuntimeStore } from "./stores/runtimeStore";

// Primary navigation: Library replaces the old technical "Runs" page (run records still exist in
// the runtime; task details open from Recents and project task lists).
const navItems: Array<{ id: View; key: TKey; icon: typeof Play }> = [
  { id: "library", key: "nav.library", icon: LibraryBig },
];

const IS_POPOUT = new URLSearchParams(window.location.search).get("liveOffice") === "1";

export function App() {
  const { t } = useT();
  const [nav, setNav] = useState<{ stack: View[]; index: number }>({ stack: ["new-task"], index: 0 });
  const view = nav.stack[nav.index];
  const canBack = nav.index > 0;
  const canForward = nav.index < nav.stack.length - 1;
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [progressOpen, setProgressOpen] = useState(false);
  const [atelierOpen, setAtelierOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState<SettingsSection | null>(null);
  const [onboardDone, setOnboardDone] = useState(false);
  const [closePrompt, setClosePrompt] = useState(false);
  const [newProjectOpen, setNewProjectOpen] = useState(false);
  const [workshopOpen, setWorkshopOpen] = useState(false);
  const progressTouchedRef = useRef(false);
  const { hydrate, connectEvents, approvals, events, appSettings, runs, projects, setActiveProject, setActiveRun, saveAppSettings, createRun, deleteProject } =
    useRuntimeStore();
  const activeRunId = useRuntimeStore((state) => state.activeRunId);
  const developerEnabled = appSettings?.developerMode ?? false;
  const theme = appSettings?.theme ?? "system";
  const gpuAcceleration = appSettings?.gpuAcceleration ?? true;
  const activeRunCount = runs.filter((run) => run.status === "running" || run.status === "pending_approval").length;
  const { openContextMenu, contextMenu } = useContextMenu();

  const navigate = useCallback((next: View) => {
    setNav((prev) => {
      if (prev.stack[prev.index] === next) return prev;
      const stack = [...prev.stack.slice(0, prev.index + 1), next];
      return { stack, index: stack.length - 1 };
    });
  }, []);
  const goBack = () => setNav((prev) => ({ ...prev, index: Math.max(0, prev.index - 1) }));
  const goForward = () => setNav((prev) => ({ ...prev, index: Math.min(prev.stack.length - 1, prev.index + 1) }));

  const openSettings = useCallback((section: SettingsSection) => setSettingsOpen(section), []);

  const openProject = useCallback(
    (projectId: string) => {
      setActiveProject(projectId);
      navigate("project");
    },
    [navigate, setActiveProject],
  );

  const openTask = useCallback(
    (runId: string) => {
      setActiveRun(runId);
      navigate("runs");
    },
    [navigate, setActiveRun],
  );

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

  // GPU Acceleration setting gates the visual-effect tier (glow/blur/heavy transitions in CSS,
  // render quality in the Atelier). It does not control the OS GPU — honest scope.
  useEffect(() => {
    document.documentElement.dataset.fx = gpuAcceleration ? "rich" : "reduced";
  }, [gpuAcceleration]);

  // Initial progress-panel state from settings (runs once after settings load).
  useEffect(() => {
    if (!appSettings || progressTouchedRef.current) return;
    setProgressOpen(appSettings.liveOfficeDefaultOpen);
  }, [appSettings]);

  // Auto-open the progress panel only on a FRESH run.started (avoids launch flash from replayed events).
  useEffect(() => {
    const latest = events.at(-1)?.event;
    if (latest?.type !== "run.started" || !appSettings?.liveOfficeAutoOpen) return;
    const ts = Date.parse(latest.timestamp);
    if (!Number.isNaN(ts) && Date.now() - ts < 8000) setProgressOpen(true);
  }, [appSettings?.liveOfficeAutoOpen, events]);

  const toggleProgress = useCallback(() => {
    progressTouchedRef.current = true;
    setProgressOpen((open) => !open);
  }, []);

  // App-wide shortcut dispatcher: defaults + user overrides from settings. Submit-task is handled
  // inside the composer (Enter / Meta+Enter); everything else dispatches here.
  const bindings = useMemo(() => resolveBindings(appSettings?.shortcuts ?? {}), [appSettings?.shortcuts]);
  useEffect(() => {
    const focusComposer = () => {
      if (view !== "new-task" && view !== "project") navigate("new-task");
      window.setTimeout(() => window.dispatchEvent(new Event("yanshi:focus-composer")), 60);
    };
    const commands: Record<string, () => void> = {
      "new-task": () => navigate("new-task"),
      "open-search": () => setSearchOpen(true),
      "open-settings": () => setSettingsOpen("general"),
      "open-projects": () => navigate("projects"),
      "new-project": () => setNewProjectOpen(true),
      "open-library": () => navigate("library"),
      "open-workshop": () => setWorkshopOpen(true),
      "open-task-details": () => navigate("runs"),
      "open-atelier": () => setAtelierOpen(true),
      "toggle-progress": toggleProgress,
      "toggle-sidebar": () => setSidebarOpen((open) => !open),
      "focus-composer": focusComposer,
      "upload-file": () => window.dispatchEvent(new Event("yanshi:upload-file")),
      "pause-all": () => void useRuntimeStore.getState().pauseAllRuns(),
      "open-developer": () => (developerEnabled ? navigate("developer") : setSettingsOpen("general")),
    };
    const onKey = (event: KeyboardEvent) => {
      // The shortcut editor is capturing a chord — no command may fire.
      if (isShortcutCaptureActive()) return;
      const binding = eventToBinding(event);
      if (!binding) return;
      let commandId: string | null = null;
      for (const [id, bound] of bindings) {
        if (bound === binding) {
          commandId = id;
          break;
        }
      }
      if (!commandId || commandId === "submit-task" || !(commandId in commands)) return;
      const target = event.target as HTMLElement;
      const editable = target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable;
      if (editable && !firesInEditable(binding)) return;
      event.preventDefault();
      commands[commandId]();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [bindings, developerEnabled, navigate, toggleProgress, view]);

  useEffect(() => {
    if (!("__TAURI_INTERNALS__" in window)) return;
    const unlisten = listen("desktop:close-prompt", () => setClosePrompt(true));
    return () => void unlisten.then((callback) => callback());
  }, []);

  useEffect(() => {
    if (!("__TAURI_INTERNALS__" in window)) return;
    const unlisten = Promise.all([
      listen("desktop:show-runs", () => navigate("runs")),
      listen("desktop:open-live-office", () => setAtelierOpen(true)),
      listen("desktop:pause-all", () => void useRuntimeStore.getState().pauseAllRuns()),
    ]);
    return () => void unlisten.then((callbacks) => callbacks.forEach((callback) => callback()));
  }, [navigate]);

  const conditionalItems = useMemo(() => {
    const items: Array<{ id: View; key: TKey; icon: typeof Play }> = [];
    if (approvals.length > 0) items.push({ id: "approvals", key: "nav.approvals", icon: Shield });
    if (developerEnabled) items.push({ id: "developer", key: "nav.developer", icon: Code2 });
    return items;
  }, [approvals.length, developerEnabled]);

  // Recents: latest runs first (standalone + project), always shown below Projects.
  const recents = useMemo(
    () => [...runs].sort((a, b) => (b.updatedAt ?? "").localeCompare(a.updatedAt ?? "")).slice(0, 8),
    [runs],
  );

  // Non-blocking demo: open the (real, animated) Atelier + progress panel immediately and start a real
  // run in the background so a slow/unreachable runtime can never freeze the UI.
  const dismissOnboarding = () => {
    setOnboardDone(true);
    void saveAppSettings({ onboarded: true });
  };
  const tryDemo = () => {
    setOnboardDone(true);
    void saveAppSettings({ onboarded: true });
    progressTouchedRef.current = true;
    setProgressOpen(true);
    setAtelierOpen(true);
    void createRun("List workspace files", "default", null);
    navigate("runs");
  };

  const projectContextItems = (project: (typeof projects)[number]) => [
    { id: "open", label: t("menu.open"), icon: Play, onSelect: () => openProject(project.id) },
    {
      id: "new-task",
      label: t("project.newTaskHere"),
      icon: SquarePen,
      onSelect: () => {
        openProject(project.id);
        window.setTimeout(() => window.dispatchEvent(new Event("yanshi:focus-composer")), 80);
      },
    },
    { id: "atelier", label: t("chrome.toggleAtelier"), icon: Sparkles, onSelect: () => { setActiveProject(project.id); setAtelierOpen(true); } },
    "divider" as const,
    {
      id: "rename",
      label: t("menu.rename"),
      icon: Pencil,
      onSelect: () => {
        openProject(project.id);
        window.setTimeout(() => window.dispatchEvent(new CustomEvent("yanshi:project-panel", { detail: "settings" })), 80);
      },
    },
    {
      id: "settings",
      label: t("project.settings"),
      icon: Settings2,
      onSelect: () => {
        openProject(project.id);
        window.setTimeout(() => window.dispatchEvent(new CustomEvent("yanshi:project-panel", { detail: "settings" })), 80);
      },
    },
    "divider" as const,
    {
      id: "delete",
      label: t("project.delete"),
      icon: Trash2,
      danger: true,
      onSelect: () => {
        if (window.confirm(t("project.deleteConfirm", { name: project.name }))) void deleteProject(project.id);
      },
    },
  ];

  const recentContextItems = (run: (typeof runs)[number]) => [
    { id: "open", label: t("menu.open"), icon: Play, onSelect: () => openTask(run.id) },
    { id: "copy", label: t("menu.copyTask"), icon: ClipboardCopy, onSelect: () => void navigator.clipboard.writeText(run.task) },
    { id: "library", label: t("menu.showInLibrary"), icon: LibraryBig, onSelect: () => navigate("library") },
    "divider" as const,
    {
      id: "delete",
      label: t("menu.delete"),
      icon: Trash2,
      danger: true,
      disabled: true,
      disabledReason: t("menu.notSupported"),
      onSelect: () => undefined,
    },
  ];

  if (IS_POPOUT) return <AtelierWindow />;

  const showOnboarding = Boolean(appSettings && !appSettings.onboarded && !onboardDone);

  return (
    <div className={`app-shell${sidebarOpen ? "" : " sidebar-collapsed"}${progressOpen ? " office-visible" : ""}`}>
      <header className="titlebar" data-tauri-drag-region>
        <div className="titlebar-left">
          <button className="chrome-button" title={t("chrome.toggleSidebar")} onClick={() => setSidebarOpen((open) => !open)}>
            <PanelLeft size={16} />
          </button>
          <button className="chrome-button" title={t("chrome.back")} disabled={!canBack} onClick={goBack}>
            <ArrowLeft size={16} />
          </button>
          <button className="chrome-button" title={t("chrome.forward")} disabled={!canForward} onClick={goForward}>
            <ArrowRight size={16} />
          </button>
        </div>
        <div className="titlebar-right">
          <button className={atelierOpen ? "chrome-button active" : "chrome-button"} title={t("chrome.toggleAtelier")} onClick={() => setAtelierOpen(true)}>
            <Sparkles size={16} />
          </button>
          <button className={progressOpen ? "chrome-button active" : "chrome-button"} title={t("chrome.toggleProgress")} onClick={toggleProgress}>
            <PanelRight size={16} />
          </button>
        </div>
      </header>

      {/* Always mounted so collapse/expand animates (grid column transition); inert + aria-hidden
          while collapsed so nothing inside stays focusable. */}
      <aside className="sidebar" aria-hidden={!sidebarOpen} inert={sidebarOpen ? undefined : true}>
          <nav>
            <button className={view === "new-task" ? "nav-item active" : "nav-item"} onClick={() => navigate("new-task")} title={t("nav.newTask")}>
              <SquarePen size={18} />
              <span>{t("nav.newTask")}</span>
            </button>
            <button className="nav-item" onClick={() => setSearchOpen(true)} title={t("nav.search")}>
              <Search size={18} />
              <span>{t("nav.search")}</span>
            </button>
            {[...navItems, ...conditionalItems].map((item) => (
              <button key={item.id} className={view === item.id ? "nav-item active" : "nav-item"} onClick={() => navigate(item.id)} title={t(item.key)}>
                <item.icon size={18} />
                <span>{t(item.key)}</span>
              </button>
            ))}
            <button className={workshopOpen ? "nav-item active" : "nav-item"} onClick={() => setWorkshopOpen(true)} title={t("nav.workshop")}>
              <LayoutGrid size={18} />
              <span>{t("nav.workshop")}</span>
            </button>
          </nav>

          <div className="sidebar-scroll">
            <div className="sidebar-section">
              <button className="sidebar-section-label as-button" onClick={() => navigate("projects")}>{t("nav.projects")}</button>
              <button className="nav-item subtle" onClick={() => setNewProjectOpen(true)} title={t("nav.newProject")}>
                <FolderPlus size={17} />
                <span>{t("nav.newProject")}</span>
              </button>
              {projects.map((project) => (
                <button
                  key={project.id}
                  className={view === "project" && project.id === useRuntimeStore.getState().activeProjectId ? "nav-item subtle active" : "nav-item subtle"}
                  onClick={() => openProject(project.id)}
                  onContextMenu={(event) => openContextMenu(event, projectContextItems(project))}
                  title={project.name}
                >
                  <ProjectGlyph project={project} />
                  <span className="ellipsis">{project.name}</span>
                </button>
              ))}
            </div>

            <div className="sidebar-section">
              <div className="sidebar-section-label">{t("nav.recents")}</div>
              {recents.length === 0 ? (
                <div className="sidebar-empty muted">{t("project.noRuns")}</div>
              ) : (
                recents.map((run) => {
                  const project = run.projectId ? projects.find((p) => p.id === run.projectId) : null;
                  return (
                    <button
                      key={run.id}
                      className={view === "runs" && run.id === activeRunId ? "recent-item active" : "recent-item"}
                      onClick={() => openTask(run.id)}
                      onContextMenu={(event) => openContextMenu(event, recentContextItems(run))}
                      title={run.task}
                    >
                      <span className="ellipsis">{run.task}</span>
                      {project && <small className="recent-project ellipsis">{projectIcon(project)} {project.name}</small>}
                    </button>
                  );
                })
              )}
            </div>
          </div>

          <div className="sidebar-footer">
            <AccountMenu onOpenSettings={openSettings} />
          </div>
      </aside>

      <main className="main-pane">
        {view === "new-task" && <NewTaskView onRuns={() => navigate("runs")} />}
        {view === "projects" && <ProjectsView onOpenProject={openProject} />}
        {view === "project" && <ProjectHomeView onOpenTask={openTask} />}
        {view === "runs" && <ChatView onNewChat={() => navigate("new-task")} />}
        {view === "library" && <LibraryView onOpenTask={openTask} />}
        {view === "approvals" && <ApprovalsView />}
        {view === "developer" && <DeveloperView />}
      </main>

      {progressOpen && (
        <aside className="office-pane">
          <ProgressPanel />
        </aside>
      )}
      {atelierOpen && <AtelierModal onClose={() => setAtelierOpen(false)} />}
      {workshopOpen && <WorkshopModal onClose={() => setWorkshopOpen(false)} />}
      {searchOpen && <SearchModal onClose={() => setSearchOpen(false)} onNavigate={navigate} onNewTask={() => navigate("new-task")} onOpenWorkshop={() => { setSearchOpen(false); setWorkshopOpen(true); }} />}
      {settingsOpen && <SettingsModal initialSection={settingsOpen} onClose={() => setSettingsOpen(null)} />}
      {newProjectOpen && <CreateProjectModal onClose={() => setNewProjectOpen(false)} onCreated={(id) => { setNewProjectOpen(false); openProject(id); }} />}
      {showOnboarding && <Onboarding onTryDemo={tryDemo} onDismiss={dismissOnboarding} />}
      {closePrompt && <CloseRunsModal count={activeRunCount} onClose={() => setClosePrompt(false)} />}
      <ErrorToasts onOpenSettings={openSettings} />
      {contextMenu}
    </div>
  );
}
