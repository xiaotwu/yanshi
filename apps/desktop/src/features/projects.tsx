import { Check, FileSearch, FolderOpen, FolderPlus, MoreHorizontal, Search } from "lucide-react";
import { Suspense, useEffect, useRef, useState } from "react";
import type { ProjectSummary, RunSummary } from "@yanshi/shared";

import { runtimeApi } from "../api/client";
import { Composer } from "../components/composer";
import { COLOR_PRESETS, CreateProjectModal } from "../components/create-project-modal";
import { Modal, ModalHeader } from "../components/modal";
import { useDismiss, useFloatingPanel } from "../lib/floating";
import { useT } from "../i18n";
import { reportError } from "../lib/errors";
import type { TKey } from "../i18n/en";
import { BEHAVIOR_OPTIONS, eventSummary, projectColor, projectIcon, statusLabel } from "../lib/shared";
import { useRuntimeStore } from "../stores/runtimeStore";
import { AutomationsPanel } from "./automations";
import { LiveOfficeScene } from "./live-office";

const CONTEXT_LABEL: Record<string, TKey> = { default: "project.contextDefault", project_only: "project.contextProjectOnly" };

/**
 * Lightweight Projects selector — opened from the sidebar "Projects" label. Not an admin
 * dashboard: New Project, a filterable list, and a glance at recent activity per project.
 */
export function ProjectsView({ onOpenProject }: { onOpenProject: (projectId: string) => void }) {
  const { t } = useT();
  const { projects, runs } = useRuntimeStore();
  const [modalOpen, setModalOpen] = useState(false);
  const [filter, setFilter] = useState("");

  const query = filter.trim().toLowerCase();
  const visible = query ? projects.filter((project) => project.name.toLowerCase().includes(query)) : projects;

  const lastActivity = (project: ProjectSummary): string | null => {
    const latest = runs
      .filter((run) => run.projectId === project.id)
      .map((run) => run.updatedAt)
      .sort()
      .at(-1);
    return latest ? latest.slice(0, 10) : null;
  };

  return (
    <section className="center-stage">
      <div className="projects-select">
        <header className="projects-select-head">
          <h1>{t("nav.projects")}</h1>
          <div className="library-filter">
            <Search size={14} />
            <input value={filter} onChange={(event) => setFilter(event.target.value)} placeholder={t("projects.filter")} />
          </div>
        </header>
        <button className="projects-new-row" onClick={() => setModalOpen(true)}>
          <FolderPlus size={17} />
          {t("nav.newProject")}
        </button>
        <div className="projects-select-list">
          {visible.length === 0 ? (
            <p className="muted">{query ? t("search.noResults") : t("projects.empty")}</p>
          ) : (
            visible.map((project) => {
              const count = runs.filter((run) => run.projectId === project.id).length;
              const activity = lastActivity(project);
              return (
                <button key={project.id} className="projects-select-row" onClick={() => onOpenProject(project.id)}>
                  <span className="proj-emoji lg" style={{ background: projectColor(project) }}>{projectIcon(project)}</span>
                  <span className="projects-select-name ellipsis">{project.name}</span>
                  <small className="muted">
                    {t("projects.taskCount", { count })}
                    {activity ? ` · ${activity}` : ""}
                  </small>
                </button>
              );
            })
          )}
        </div>
      </div>
      {modalOpen && <CreateProjectModal onClose={() => setModalOpen(false)} onCreated={(id) => { setModalOpen(false); onOpenProject(id); }} />}
    </section>
  );
}

type ProjectTab = "tasks" | "files";
type ProjectPanel = "agents" | "automations" | "atelier" | "activity" | "settings";

const PANEL_LABEL: Record<ProjectPanel, TKey> = {
  agents: "project.tabAgents",
  automations: "project.tabAutomations",
  atelier: "project.tabAtelier",
  activity: "project.tabActivity",
  settings: "project.settings",
};

