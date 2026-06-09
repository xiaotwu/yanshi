import { listen } from "@tauri-apps/api/event";
import type { MacosPermissionStatus } from "@yanshi/shared";
import {
  Archive,
  Boxes,
  Check,
  ChevronDown,
  Code2,
  ExternalLink,
  FileSearch,
  FolderOpen,
  Globe,
  Home,
  ListChecks,
  Loader2,
  Maximize2,
  Mic,
  MonitorSmartphone,
  Play,
  Plus,
  Search,
  Send,
  Settings,
  Shield,
  TerminalSquare,
  X,
} from "lucide-react";
import { Fragment, lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";

import iconUrl from "../../../icon.png";
import { runtimeApi } from "./api/client";
import { canRevealFiles, openDesktopRuntimeLogs, popOutLiveOffice, revealPath } from "./api/desktop";
import { useRuntimeStore } from "./stores/runtimeStore";

type View = "new-task" | "search" | "projects" | "runs" | "workshop" | "settings" | "approvals" | "artifacts" | "developer";
type PermissionMode = "default" | "auto_review" | "full_access";

const LiveOfficeScene = lazy(() => import("@yanshi/live-office").then((module) => ({ default: module.LiveOfficeScene })));

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
  const { hydrate, connectEvents, approvals, activeRunId, events, appSettings } = useRuntimeStore();
  const developerEnabled = appSettings?.developerMode ?? false;
  const theme = appSettings?.theme ?? "light";

  useEffect(() => {
    void hydrate();
    connectEvents();
  }, [connectEvents, hydrate]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
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
    </div>
  );
}

function Onboarding({ onStart }: { onStart: () => void }) {
  const { saveAppSettings, createRun } = useRuntimeStore();
  const [busy, setBusy] = useState(false);

  const dismiss = () => void saveAppSettings({ onboarded: true });
  const tryDemo = async () => {
    setBusy(true);
    await saveAppSettings({ onboarded: true });
    await createRun("List workspace files", "default", null);
    setBusy(false);
    onStart();
  };

  return (
    <div className="modal-overlay">
      <div className="onboarding-card">
        <img src={iconUrl} alt="" />
        <h2>Welcome to Yanshi</h2>
        <p>Give a task in plain words. Virtual workers plan, act, and show their progress.</p>
        <div className="onboarding-actions">
          <button className="primary" onClick={() => void tryDemo()} disabled={busy}>
            {busy ? <Loader2 className="spin" size={16} /> : "Try a demo"}
          </button>
          <button onClick={dismiss} disabled={busy}>
            Not now
          </button>
        </div>
      </div>
    </div>
  );
}

const TOOL_HINTS: Record<string, string> = {
  browser: "Use the browser.",
  computer: "Use the computer.",
  terminal: "Use the terminal.",
};

