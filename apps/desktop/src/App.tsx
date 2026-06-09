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
  Home,
  Loader2,
  Maximize2,
  Pencil,
  Play,
  Plus,
  Search,
  Send,
  Settings,
  Shield,
  Trash2,
  X,
} from "lucide-react";
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";

import iconUrl from "../../../icon.png";
import { openDesktopRuntimeLogs, popOutLiveOffice } from "./api/desktop";
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

  useEffect(() => {
    void hydrate();
    connectEvents();
  }, [connectEvents, hydrate]);

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
        {view === "search" && <EmptyView title="Search" text="No indexed projects yet." />}
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
    </div>
  );
}

function NewTaskView({ onRuns }: { onRuns: () => void }) {
  const [task, setTask] = useState("");
  const { createRun, loading, error, appSettings, projects, activeProjectId } = useRuntimeStore();
  const [permissionMode, setPermissionMode] = useState<PermissionMode>(appSettings?.permissionModeDefault ?? "default");
  const [selectedProjectId, setSelectedProjectId] = useState(activeProjectId ?? "standalone");

  useEffect(() => {
    if (appSettings?.permissionModeDefault) setPermissionMode(appSettings.permissionModeDefault);
  }, [appSettings?.permissionModeDefault]);

  useEffect(() => {
    if (selectedProjectId !== "standalone" && !projects.some((project) => project.id === selectedProjectId)) {
      setSelectedProjectId("standalone");
    }
  }, [projects, selectedProjectId]);

  const submit = async () => {
    if (!task.trim()) return;
    await createRun(task, permissionMode, selectedProjectId === "standalone" ? null : selectedProjectId);
    setTask("");
    onRuns();
  };

  return (
    <section className="center-stage">
      <div className="composer-wrap">
        <h1>How can Yanshi help you today?</h1>
        <div className="composer">
          <button className="icon-button" title="Add">
            <Plus size={18} />
          </button>
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
          <button className="send-button" onClick={() => void submit()} disabled={loading || !task.trim()} title="Run">
            {loading ? <Loader2 className="spin" size={18} /> : <Send size={18} />}
          </button>
        </div>
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
          <>
            <header className="view-header">
              <div>
                <h2>{selectedProject.name}</h2>
                <span className="status-pill">{projectRuns.length} runs</span>
              </div>
              <div className="icon-actions">
                <button onClick={() => void saveProject()} disabled={loading || !editName.trim()} title="Save">
                  <Pencil size={16} />
                </button>
                <button className="danger" onClick={() => void removeProject()} disabled={loading} title="Delete">
                  <Trash2 size={16} />
                </button>
              </div>
            </header>
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
            <dl className="runtime-details">
              <dt>Workspace</dt>
              <dd>{selectedProject.workspacePath}</dd>
              <dt>Agents</dt>
              <dd>{selectedProject.agentTeamId ?? "Not assigned"}</dd>
              <dt>Office</dt>
              <dd>{selectedProject.liveOfficeStateId ?? "Not assigned"}</dd>
            </dl>
            <div className="event-feed">
              {projectRuns.length === 0 ? (
                <article className="event-card">
                  <span>runs</span>
                  <p>No runs for this project yet.</p>
                </article>
              ) : (
                projectRuns.map((run) => (
                  <article key={run.id} className="event-card">
                    <span>{run.status.replace("_", " ")}</span>
                    <p>{run.task}</p>
                  </article>
                ))
              )}
            </div>
          </>
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

const TRANSCRIPT_EVENT_TYPES = new Set(["observation.created", "artifact.created"]);

function RunsView() {
  const { runs, activeRunId, events, approvals, decideApproval, appSettings, loading } = useRuntimeStore();
  const run = runs.find((item) => item.id === activeRunId) ?? runs[0];
  const runEvents = events.filter((entry) => !run || entry.event.runId === run.id);
  const developerMode = appSettings?.developerMode ?? false;

  if (!run) return <EmptyView title="Runs" text="No runs yet." />;

  const transcript = runEvents.filter((entry) => TRANSCRIPT_EVENT_TYPES.has(entry.event.type));
  const runApprovals = approvals.filter((approval) => approval.runId === run.id);
  const finished = run.status === "completed" || run.status === "failed";

  return (
    <section className="workspace-grid">
      <div className="run-list">
        <h2>Runs</h2>
        {runs.map((item) => (
          <article key={item.id} className={item.id === run.id ? "list-row active" : "list-row"}>
            <strong>{item.task}</strong>
            <span>{item.status.replace("_", " ")}</span>
          </article>
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
                <article key={seq} className={event.payload.error ? "event-card error" : "event-card"}>
                  <span>{agentLabel(event.payload.agentId ?? event.agentId)}</span>
                  <p>{eventSummary(event.payload)}</p>
                </article>
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

function WorkshopView() {
  const [result, setResult] = useState<string>("No pack selected.");
  const { workshopPacks, importWorkshopPack, setWorkshopPackEnabled, loading, error } = useRuntimeStore();

  const importPack = async (file: File | undefined) => {
    if (!file) return;
    await importWorkshopPack(file);
    setResult(`Imported ${file.name}.`);
  };

  return (
    <section className="content-stack">
      <h2>Workshop</h2>
      <label className="drop-zone">
        <Archive size={22} />
        <span>{loading ? "Importing..." : "Import pack"}</span>
        <input type="file" accept=".zip" onChange={(event) => void importPack(event.target.files?.[0])} />
      </label>
      <p className={error ? "inline-error" : "muted"}>{error ?? result}</p>
      <div className="event-feed">
        {workshopPacks.length === 0 ? (
          <article className="event-card">
            <span>installed</span>
            <p>No packs installed.</p>
          </article>
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
    </section>
  );
}

function SettingsView() {
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

  return (
    <section className="content-stack">
      <h2>Settings</h2>
      <div className="settings-grid">
        <section>
          <h3>Runtime</h3>
          <p>{desktopStatus?.detail ?? status?.details ?? "Checking runtime..."}</p>
          {desktopStatus && (
            <div className="settings-actions">
              <button onClick={() => void restartRuntime()} disabled={loading}>
                Restart
              </button>
              <button onClick={() => void openDesktopRuntimeLogs()} disabled={!desktopStatus.logPath}>
                Logs
              </button>
            </div>
          )}
        </section>
        <section>
          <h3>Models</h3>
          <p>{status?.missingRequirements.includes("model_provider") ? "Provider not configured." : "Provider configured."}</p>
        </section>
        <section>
          <h3>Permissions</h3>
          <p>{permissionSummary(macosPermissions)}</p>
          <div className="settings-actions">
            <button onClick={() => void refreshMacosPermissions()} disabled={loading}>
              Refresh
            </button>
          </div>
        </section>
      </div>
      {macosPermissions && (
        <section className="settings-panel">
          <h3>macOS Access</h3>
          <dl className="runtime-details">
            <dt>Accessibility</dt>
            <dd>{permissionLabel(macosPermissions.accessibility)}</dd>
            <dt>Screen</dt>
            <dd>{permissionLabel(macosPermissions.screenRecording)}</dd>
            <dt>Action</dt>
            <dd>{macosPermissions.requiredAction}</dd>
          </dl>
        </section>
      )}
      <section className="settings-panel">
        <h3>Provider</h3>
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
              void saveProviderSettings({
                baseUrl: baseUrl.trim(),
                model: model.trim(),
                ...(apiKey.trim() ? { apiKey: apiKey.trim() } : {}),
              });
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
      </section>
      {appSettings && (
        <section className="settings-panel">
          <h3>Preferences</h3>
          <div className="toggle-grid">
            <label>
              <span>Developer</span>
              <input
                type="checkbox"
                checked={appSettings.developerMode}
                onChange={(event) => void saveAppSettings({ developerMode: event.target.checked })}
              />
            </label>
            <label>
              <span>Live Office</span>
              <input
                type="checkbox"
                checked={appSettings.liveOfficeAutoOpen}
                onChange={(event) => void saveAppSettings({ liveOfficeAutoOpen: event.target.checked })}
              />
            </label>
            <label>
              <span>Browser</span>
              <input
                type="checkbox"
                checked={appSettings.browserToolEnabled}
                onChange={(event) => void saveAppSettings({ browserToolEnabled: event.target.checked })}
              />
            </label>
            <label>
              <span>Computer</span>
              <input
                type="checkbox"
                checked={appSettings.computerToolEnabled}
                onChange={(event) => void saveAppSettings({ computerToolEnabled: event.target.checked })}
              />
            </label>
            <label>
              <span>Terminal</span>
              <input
                type="checkbox"
                checked={appSettings.terminalToolEnabled}
                onChange={(event) => void saveAppSettings({ terminalToolEnabled: event.target.checked })}
              />
            </label>
            <label>
              <span>Notify</span>
              <input
                type="checkbox"
                checked={appSettings.notificationsEnabled}
                onChange={(event) => void saveAppSettings({ notificationsEnabled: event.target.checked })}
              />
            </label>
          </div>
          <label className="inline-select">
            Permission
            <select
              value={appSettings.permissionModeDefault}
              onChange={(event) => void saveAppSettings({ permissionModeDefault: event.target.value as PermissionMode })}
            >
              <option value="default">Default</option>
              <option value="auto_review">Auto-review</option>
              <option value="full_access">Full access</option>
            </select>
          </label>
        </section>
      )}
      {appSettings?.developerMode && (
        <section className="settings-panel">
          <h3>Docker Sandbox</h3>
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
                  if (Number.isInteger(value) && value > 0 && value !== appSettings.dockerPidsLimit) {
                    void saveAppSettings({ dockerPidsLimit: value });
                  }
                }}
              />
            </label>
          </div>
        </section>
      )}
      {desktopStatus && (
        <details className="plan-box">
          <summary>Runtime details</summary>
          <dl className="runtime-details">
            <dt>Mode</dt>
            <dd>{desktopStatus.launchMode}</dd>
            <dt>URL</dt>
            <dd>{desktopStatus.runtimeUrl}</dd>
            <dt>Log</dt>
            <dd>{desktopStatus.logPath ?? "Not available"}</dd>
            <dt>Missing</dt>
            <dd>{desktopStatus.missingRequirements.length ? desktopStatus.missingRequirements.join(", ") : "None"}</dd>
          </dl>
        </details>
      )}
    </section>
  );
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
  const artifacts = useRuntimeStore((state) => state.events.filter((entry) => entry.event.type === "artifact.created"));
  if (artifacts.length === 0) return <EmptyView title="Artifacts" text="No artifacts yet." />;
  return (
    <section className="content-stack">
      <h2>Artifacts</h2>
      {artifacts.map(({ seq, event }) => (
        <article key={seq} className="event-card">
          <strong>{String(event.payload.title ?? "Artifact")}</strong>
          <p>{String(event.payload.summary ?? "")}</p>
        </article>
      ))}
    </section>
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
  const { liveAgents, approvals, runs } = useRuntimeStore();
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
          <LiveOfficeScene agents={liveAgents} compact={!full} />
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