/**
 * ChatGPT-style project page: header (icon · name · compact status · "…" menu), a
 * project-scoped composer, Tasks | Files pills. Secondary surfaces (agents, automations,
 * artifacts, atelier, activity, settings) live behind the "…" menu as centered modals —
 * the default view is just the project's tasks.
 */
export function ProjectHomeView({ onOpenTask }: { onOpenTask: (runId: string) => void }) {
  const { t } = useT();
  const { projects, runs, activeProjectId } = useRuntimeStore();
  const project = projects.find((item) => item.id === activeProjectId) ?? null;
  const [tab, setTab] = useState<ProjectTab>("tasks");
  const [panel, setPanel] = useState<ProjectPanel | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const { panelRef, panelStyle } = useFloatingPanel(menuOpen, () => menuButtonRef.current?.getBoundingClientRect() ?? null, [], { align: "end" });
  useDismiss(menuOpen, [panelRef, menuButtonRef], () => setMenuOpen(false));

  useEffect(() => {
    setTab("tasks");
    setPanel(null);
  }, [activeProjectId]);

  // Sidebar context menus deep-link into a project panel ("Project settings", "Automations", …).
  useEffect(() => {
    const onOpenPanel = (event: Event) => {
      const detail = (event as CustomEvent<string>).detail as ProjectPanel;
      if (detail in PANEL_LABEL) setPanel(detail);
    };
    window.addEventListener("yanshi:project-panel", onOpenPanel);
    return () => window.removeEventListener("yanshi:project-panel", onOpenPanel);
  }, []);

  if (!project) {
    return (
      <section className="empty-view">
        <h2>{t("nav.projects")}</h2>
        <p>{t("projects.empty")}</p>
      </section>
    );
  }

  const projectRuns = runs.filter((run) => run.projectId === project.id);
  const contextMode = typeof project.settings?.contextMode === "string" ? project.settings.contextMode : "default";

  return (
    <section className="project-home">
      <header className="project-home-head">
        <span className="proj-emoji lg" style={{ background: projectColor(project) }}>{projectIcon(project)}</span>
        <div className="project-home-title">
          <h2 className="ellipsis">{project.name}</h2>
          <small className="muted">
            {t("projects.taskCount", { count: projectRuns.length })} · {t(CONTEXT_LABEL[contextMode] ?? "project.contextDefault")}
          </small>
        </div>
        <button ref={menuButtonRef} className="icon-button ghost" title={t("project.more")} onClick={() => setMenuOpen((open) => !open)}>
          <MoreHorizontal size={18} />
        </button>
        {menuOpen && (
          <div className="context-menu" role="menu" ref={panelRef} style={panelStyle}>
            {(Object.keys(PANEL_LABEL) as ProjectPanel[]).map((id) => (
              <button
                key={id}
                role="menuitem"
                className="menu-row"
                onClick={() => {
                  setMenuOpen(false);
                  // Refocus the "…" trigger before the panel opens so the panel modal captures it
                  // as the restore target (the menu row itself unmounts and can't take focus back).
                  menuButtonRef.current?.focus();
                  setPanel(id);
                }}
              >
                {t(PANEL_LABEL[id])}
              </button>
            ))}
          </div>
        )}
      </header>

      <div className="project-home-composer">
        <Composer lockedProject={project} onSubmitted={() => setTab("tasks")} />
      </div>

      <div className="group-toggle project-home-tabs">
        <button className={tab === "tasks" ? "active" : ""} onClick={() => setTab("tasks")}>
          {t("project.tasks")}
        </button>
        <button className={tab === "files" ? "active" : ""} onClick={() => setTab("files")}>
          {t("project.sources")}
        </button>
      </div>

      {tab === "tasks" &&
        (projectRuns.length === 0 ? (
          <div className="project-empty">
            <h3>{t("project.noTasks")}</h3>
            <p className="muted">{t("project.noRunsHint", { name: project.name })}</p>
          </div>
        ) : (
          <div className="project-task-list">
            {[...projectRuns]
              .sort((a, b) => (b.updatedAt ?? "").localeCompare(a.updatedAt ?? ""))
              .map((run) => (
                <button key={run.id} className="list-row" onClick={() => onOpenTask(run.id)}>
                  <strong className="ellipsis">{run.task}</strong>
                  <span>{statusLabel(run.status, t)}</span>
                </button>
              ))}
          </div>
        ))}

      {tab === "files" && <ProjectFiles projectId={project.id} />}

      {panel && (
        <Modal onClose={() => setPanel(null)} size={panel === "atelier" ? "lg" : "md"} labelledBy="project-panel-title">
          <ModalHeader title={`${project.name} · ${t(PANEL_LABEL[panel])}`} id="project-panel-title" onClose={() => setPanel(null)} />
          <div className="modal-body">
            {panel === "agents" && <ProjectAgents />}
            {panel === "automations" && <AutomationsPanel projectId={project.id} />}
            {panel === "atelier" && <ProjectOffice projectId={project.id} />}
            {panel === "activity" && <ProjectActivity projectId={project.id} />}
            {panel === "settings" && <ProjectSettings project={project} onClose={() => setPanel(null)} />}
          </div>
        </Modal>
      )}
    </section>
  );
}