function NewTaskView({ onRuns }: { onRuns: () => void }) {
  const [task, setTask] = useState("");
  const { createRun, loading, error, appSettings, projects, activeProjectId } = useRuntimeStore();
  const [permissionMode, setPermissionMode] = useState<PermissionMode>(appSettings?.permissionModeDefault ?? "default");
  const [selectedProjectId, setSelectedProjectId] = useState(activeProjectId ?? "standalone");
  const [planFirst, setPlanFirst] = useState(false);
  const [tools, setTools] = useState<string[]>([]);
  const [plusOpen, setPlusOpen] = useState(false);
  const { listening, voiceAvailable, toggleVoice } = useVoiceInput((text) => setTask((prev) => (prev ? `${prev} ${text}` : text)));

  useEffect(() => {
    if (appSettings?.permissionModeDefault) setPermissionMode(appSettings.permissionModeDefault);
  }, [appSettings?.permissionModeDefault]);

  useEffect(() => {
    if (selectedProjectId !== "standalone" && !projects.some((project) => project.id === selectedProjectId)) {
      setSelectedProjectId("standalone");
    }
  }, [projects, selectedProjectId]);

  const toggleTool = (tool: string) =>
    setTools((prev) => (prev.includes(tool) ? prev.filter((item) => item !== tool) : [...prev, tool]));

  const submit = async () => {
    if (!task.trim()) return;
    const directives = tools.map((tool) => TOOL_HINTS[tool]).join(" ");
    const composed = directives ? `${task.trim()} ${directives}` : task.trim();
    await createRun(composed, permissionMode, selectedProjectId === "standalone" ? null : selectedProjectId, planFirst);
    setTask("");
    setTools([]);
    setPlanFirst(false);
    onRuns();
  };

  return (
    <section className="center-stage">
      <div className="composer-wrap">
        <h1>How can Yanshi help you today?</h1>
        <div className="composer">
          <div className="plus-wrap">
            <button
              className={plusOpen ? "icon-button active" : "icon-button"}
              title="Add"
              onClick={() => setPlusOpen((open) => !open)}
            >
              <Plus size={18} />
            </button>
            {plusOpen && (
              <div className="plus-menu" onMouseLeave={() => setPlusOpen(false)}>
                <button className={planFirst ? "menu-row on" : "menu-row"} onClick={() => setPlanFirst((value) => !value)}>
                  <ListChecks size={15} /> Plan first {planFirst && <Check size={14} />}
                </button>
                <div className="menu-divider" />
                <button className={tools.includes("browser") ? "menu-row on" : "menu-row"} onClick={() => toggleTool("browser")}>
                  <Globe size={15} /> Use Browser {tools.includes("browser") && <Check size={14} />}
                </button>
                <button className={tools.includes("computer") ? "menu-row on" : "menu-row"} onClick={() => toggleTool("computer")}>
                  <MonitorSmartphone size={15} /> Use Computer {tools.includes("computer") && <Check size={14} />}
                </button>
                <button className={tools.includes("terminal") ? "menu-row on" : "menu-row"} onClick={() => toggleTool("terminal")}>
                  <TerminalSquare size={15} /> Use Terminal {tools.includes("terminal") && <Check size={14} />}
                </button>
              </div>
            )}
          </div>
          <textarea
            value={task}
            onChange={(event) => setTask(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                void submit();
              }
            }}
            placeholder="Ask Yanshi to do anything..."
            rows={1}
          />
          <label className="select-chip" title="Permission">
            <Shield size={15} />
            <select value={permissionMode} onChange={(event) => setPermissionMode(event.target.value as PermissionMode)}>
              <option value="default">Default</option>
              <option value="auto_review">Auto-review</option>
              <option value="full_access">Full access</option>
            </select>
            <ChevronDown size={14} />
          </label>
          <label className="select-chip" title="Project">
            <Boxes size={15} />
            <select value={selectedProjectId} onChange={(event) => setSelectedProjectId(event.target.value)}>
              <option value="standalone">Standalone</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
            <ChevronDown size={14} />
          </label>
          <button
            className={listening ? "icon-button active" : "icon-button"}
            title={voiceAvailable ? (listening ? "Stop" : "Voice") : "Voice input unavailable"}
            onClick={toggleVoice}
            disabled={!voiceAvailable}
          >
            <Mic size={18} />
          </button>
          <button className="send-button" onClick={() => void submit()} disabled={loading || !task.trim()} title="Run">
            {loading ? <Loader2 className="spin" size={18} /> : <Send size={18} />}
          </button>
        </div>
        {(planFirst || tools.length > 0) && (
          <div className="composer-flags">
            {planFirst && <span className="flag-chip">Plan first</span>}
            {tools.map((tool) => (
              <span key={tool} className="flag-chip">
                {tool}
              </span>
            ))}
          </div>
        )}
        {error && <p className="inline-error">{error}</p>}
        <div className="templates">
          {["Organize files", "Research a topic", "Summarize webpage", "Use computer", "Create report", "Plan my day"].map((label) => (
            <button key={label} onClick={() => setTask(label)}>
              {label}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onend: (() => void) | null;
}

function useVoiceInput(onText: (text: string) => void) {
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const Impl = (window as unknown as { webkitSpeechRecognition?: new () => SpeechRecognitionLike; SpeechRecognition?: new () => SpeechRecognitionLike })
    .webkitSpeechRecognition ?? (window as unknown as { SpeechRecognition?: new () => SpeechRecognitionLike }).SpeechRecognition;
  const voiceAvailable = Boolean(Impl);

  const toggleVoice = () => {
    if (!Impl) return;
    if (listening) {
      recognitionRef.current?.stop();
      return;
    }
    const recognition = new Impl();
    recognition.lang = "en-US";
    recognition.interimResults = false;
    recognition.onresult = (event) => {
      const transcript = event.results[0]?.[0]?.transcript;
      if (transcript) onText(transcript.trim());
    };
    recognition.onend = () => setListening(false);
    recognitionRef.current = recognition;
    recognition.start();
    setListening(true);
  };

  return { listening, voiceAvailable, toggleVoice };
}

function ProjectsView() {
  const { projects, runs, activeProjectId, setActiveProject, createProject, updateProject, deleteProject, loading, error } = useRuntimeStore();
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const selectedProject = projects.find((project) => project.id === activeProjectId) ?? projects[0] ?? null;
  const [editName, setEditName] = useState(selectedProject?.name ?? "");
  const [editDescription, setEditDescription] = useState(selectedProject?.description ?? "");
  const projectRuns = selectedProject ? runs.filter((run) => run.projectId === selectedProject.id) : [];

  useEffect(() => {
    if (!activeProjectId && projects[0]) setActiveProject(projects[0].id);
  }, [activeProjectId, projects, setActiveProject]);

  useEffect(() => {
    setEditName(selectedProject?.name ?? "");
    setEditDescription(selectedProject?.description ?? "");
  }, [selectedProject]);

  const submitProject = async () => {
    if (!newName.trim()) return;
    await createProject(newName.trim(), newDescription.trim() || undefined);
    setNewName("");
    setNewDescription("");
  };

  const saveProject = async () => {
    if (!selectedProject || !editName.trim()) return;
    await updateProject(selectedProject.id, {
      name: editName.trim(),
      description: editDescription.trim(),
      settings: selectedProject.settings,
    });
  };

  const removeProject = async () => {
    if (!selectedProject) return;
    const confirmed = window.confirm(`Delete ${selectedProject.name}? Runs stay in history and the workspace folder is left in place.`);
    if (confirmed) await deleteProject(selectedProject.id);
  };

  return (
    <section className="project-grid">
      <div className="project-list">
        <header className="section-head">
          <h2>Projects</h2>
          <span>{projects.length}</span>
        </header>
        <div className="project-form">
          <input value={newName} onChange={(event) => setNewName(event.target.value)} placeholder="Project name" />
          <textarea
            value={newDescription}
            onChange={(event) => setNewDescription(event.target.value)}
            placeholder="Description"
            rows={2}
          />
          <button onClick={() => void submitProject()} disabled={loading || !newName.trim()} title="Create project">
            <Plus size={16} />
            Create
          </button>
        </div>
        {error && <p className="inline-error">{error}</p>}
        <div className="project-items">
          {projects.map((project) => (
            <button
              key={project.id}
              className={project.id === selectedProject?.id ? "project-row active" : "project-row"}
              onClick={() => setActiveProject(project.id)}
              title={project.name}
            >
              <FolderOpen size={17} />
              <span>{project.name}</span>
              <small>{runs.filter((run) => run.projectId === project.id).length}</small>
            </button>
          ))}
        </div>
      </div>
      <div className="project-detail">
        {selectedProject ? (
          <ProjectWorkspace
            project={selectedProject}
            runs={projectRuns}
            editName={editName}
            editDescription={editDescription}
            setEditName={setEditName}
            setEditDescription={setEditDescription}
            onSave={saveProject}
            onDelete={removeProject}
            loading={loading}
          />
        ) : (
          <div className="empty-inline">
            <h2>Projects</h2>
            <p>Create a project to bind runs to a real workspace.</p>
          </div>
        )}
      </div>
    </section>
  );
}

type ProjectTab = "overview" | "runs" | "files" | "artifacts" | "automations" | "office" | "activity" | "settings";

function ProjectWorkspace({
  project,
  runs,
  editName,
  editDescription,
  setEditName,
  setEditDescription,
  onSave,
  onDelete,
  loading,
}: {
  project: import("@yanshi/shared").ProjectSummary;
  runs: import("@yanshi/shared").RunSummary[];
  editName: string;
  editDescription: string;
  setEditName: (value: string) => void;
  setEditDescription: (value: string) => void;
  onSave: () => void;
  onDelete: () => void;
  loading: boolean;
}) {
  const { events, setActiveRun } = useRuntimeStore();
  const [tab, setTab] = useState<ProjectTab>("overview");
  const projectEvents = events.filter((entry) => entry.event.projectId === project.id);
  const artifacts = projectEvents.filter((entry) => entry.event.type === "artifact.created");

  const tabs: Array<{ id: ProjectTab; label: string }> = [
    { id: "overview", label: "Overview" },
    { id: "runs", label: "Runs" },
    { id: "files", label: "Files" },
    { id: "artifacts", label: "Artifacts" },
    { id: "automations", label: "Automations" },
    { id: "office", label: "Live Office" },
    { id: "activity", label: "Activity" },
    { id: "settings", label: "Settings" },
  ];

  return (
    <>
      <header className="view-header">
        <div>
          <h2>{project.name}</h2>
          <span className="status-pill">{runs.length} runs</span>
        </div>
      </header>
      <div className="project-tabs">
        {tabs.map((item) => (
          <button key={item.id} className={tab === item.id ? "active" : ""} onClick={() => setTab(item.id)}>
            {item.label}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <dl className="runtime-details">
          {project.description && (
            <>
              <dt>About</dt>
              <dd>{project.description}</dd>
            </>
          )}
          <dt>Workspace</dt>
          <dd>{project.workspacePath}</dd>
          <dt>Runs</dt>
          <dd>{runs.length}</dd>
          <dt>Artifacts</dt>
          <dd>{artifacts.length}</dd>
          <dt>Agents</dt>
          <dd>{project.agentTeamId ? "Project team" : "Global team"}</dd>
        </dl>
      )}

      {tab === "runs" && (
        <div className="event-feed">
          {runs.length === 0 ? (
            <p className="transcript-empty">No runs yet.</p>
          ) : (
            runs.map((run) => (
              <button key={run.id} className="event-card" onClick={() => setActiveRun(run.id)} style={{ textAlign: "left" }}>
                <span>{run.status.replace("_", " ")}</span>
                <p>{run.task}</p>
              </button>
            ))
          )}
        </div>
      )}

      {tab === "files" && <ProjectFiles projectId={project.id} />}

      {tab === "automations" && <AutomationsPanel projectId={project.id} />}

      {tab === "office" && <ProjectOffice projectId={project.id} />}

      {tab === "artifacts" && (
        <div className="event-feed">
          {artifacts.length === 0 ? (
            <p className="transcript-empty">No artifacts yet.</p>
          ) : (
            artifacts.map(({ seq, event }) => (
              <article key={seq} className="event-card">
                <span>{String(event.payload.kind ?? "Artifact")}</span>
                <strong>{String(event.payload.title ?? "Artifact")}</strong>
                <p>{String(event.payload.summary ?? "")}</p>
              </article>
            ))
          )}
        </div>
      )}

      {tab === "activity" && (
        <div className="event-feed">
          {projectEvents.length === 0 ? (
            <p className="transcript-empty">No activity yet.</p>
          ) : (
            projectEvents
              .slice(-40)
              .reverse()
              .map(({ seq, event }) => (
                <article key={seq} className="event-card">
                  <span>{event.type}</span>
                  <p>{eventSummary(event.payload)}</p>
                </article>
              ))
          )}
        </div>
      )}

      {tab === "settings" && (
        <>
          <div className="settings-form project-edit">
            <label>
              Name
              <input value={editName} onChange={(event) => setEditName(event.target.value)} />
            </label>
            <label>
              Description
              <input value={editDescription} onChange={(event) => setEditDescription(event.target.value)} />
            </label>
          </div>
          <div className="settings-actions">
            <button onClick={onSave} disabled={loading || !editName.trim()}>
              Save
            </button>
            <button className="danger-text" onClick={onDelete} disabled={loading}>
              Delete project
            </button>
          </div>
        </>
      )}
    </>
  );
}

function AutomationsPanel({ projectId }: { projectId: string }) {
  const [automations, setAutomations] = useState<import("@yanshi/shared").AutomationSummary[] | null>(null);
  const [name, setName] = useState("");
  const [task, setTask] = useState("");
  const [interval, setIntervalValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = () => runtimeApi.automations(projectId).then(setAutomations).catch(() => setAutomations([]));

  useEffect(() => {
    let cancelled = false;
    runtimeApi
      .automations(projectId)
      .then((items) => !cancelled && setAutomations(items))
      .catch(() => !cancelled && setAutomations([]));
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const create = async () => {
    if (!name.trim() || !task.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const minutes = interval.trim() ? Number(interval.trim()) : null;
      await runtimeApi.createAutomation({
        name: name.trim(),
        task: task.trim(),
        projectId,
        scheduleKind: minutes ? "interval" : "manual",
        intervalMinutes: minutes,
      });
      setName("");
      setTask("");
      setIntervalValue("");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create automation.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="automations">
      <div className="automation-form">
        <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Name" />
        <input value={task} onChange={(event) => setTask(event.target.value)} placeholder="Task" />
        <input value={interval} onChange={(event) => setIntervalValue(event.target.value)} placeholder="Every N min (optional)" inputMode="numeric" />
        <button onClick={() => void create()} disabled={busy || !name.trim() || !task.trim()}>
          <Plus size={15} /> Add
        </button>
      </div>
      {error && <p className="inline-error">{error}</p>}
      {!automations ? (
        <p className="muted">Loading…</p>
      ) : automations.length === 0 ? (
        <p className="transcript-empty">No automations yet.</p>
      ) : (
        <div className="file-list">
          {automations.map((automation) => (
            <AutomationRow key={automation.id} automation={automation} onChanged={refresh} />
          ))}
        </div>
      )}
    </div>
  );
}

function AutomationRow({ automation, onChanged }: { automation: import("@yanshi/shared").AutomationSummary; onChanged: () => Promise<void> | void }) {
  const [busy, setBusy] = useState(false);
  const schedule = automation.scheduleKind === "interval" ? `every ${automation.intervalMinutes}m` : "manual";

  const act = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await fn();
    } finally {
      setBusy(false);
      await onChanged();
    }
  };

  return (
    <div className="automation-row">
      <div className="automation-main">
        <strong>{automation.name}</strong>
        <small>
          {schedule}
          {automation.lastRunAt ? ` · last ${new Date(automation.lastRunAt).toLocaleTimeString()}` : ""}
        </small>
      </div>
      <button className="ghost-button" disabled={busy} title="Run now" onClick={() => void act(() => runtimeApi.runAutomation(automation.id))}>
        <Play size={15} /> Run
      </button>
      <label className="switch" title={automation.enabled ? "Enabled" : "Disabled"}>
        <input
          type="checkbox"
          checked={automation.enabled}
          disabled={busy}
          onChange={(event) => void act(() => runtimeApi.updateAutomation(automation.id, { enabled: event.target.checked }))}
        />
      </label>
      <button className="ghost-button danger-text" disabled={busy} title="Delete" onClick={() => void act(() => runtimeApi.deleteAutomation(automation.id))}>
        <X size={15} />
      </button>
    </div>
  );
}

function ProjectOffice({ projectId }: { projectId: string }) {
  const { liveAgents } = useRuntimeStore();
  const [office, setOffice] = useState<import("@yanshi/shared").LiveOfficeStateSummary | null>(null);

  useEffect(() => {
    let cancelled = false;
    runtimeApi
      .liveOffice(projectId)
      .then((state) => !cancelled && setOffice(state))
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const update = async (patch: Partial<import("@yanshi/shared").LiveOfficeStateSummary>) => {
    const next = await runtimeApi.updateLiveOffice(projectId, patch);
    setOffice(next);
  };

  if (!office) return <p className="muted">Loading office…</p>;

  return (
    <div className="content-stack" style={{ padding: 0 }}>
      <div className="office-editor-grid">
        <label className="setting-row">
          <span>Behavior</span>
          <select value={office.behaviorMode} onChange={(event) => void update({ behaviorMode: event.target.value as import("@yanshi/shared").BehaviorMode })}>
            {BEHAVIOR_OPTIONS.map((mode) => (
              <option key={mode} value={mode}>
                {mode}
              </option>
            ))}
          </select>
        </label>
        <label className="setting-row">
          <span>Camera</span>
          <select value={office.cameraMode} onChange={(event) => void update({ cameraMode: event.target.value as import("@yanshi/shared").CameraMode })}>
            <option value="rear">Rear</option>
            <option value="iso">Isometric</option>
          </select>
        </label>
      </div>
      <div className="office-canvas" style={{ height: 320 }}>
        <Suspense fallback={<div className="scene-loading">Loading office</div>}>
          <LiveOfficeScene agents={liveAgents} compact cameraMode={office.cameraMode} stationLayout={office.stationLayout} />
        </Suspense>
      </div>
    </div>
  );
}

function ProjectFiles({ projectId }: { projectId: string }) {
  const [files, setFiles] = useState<import("@yanshi/shared").WorkspaceFile[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setFiles(null);
    setError(null);
    runtimeApi
      .projectFiles(projectId)
      .then((result) => {
        if (cancelled) return;
        setFiles(result.structuredOutput.items ?? []);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Could not load files.");
      });
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  if (error) return <p className="inline-error">{error}</p>;
  if (!files) return <p className="muted">Loading files…</p>;
  if (files.length === 0) return <p className="transcript-empty">No files in this workspace yet.</p>;

  return (
    <div className="file-list">
      {files.map((file) => (
        <div key={file.path} className="file-row">
          {file.type === "directory" ? <FolderOpen size={15} /> : <FileSearch size={15} />}
          <span>{file.name}</span>
          <small>{file.type === "file" && typeof file.size === "number" ? `${file.size} B` : ""}</small>
        </div>
      ))}
    </div>
  );
}

const TRANSCRIPT_EVENT_TYPES = new Set(["observation.created", "artifact.created"]);
type RunGrouping = "time" | "project" | "status";

function RunsView() {
  const { runs, activeRunId, events, approvals, decideApproval, appSettings, loading, projects, setActiveRun } = useRuntimeStore();
  const [grouping, setGrouping] = useState<RunGrouping>("time");
  const run = runs.find((item) => item.id === activeRunId) ?? runs[0];
  const runEvents = events.filter((entry) => !run || entry.event.runId === run.id);
  const developerMode = appSettings?.developerMode ?? false;

  if (!run) return <EmptyView title="Runs" text="No runs yet." />;

  const transcript = runEvents.filter((entry) => TRANSCRIPT_EVENT_TYPES.has(entry.event.type));
  const runApprovals = approvals.filter((approval) => approval.runId === run.id);
  const finished = run.status === "completed" || run.status === "failed";
  const groups = groupRuns(runs, grouping, projects);

  return (
    <section className="workspace-grid">
      <div className="run-list">
        <div className="run-list-head">
          <h2>Runs</h2>
          <div className="group-toggle">
            {(["time", "project", "status"] as RunGrouping[]).map((option) => (
              <button key={option} className={grouping === option ? "active" : ""} onClick={() => setGrouping(option)}>
                {option}
              </button>
            ))}
          </div>
        </div>
        {groups.map((group) => (
          <div key={group.label} className="run-group">
            <div className="run-group-label">{group.label}</div>
            {group.runs.map((item) => (
              <button
                key={item.id}
                className={item.id === run.id ? "list-row active" : "list-row"}
                onClick={() => setActiveRun(item.id)}
              >
                <strong>{item.task}</strong>
                <span>{item.status.replace("_", " ")}</span>
              </button>
            ))}
          </div>
        ))}
      </div>
      <div className="transcript">
        <header className="view-header">
          <div>
            <h2>{run.task}</h2>
            <span className={`status-pill ${run.status}`}>{run.status.replace("_", " ")}</span>
          </div>
        </header>
        {run.plan.length > 0 && (
          <details className="plan-box" open>
            <summary>Plan · {run.plan.length} steps</summary>
            <ol>
              {run.plan.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
          </details>
        )}
        {runApprovals.map((approval) => (
          <article key={approval.id} className="approval-card">
            <Shield size={18} />
            <div>
              <strong>{approval.request}</strong>
              <span>{approval.riskLevel} risk</span>
            </div>
            <button onClick={() => void decideApproval(approval.id, "approved")} disabled={loading}>
              <Check size={16} /> Approve
            </button>
            <button className="danger" onClick={() => void decideApproval(approval.id, "denied")} disabled={loading}>
              <X size={16} /> Deny
            </button>
          </article>
        ))}
        <div className="event-feed">
          {transcript.length === 0 && !finished ? (
            <p className="transcript-empty">Working…</p>
          ) : (
            transcript.map(({ seq, event }) =>
              event.type === "artifact.created" ? (
                <article key={seq} className="event-card">
                  <span>Artifact</span>
                  <strong>{String(event.payload.title ?? "Artifact")}</strong>
                  <p>{String(event.payload.summary ?? "")}</p>
                </article>
              ) : (
                <TranscriptMessage key={seq} event={event} developerMode={developerMode} />
              ),
            )
          )}
          {finished && run.resultSummary && (
            <article className={run.status === "failed" ? "event-card error" : "event-card final"}>
              <span>{run.status === "failed" ? "Stopped" : "Result"}</span>
              <p>{run.resultSummary}</p>
            </article>
          )}
        </div>
        {developerMode && (
          <details className="plan-box">
            <summary>Raw events · {runEvents.length}</summary>
            <div className="event-feed">
              {runEvents.map(({ seq, event }) => (
                <article key={seq} className="event-card">
                  <span>{event.type}</span>
                  <p>{eventSummary(event.payload)}</p>
                </article>
              ))}
            </div>
          </details>
        )}
      </div>
    </section>
  );
}

function ApprovalsView() {
  const { approvals, decideApproval, loading } = useRuntimeStore();
  if (approvals.length === 0) return <EmptyView title="Approvals" text="No approvals pending." />;
  return (
    <section className="content-stack">
      <h2>Approvals</h2>
      {approvals.map((approval) => (
        <article key={approval.id} className="approval-card">
          <Shield size={18} />
          <div>
            <strong>{approval.request}</strong>
            <span>{approval.riskLevel} risk</span>
          </div>
          <button onClick={() => void decideApproval(approval.id, "approved")} disabled={loading}>
            <Check size={16} /> Approve
          </button>
          <button className="danger" onClick={() => void decideApproval(approval.id, "denied")} disabled={loading}>
            <X size={16} /> Deny
          </button>
        </article>
      ))}
    </section>
  );
}

type WorkshopTab = "installed" | "agents" | "office" | "export";

function WorkshopView() {
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

function WorkshopInstalled() {
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

const STATION_OPTIONS = ["manager", "browser", "computer", "file", "reviewer", "terminal"];
const BEHAVIOR_OPTIONS: import("@yanshi/shared").BehaviorMode[] = ["professional", "balanced", "playful"];

function AgentEditor() {
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

function OfficeEditor() {
  const { officeState, saveOfficeState, loadOfficeState } = useRuntimeStore();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!officeState) void loadOfficeState(null);
  }, [officeState, loadOfficeState]);

  if (!officeState) return <p className="muted">Loading office…</p>;

  const setLayout = (station: string, axis: 0 | 1, value: number) => {
    const current = officeState.stationLayout[station] ?? [0, 0];
    const next = [...current];
    next[axis] = value;
    void saveOfficeState(null, { stationLayout: { ...officeState.stationLayout, [station]: next } });
  };

  return (
    <div className="office-editor">
      <div className="office-editor-grid">
        <label className="setting-row">
          <span>Behavior</span>
          <select value={officeState.behaviorMode} onChange={(event) => { setBusy(true); void saveOfficeState(null, { behaviorMode: event.target.value as import("@yanshi/shared").BehaviorMode }).finally(() => setBusy(false)); }}>
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
      <h3 style={{ marginTop: 16 }}>Station layout</h3>
      <div className="layout-grid">
        {STATION_OPTIONS.map((station) => {
          const pos = officeState.stationLayout[station] ?? [];
          return (
            <Fragment key={station}>
              <span style={{ textTransform: "capitalize" }}>{station}</span>
              <input
                type="number"
                step="0.1"
                placeholder="x"
                defaultValue={pos[0] ?? ""}
                onBlur={(event) => event.target.value !== "" && setLayout(station, 0, Number(event.target.value))}
              />
              <input
                type="number"
                step="0.1"
                placeholder="z"
                defaultValue={pos[1] ?? ""}
                onBlur={(event) => event.target.value !== "" && setLayout(station, 1, Number(event.target.value))}
              />
            </Fragment>
          );
        })}
      </div>
      {busy && <p className="muted">Saving…</p>}
    </div>
  );
}

function WorkshopExport() {
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

type SettingsSection = "general" | "models" | "permissions" | "live-office" | "workshop" | "notifications" | "about" | "runtime" | "sandbox" | "database";

function SettingsView() {
  const store = useRuntimeStore();
  const { appSettings } = store;
  const developer = appSettings?.developerMode ?? false;
  const [section, setSection] = useState<SettingsSection>("general");

  const normalSections: Array<{ id: SettingsSection; label: string }> = [
    { id: "general", label: "General" },
    { id: "models", label: "Models" },
    { id: "permissions", label: "Permissions" },
    { id: "live-office", label: "Live Office" },
    { id: "workshop", label: "Workshop" },
    { id: "notifications", label: "Notifications" },
    { id: "about", label: "About" },
  ];
  const devSections: Array<{ id: SettingsSection; label: string }> = [
    { id: "runtime", label: "Runtime" },
    { id: "sandbox", label: "Sandbox" },
    { id: "database", label: "Database" },
  ];
  const sections = developer ? [...normalSections, ...devSections] : normalSections;
  const active = sections.some((item) => item.id === section) ? section : "general";

  return (
    <section className="settings-layout">
      <nav className="settings-nav">
        {normalSections.map((item) => (
          <button key={item.id} className={active === item.id ? "active" : ""} onClick={() => setSection(item.id)}>
            {item.label}
          </button>
        ))}
        {developer && <div className="settings-nav-label">Developer</div>}
        {developer &&
          devSections.map((item) => (
            <button key={item.id} className={active === item.id ? "active" : ""} onClick={() => setSection(item.id)}>
              {item.label}
            </button>
          ))}
      </nav>
      <div className="settings-content">
        <SettingsSectionView section={active} />
      </div>
    </section>
  );
}

function SettingsSectionView({ section }: { section: SettingsSection }) {
  const {
    status,
    desktopStatus,
    providerSettings,
    providerHealth,
    restartRuntime,
    refreshMacosPermissions,
    saveProviderSettings,
    checkProviderHealth,
    saveAppSettings,
    loading,
    appSettings,
    macosPermissions,
    workshopPacks,
  } = useRuntimeStore();
  const [baseUrl, setBaseUrl] = useState(providerSettings?.baseUrl ?? "https://api.openai.com/v1");
  const [model, setModel] = useState(providerSettings?.model ?? "gpt-4o-mini");
  const [apiKey, setApiKey] = useState("");

  useEffect(() => {
    if (providerSettings) {
      setBaseUrl(providerSettings.baseUrl);
      setModel(providerSettings.model ?? "gpt-4o-mini");
    }
  }, [providerSettings]);

  if (!appSettings) return <p className="muted">Loading settings…</p>;

  const toggle = (key: keyof typeof appSettings, label: string, hint?: string) => (
    <label className="setting-row">
      <span>
        {label}
        {hint && <small>{hint}</small>}
      </span>
      <input type="checkbox" checked={Boolean(appSettings[key])} onChange={(event) => void saveAppSettings({ [key]: event.target.checked })} />
    </label>
  );

  switch (section) {
    case "general":
      return (
        <div className="settings-panel">
          <h3>General</h3>
          <label className="setting-row">
            <span>Theme</span>
            <select value={appSettings.theme} onChange={(event) => void saveAppSettings({ theme: event.target.value as "light" | "dark" })}>
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </select>
          </label>
          <label className="setting-row">
            <span>Default permission</span>
            <select
              value={appSettings.permissionModeDefault}
              onChange={(event) => void saveAppSettings({ permissionModeDefault: event.target.value as PermissionMode })}
            >
              <option value="default">Default</option>
              <option value="auto_review">Auto-review</option>
              <option value="full_access">Full access</option>
            </select>
          </label>
          {toggle("developerMode", "Developer Mode", "Show runtime internals and raw events.")}
        </div>
      );
    case "models":
      return (
        <div className="settings-panel">
          <h3>Models</h3>
          <p className="muted">{status?.missingRequirements.includes("model_provider") ? "Provider not configured." : "Provider configured."}</p>
          <div className="settings-form">
            <label>
              Base URL
              <input value={baseUrl} onChange={(event) => setBaseUrl(event.target.value)} spellCheck={false} />
            </label>
            <label>
              Model
              <input value={model} onChange={(event) => setModel(event.target.value)} spellCheck={false} />
            </label>
            <label>
              API key
              <input
                value={apiKey}
                onChange={(event) => setApiKey(event.target.value)}
                placeholder={providerSettings?.apiKeyConfigured ? "Configured" : "Not configured"}
                type="password"
              />
            </label>
          </div>
          <div className="settings-actions">
            <button
              disabled={loading || !baseUrl.trim() || !model.trim()}
              onClick={() => {
                void saveProviderSettings({ baseUrl: baseUrl.trim(), model: model.trim(), ...(apiKey.trim() ? { apiKey: apiKey.trim() } : {}) });
                setApiKey("");
              }}
            >
              Save
            </button>
            <button disabled={loading} onClick={() => void checkProviderHealth()}>
              Check
            </button>
          </div>
          {providerHealth && <p className={providerHealth.ok ? "status-text ok" : "status-text"}>{providerHealth.detail}</p>}
        </div>
      );
    case "permissions":
      return (
        <div className="settings-panel">
          <h3>Permissions</h3>
          <p className="muted">Allow Yanshi to use these tools during approved tasks.</p>
          {toggle("browserToolEnabled", "Browser")}
          {toggle("computerToolEnabled", "Computer")}
          {toggle("terminalToolEnabled", "Terminal")}
          {macosPermissions && (
            <dl className="runtime-details">
              <dt>Accessibility</dt>
              <dd>{permissionLabel(macosPermissions.accessibility)}</dd>
              <dt>Screen</dt>
              <dd>{permissionLabel(macosPermissions.screenRecording)}</dd>
            </dl>
          )}
          <div className="settings-actions">
            <button onClick={() => void refreshMacosPermissions()} disabled={loading}>
              Refresh
            </button>
          </div>
        </div>
      );
    case "live-office":
      return (
        <div className="settings-panel">
          <h3>Live Office</h3>
          {toggle("liveOfficeAutoOpen", "Auto-open on task start")}
          {toggle("liveOfficeDefaultOpen", "Open by default")}
        </div>
      );
    case "workshop":
      return (
        <div className="settings-panel">
          <h3>Workshop</h3>
          <p className="muted">{workshopPacks.length} pack{workshopPacks.length === 1 ? "" : "s"} installed.</p>
        </div>
      );
    case "notifications":
      return (
        <div className="settings-panel">
          <h3>Notifications</h3>
          {toggle("notificationsEnabled", "Desktop notifications")}
        </div>
      );
    case "about":
      return (
        <div className="settings-panel">
          <h3>About</h3>
          <dl className="runtime-details">
            <dt>Yanshi</dt>
            <dd>0.1.0</dd>
            <dt>Runtime</dt>
            <dd>{desktopStatus?.launchMode ?? "—"}</dd>
            <dt>Status</dt>
            <dd>{status?.details ?? desktopStatus?.detail ?? "—"}</dd>
          </dl>
        </div>
      );
    case "runtime":
      return (
        <div className="settings-panel">
          <h3>Runtime</h3>
          <p className="muted">{desktopStatus?.detail ?? status?.details ?? "Checking runtime…"}</p>
          <dl className="runtime-details">
            <dt>Mode</dt>
            <dd>{desktopStatus?.launchMode ?? "—"}</dd>
            <dt>URL</dt>
            <dd>{desktopStatus?.runtimeUrl ?? "—"}</dd>
            <dt>Log</dt>
            <dd>{desktopStatus?.logPath ?? "Not available"}</dd>
            <dt>Missing</dt>
            <dd>{desktopStatus?.missingRequirements.length ? desktopStatus.missingRequirements.join(", ") : "None"}</dd>
          </dl>
          <div className="settings-actions">
            <button onClick={() => void restartRuntime()} disabled={loading}>
              Restart
            </button>
            <button onClick={() => void openDesktopRuntimeLogs()} disabled={!desktopStatus?.logPath}>
              Logs
            </button>
          </div>
        </div>
      );
    case "sandbox":
      return (
        <div className="settings-panel">
          <h3>Sandbox</h3>
          <div className="settings-form split">
            <label>
              Image
              <input
                defaultValue={appSettings.dockerImage}
                spellCheck={false}
                onBlur={(event) => {
                  const value = event.currentTarget.value.trim();
                  if (value && value !== appSettings.dockerImage) void saveAppSettings({ dockerImage: value });
                }}
              />
            </label>
            <label>
              Memory
              <input
                defaultValue={appSettings.dockerMemory}
                spellCheck={false}
                onBlur={(event) => {
                  const value = event.currentTarget.value.trim();
                  if (value && value !== appSettings.dockerMemory) void saveAppSettings({ dockerMemory: value });
                }}
              />
            </label>
            <label>
              CPUs
              <input
                defaultValue={appSettings.dockerCpus}
                spellCheck={false}
                onBlur={(event) => {
                  const value = event.currentTarget.value.trim();
                  if (value && value !== appSettings.dockerCpus) void saveAppSettings({ dockerCpus: value });
                }}
              />
            </label>
            <label>
              PID limit
              <input
                defaultValue={String(appSettings.dockerPidsLimit)}
                inputMode="numeric"
                onBlur={(event) => {
                  const value = Number(event.currentTarget.value);
                  if (Number.isInteger(value) && value > 0 && value !== appSettings.dockerPidsLimit) void saveAppSettings({ dockerPidsLimit: value });
                }}
              />
            </label>
          </div>
        </div>
      );
    case "database":
      return (
        <div className="settings-panel">
          <h3>Database</h3>
          <dl className="runtime-details">
            <dt>Health</dt>
            <dd>{status?.status ?? "—"}</dd>
            <dt>Runtime URL</dt>
            <dd>{desktopStatus?.runtimeUrl ?? "—"}</dd>
          </dl>
        </div>
      );
    default:
      return null;
  }
}

function DeveloperView() {
  const { status, events } = useRuntimeStore();
  return (
    <section className="developer-grid">
      <div>
        <h2>Runtime</h2>
        <pre>{JSON.stringify(status, null, 2)}</pre>
      </div>
      <div>
        <h2>Events</h2>
        <pre>{JSON.stringify(events.slice(-80), null, 2)}</pre>
      </div>
    </section>
  );
}

function ArtifactsView() {
  const events = useRuntimeStore((state) => state.events);
  const [artifacts, setArtifacts] = useState<import("@yanshi/shared").ArtifactSummary[] | null>(null);
  const artifactCount = events.filter((entry) => entry.event.type === "artifact.created").length;

  useEffect(() => {
    let cancelled = false;
    runtimeApi
      .artifacts()
      .then((items) => !cancelled && setArtifacts(items))
      .catch(() => !cancelled && setArtifacts([]));
    return () => {
      cancelled = true;
    };
    // Re-fetch when new artifacts stream in.
  }, [artifactCount]);

  if (!artifacts) return <EmptyView title="Artifacts" text="Loading…" />;
  if (artifacts.length === 0) return <EmptyView title="Artifacts" text="No artifacts yet." />;

  return (
    <section className="content-stack">
      <h2>Artifacts</h2>
      {artifacts.map((artifact) => (
        <ArtifactCard key={artifact.id} artifact={artifact} />
      ))}
    </section>
  );
}

function ArtifactCard({ artifact }: { artifact: import("@yanshi/shared").ArtifactSummary }) {
  return (
    <article className="event-card artifact-card">
      <div className="artifact-head">
        <div>
          <span>{artifact.kind}</span>
          <strong>{artifact.title}</strong>
        </div>
        {canRevealFiles() && (
          <button className="ghost-button" title="Reveal in Finder" onClick={() => void revealPath(artifact.path)}>
            <FolderOpen size={15} /> Reveal
          </button>
        )}
      </div>
      <p>{artifact.summary}</p>
      <details className="msg-details">
        <summary>Details</summary>
        <dl className="runtime-details">
          <dt>Agent</dt>
          <dd>{agentLabel(artifact.agentId)}</dd>
          <dt>Created</dt>
          <dd>{new Date(artifact.createdAt).toLocaleString()}</dd>
          <dt>Path</dt>
          <dd>{artifact.path}</dd>
        </dl>
      </details>
    </article>
  );
}

function LiveOfficePanel({
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

function TranscriptMessage({ event, developerMode }: { event: import("@yanshi/shared").YanshiEvent; developerMode: boolean }) {
  const output = (event.payload.structuredOutput ?? {}) as Record<string, unknown>;
  const entries = Object.entries(output).filter(([, value]) => typeof value !== "object" || value === null);
  const hasDetails = entries.length > 0 || developerMode;
  return (
    <article className={event.payload.error ? "event-card error" : "event-card"}>
      <span>{agentLabel(event.payload.agentId ?? event.agentId)}</span>
      <p>{eventSummary(event.payload)}</p>
      {hasDetails && (
        <details className="msg-details">
          <summary>Details</summary>
          {entries.length > 0 && (
            <dl className="runtime-details">
              {entries.map(([key, value]) => (
                <Fragment key={key}>
                  <dt>{key}</dt>
                  <dd>{String(value)}</dd>
                </Fragment>
              ))}
            </dl>
          )}
          {developerMode && <pre className="msg-raw">{JSON.stringify(event.payload, null, 2)}</pre>}
        </details>
      )}
    </article>
  );
}

function SearchView({ onNavigate }: { onNavigate: (view: View) => void }) {
  const { projects, runs, workshopPacks, events, setActiveProject, setActiveRun } = useRuntimeStore();
  const [query, setQuery] = useState("");
  const term = query.trim().toLowerCase();

  const artifactEvents = events.filter((entry) => entry.event.type === "artifact.created");
  const projectHits = term ? projects.filter((p) => p.name.toLowerCase().includes(term) || (p.description ?? "").toLowerCase().includes(term)) : [];
  const runHits = term ? runs.filter((r) => r.task.toLowerCase().includes(term)) : [];
  const artifactHits = term
    ? artifactEvents.filter((entry) => String(entry.event.payload.title ?? "").toLowerCase().includes(term) || String(entry.event.payload.summary ?? "").toLowerCase().includes(term))
    : [];
  const packHits = term ? workshopPacks.filter((p) => p.name.toLowerCase().includes(term)) : [];
  const total = projectHits.length + runHits.length + artifactHits.length + packHits.length;

  return (
    <section className="content-stack">
      <div className="search-box">
        <Search size={18} />
        <input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search projects, runs, artifacts…" />
      </div>
      {!term ? (
        <p className="transcript-empty">Type to search.</p>
      ) : total === 0 ? (
        <p className="transcript-empty">No results.</p>
      ) : (
        <div className="search-results">
          {projectHits.length > 0 && (
            <div className="search-group">
              <div className="search-group-label">Projects</div>
              {projectHits.map((p) => (
                <button key={p.id} className="search-row" onClick={() => { setActiveProject(p.id); onNavigate("projects"); }}>
                  <Boxes size={15} /> {p.name}
                </button>
              ))}
            </div>
          )}
          {runHits.length > 0 && (
            <div className="search-group">
              <div className="search-group-label">Runs</div>
              {runHits.map((r) => (
                <button key={r.id} className="search-row" onClick={() => { setActiveRun(r.id); onNavigate("runs"); }}>
                  <Play size={15} /> {r.task}
                </button>
              ))}
            </div>
          )}
          {artifactHits.length > 0 && (
            <div className="search-group">
              <div className="search-group-label">Artifacts</div>
              {artifactHits.map(({ seq, event }) => (
                <button key={seq} className="search-row" onClick={() => onNavigate("artifacts")}>
                  <FileSearch size={15} /> {String(event.payload.title ?? "Artifact")}
                </button>
              ))}
            </div>
          )}
          {packHits.length > 0 && (
            <div className="search-group">
              <div className="search-group-label">Workshop</div>
              {packHits.map((p) => (
                <button key={p.id} className="search-row" onClick={() => onNavigate("workshop")}>
                  <Archive size={15} /> {p.name}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function EmptyView({ title, text }: { title: string; text: string }) {
  return (
    <section className="empty-view">
      <h2>{title}</h2>
      <p>{text}</p>
    </section>
  );
}

const AGENT_LABELS: Record<string, string> = {
  agent_manager: "Manager",
  agent_browser: "Browser",
  agent_computer: "Computer",
  agent_file: "File",
  agent_terminal: "Terminal",
  agent_reviewer: "Reviewer",
};

function agentLabel(agentId: unknown): string {
  if (typeof agentId === "string" && agentId in AGENT_LABELS) return AGENT_LABELS[agentId];
  return "Yanshi";
}

function groupRuns(
  runs: import("@yanshi/shared").RunSummary[],
  grouping: RunGrouping,
  projects: import("@yanshi/shared").ProjectSummary[],
): Array<{ label: string; runs: import("@yanshi/shared").RunSummary[] }> {
  const buckets = new Map<string, import("@yanshi/shared").RunSummary[]>();
  const labelFor = (run: import("@yanshi/shared").RunSummary): string => {
    if (grouping === "status") return run.status.replace("_", " ");
    if (grouping === "project") return run.projectId ? projects.find((p) => p.id === run.projectId)?.name ?? "Project" : "Standalone";
    const day = run.createdAt.slice(0, 10);
    const today = new Date().toISOString().slice(0, 10);
    return day === today ? "Today" : day;
  };
  for (const run of runs) {
    const label = labelFor(run);
    const list = buckets.get(label) ?? [];
    list.push(run);
    buckets.set(label, list);
  }
  return [...buckets.entries()].map(([label, list]) => ({ label, runs: list }));
}

function eventSummary(payload: Record<string, unknown>): string {
  if (typeof payload.summary === "string") return payload.summary;
  if (typeof payload.task === "string") return payload.task;
  if (Array.isArray(payload.steps)) return payload.steps.join(" · ");
  if (typeof payload.request === "string") return payload.request;
  return JSON.stringify(payload);
}

function permissionSummary(status: MacosPermissionStatus | null): string {
  if (!status) return "Desktop permission status unavailable.";
  return `Accessibility ${permissionLabel(status.accessibility).toLowerCase()} · Screen ${permissionLabel(status.screenRecording).toLowerCase()}`;
}

function permissionLabel(state: string): string {
  if (state === "granted") return "Granted";
  if (state === "permission_required") return "Required";
  if (state === "unsupported") return "Unsupported";
  return "Unknown";
}
