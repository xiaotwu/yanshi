import { FileSearch, FolderOpen, Plus } from "lucide-react";
import { Suspense, useEffect, useState } from "react";

import { runtimeApi } from "../api/client";
import { BEHAVIOR_OPTIONS, eventSummary } from "../lib/shared";
import { useRuntimeStore } from "../stores/runtimeStore";
import { AutomationsPanel } from "./automations";
import { LiveOfficeScene } from "./live-office";

export function ProjectsView() {
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

export type ProjectTab = "overview" | "runs" | "files" | "artifacts" | "automations" | "office" | "activity" | "settings";

export function ProjectWorkspace({
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

export function ProjectOffice({ projectId }: { projectId: string }) {
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
          <LiveOfficeScene agents={liveAgents} compact cameraMode={office.cameraMode} stationLayout={office.stationLayout} furniture={office.furniture ?? []} dark={document.documentElement.dataset.theme === "dark"} />
        </Suspense>
      </div>
    </div>
  );
}

export function ProjectFiles({ projectId }: { projectId: string }) {
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