function ProjectAgents() {
  const { liveAgents } = useRuntimeStore();
  return (
    <div className="agent-rows">
      {liveAgents.map((agent) => (
        <div key={agent.id} className="agent-row">
          <span className="agent-dot" style={{ background: agent.accent }} />
          <span className="agent-name">{agent.name}</span>
          <span className="muted" style={{ textTransform: "capitalize" }}>{agent.station}</span>
          <span className="agent-state muted">{agent.currentTask ?? agent.status}</span>
          {agent.queueCount > 0 && <b>{agent.queueCount}</b>}
        </div>
      ))}
    </div>
  );
}

function ProjectActivity({ projectId }: { projectId: string }) {
  const { t } = useT();
  const { events } = useRuntimeStore();
  const projectEvents = events.filter((entry) => entry.event.projectId === projectId);
  if (projectEvents.length === 0) return <p className="transcript-empty">{t("project.noActivity")}</p>;
  return (
    <div className="event-feed">
      {projectEvents
        .slice(-40)
        .reverse()
        .map(({ seq, event }) => (
          <article key={seq} className="event-card">
            <span>{event.type}</span>
            <p>{eventSummary(event.payload)}</p>
          </article>
        ))}
    </div>
  );
}

const EMOJI_PRESETS = ["📁", "🧪", "✈️", "📊", "🎨", "💻", "📚", "🚀", "🧠", "🛠️", "📝", "🌐"];

export function ProjectSettings({ project, onClose }: { project: ProjectSummary; onClose: () => void }) {
  const { t } = useT();
  const { updateProject, deleteProject, loading } = useRuntimeStore();
  const [name, setName] = useState(project.name);
  const [description, setDescription] = useState(project.description ?? "");
  const [icon, setIcon] = useState(projectIcon(project));
  const [color, setColor] = useState(projectColor(project));
  const [contextMode, setContextMode] = useState(typeof project.settings?.contextMode === "string" ? project.settings.contextMode : "default");

  const save = async () => {
    if (!name.trim()) return;
    await updateProject(project.id, {
      name: name.trim(),
      description: description.trim(),
      settings: { ...project.settings, icon, color, contextMode },
    });
    onClose();
  };

  const remove = async () => {
    const confirmed = window.confirm(t("project.deleteConfirm", { name: project.name }));
    if (!confirmed) return;
    await deleteProject(project.id);
    onClose();
  };

  return (
    <div className="settings-panel">
      <div className="project-modal-body">
        <div className="popover-wrap">
          <span className="project-icon-button" style={{ background: color }}>{icon}</span>
        </div>
        <input className="project-name-input" value={name} onChange={(event) => setName(event.target.value)} placeholder={t("project.namePlaceholder")} />
      </div>
      <div className="emoji-grid">
        {EMOJI_PRESETS.map((preset) => (
          <button key={preset} className={icon === preset ? "emoji-cell on" : "emoji-cell"} onClick={() => setIcon(preset)}>
            {preset}
          </button>
        ))}
      </div>
      <div className="color-row">
        {COLOR_PRESETS.map((preset) => (
          <button key={preset} className={color === preset ? "color-swatch on" : "color-swatch"} style={{ background: preset }} onClick={() => setColor(preset)} aria-label={preset} />
        ))}
      </div>
      <label className="setting-row">
        <span>{t("project.description")}</span>
        <input value={description} onChange={(event) => setDescription(event.target.value)} />
      </label>
      <div className="popover-label">{t("project.context")}</div>
      <div className="context-options-row">
        {(["default", "project_only"] as const).map((mode) => (
          <button key={mode} className={contextMode === mode ? "context-option on" : "context-option"} onClick={() => setContextMode(mode)}>
            <div>
              <strong>{t(CONTEXT_LABEL[mode])}</strong>
              <small>{t(mode === "default" ? "project.contextDefaultDesc" : "project.contextProjectOnlyDesc")}</small>
            </div>
            {contextMode === mode && <Check size={15} />}
          </button>
        ))}
      </div>
      <div className="settings-actions">
        <button className="primary" onClick={() => void save()} disabled={loading || !name.trim()}>
          {t("common.save")}
        </button>
        <button className="danger-text" onClick={() => void remove()} disabled={loading}>
          {t("project.delete")}
        </button>
      </div>
    </div>
  );
}

export function ProjectOffice({ projectId }: { projectId: string }) {
  const { t } = useT();
  const { liveAgents, appSettings } = useRuntimeStore();
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

  if (!office) return <p className="muted">{t("workshop.loadingOffice")}</p>;

  return (
    <div className="content-stack" style={{ padding: 0 }}>
      <div className="office-editor-grid">
        <label className="setting-row">
          <span>{t("workshop.behavior")}</span>
          <select value={office.behaviorMode} onChange={(event) => void update({ behaviorMode: event.target.value as import("@yanshi/shared").BehaviorMode })}>
            {BEHAVIOR_OPTIONS.map((mode) => (
              <option key={mode} value={mode}>
                {mode}
              </option>
            ))}
          </select>
        </label>
        <label className="setting-row">
          <span>{t("workshop.camera")}</span>
          <select value={office.cameraMode} onChange={(event) => void update({ cameraMode: event.target.value as import("@yanshi/shared").CameraMode })}>
            <option value="rear">{t("workshop.cameraRear")}</option>
            <option value="iso">{t("workshop.cameraIso")}</option>
          </select>
        </label>
      </div>
      <div className="office-canvas" style={{ height: 320 }}>
        <Suspense fallback={<div className="scene-loading">{t("atelier.loading")}</div>}>
          <LiveOfficeScene
            agents={liveAgents}
            compact
            cameraMode={office.cameraMode}
            stationLayout={office.stationLayout}
            furniture={office.furniture ?? []}
            dark={document.documentElement.dataset.theme === "dark"}
            lowPower={appSettings ? !appSettings.gpuAcceleration : false}
          />
        </Suspense>
      </div>
    </div>
  );
}

export function ProjectFiles({ projectId }: { projectId: string }) {
  const { t } = useT();
  const [files, setFiles] = useState<import("@yanshi/shared").WorkspaceFile[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setFiles(null);
    setFailed(false);
    runtimeApi
      .projectFiles(projectId)
      .then((result) => {
        if (cancelled) return;
        setFiles(result.structuredOutput.items ?? []);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        // The toast carries the error (code + reason); the list area stays a neutral retry state.
        reportError("YANSHI_FILE_002", err);
        setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [projectId, attempt]);

  if (failed) {
    return (
      <div className="load-retry">
        <p className="transcript-empty">{t("project.noFiles")}</p>
        <button onClick={() => setAttempt((value) => value + 1)}>{t("error.retry")}</button>
      </div>
    );
  }
  if (!files) return <p className="muted">{t("common.loading")}</p>;
  if (files.length === 0) return <p className="transcript-empty">{t("project.noFiles")}</p>;

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
