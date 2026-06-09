import {
  Check,
  ChevronRight,
  FolderPlus,
  Gauge,
  Globe,
  ListChecks,
  Loader2,
  Mic,
  MonitorSmartphone,
  Plus,
  Send,
  Shield,
  ShieldAlert,
  ShieldCheck,
  TerminalSquare,
  Upload,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { runtimeApi } from "../api/client";
import type { PermissionMode } from "../lib/shared";
import { useRuntimeStore } from "../stores/runtimeStore";

export const TOOL_HINTS: Record<string, string> = {
  browser: "Use the browser.",
  computer: "Use the computer.",
  terminal: "Use the terminal.",
};

type Reasoning = "low" | "medium" | "high" | "extra_high";
const REASONING_LABELS: Record<Reasoning, string> = { low: "Low", medium: "Medium", high: "High", extra_high: "Extra" };
const PERMISSION_LABELS: Record<PermissionMode, string> = { default: "Default", auto_review: "Auto-review", full_access: "Full access" };

function PermissionIcon({ mode, size = 17 }: { mode: PermissionMode; size?: number }) {
  if (mode === "full_access") return <ShieldAlert size={size} />;
  if (mode === "auto_review") return <ShieldCheck size={size} />;
  return <Shield size={size} />;
}

function projectIcon(project: { settings?: Record<string, unknown> }): string {
  const icon = project.settings?.icon;
  return typeof icon === "string" && icon ? icon : "📁";
}

export function NewTaskView({ onRuns }: { onRuns: () => void }) {
  const [task, setTask] = useState("");
  const { createRun, createProject, loading, error, appSettings, projects, activeProjectId } = useRuntimeStore();
  const [permissionMode, setPermissionMode] = useState<PermissionMode>(appSettings?.permissionModeDefault ?? "default");
  const [reasoning, setReasoning] = useState<Reasoning>(appSettings?.reasoning ?? "medium");
  const [selectedProjectId, setSelectedProjectId] = useState(activeProjectId ?? "standalone");
  const [planFirst, setPlanFirst] = useState(false);
  const [tools, setTools] = useState<string[]>([]);
  const [menu, setMenu] = useState<null | "plus" | "effort" | "permission">(null);
  const [projectExpanded, setProjectExpanded] = useState(false);
  const [newProject, setNewProject] = useState<{ icon: string; name: string } | null>(null);
  const [attachments, setAttachments] = useState<Array<{ name: string; path: string }>>([]);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { listening, voiceAvailable, toggleVoice } = useVoiceInput((text) => setTask((prev) => (prev ? `${prev} ${text}` : text)));

  const selectedProject = projects.find((p) => p.id === selectedProjectId);

  const uploadFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploadError(null);
    try {
      const projectId = selectedProjectId === "standalone" ? null : selectedProjectId;
      const result = await runtimeApi.uploadFiles(projectId, Array.from(files));
      setAttachments((prev) => [...prev, ...result.files.map((file) => ({ name: file.name, path: file.path }))]);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload failed.");
    }
  };

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

  const closeMenus = () => {
    setMenu(null);
    setProjectExpanded(false);
    setNewProject(null);
  };

  const createNewProject = async () => {
    if (!newProject?.name.trim()) return;
    await createProject(newProject.name.trim(), undefined, newProject.icon || "📁");
    const created = useRuntimeStore.getState().activeProjectId;
    if (created) setSelectedProjectId(created);
    setNewProject(null);
    setProjectExpanded(false);
    setMenu(null);
  };

  const submit = async () => {
    if (!task.trim()) return;
    const directives = tools.map((tool) => TOOL_HINTS[tool]).join(" ");
    const attachmentNote = attachments.length > 0 ? ` Uploaded files: ${attachments.map((file) => file.path).join(", ")}.` : "";
    const composed = `${task.trim()}${directives ? ` ${directives}` : ""}${attachmentNote}`;
    await createRun(composed, permissionMode, selectedProjectId === "standalone" ? null : selectedProjectId, planFirst, reasoning);
    setTask("");
    setTools([]);
    setPlanFirst(false);
    setAttachments([]);
    onRuns();
  };

  return (
    <section className="center-stage">
      <div className="composer-wrap">
        <h1>How can Yanshi help you today?</h1>
        <div className="composer">
          <div className="plus-wrap">
            <button
              className={menu === "plus" ? "icon-button active" : "icon-button"}
              title="Add"
              onClick={() => setMenu(menu === "plus" ? null : "plus")}
            >
              <Plus size={18} />
            </button>
            {menu === "plus" && (
              <div className="plus-menu left" onMouseLeave={closeMenus}>
                <button className="menu-row" onClick={() => { fileInputRef.current?.click(); closeMenus(); }}>
                  <Upload size={15} /> Upload files
                </button>
                <button className={planFirst ? "menu-row on" : "menu-row"} onClick={() => setPlanFirst((value) => !value)}>
                  <ListChecks size={15} /> Plan first {planFirst && <Check size={14} className="menu-check" />}
                </button>
                <div className="menu-divider" />
                <button className={tools.includes("browser") ? "menu-row on" : "menu-row"} onClick={() => toggleTool("browser")}>
                  <Globe size={15} /> Use Browser {tools.includes("browser") && <Check size={14} className="menu-check" />}
                </button>
                <button className={tools.includes("computer") ? "menu-row on" : "menu-row"} onClick={() => toggleTool("computer")}>
                  <MonitorSmartphone size={15} /> Use Computer {tools.includes("computer") && <Check size={14} className="menu-check" />}
                </button>
                <button className={tools.includes("terminal") ? "menu-row on" : "menu-row"} onClick={() => toggleTool("terminal")}>
                  <TerminalSquare size={15} /> Use Terminal {tools.includes("terminal") && <Check size={14} className="menu-check" />}
                </button>
                <div className="menu-divider" />
                <button className="menu-row" onClick={() => setProjectExpanded((value) => !value)}>
                  <FolderPlus size={15} /> Add to Project
                  <ChevronRight size={14} className="menu-chevron" style={{ transform: projectExpanded ? "rotate(90deg)" : "none" }} />
                </button>
                {projectExpanded && (
                  <div className="menu-submenu">
                    <button className={selectedProjectId === "standalone" ? "menu-row sub on" : "menu-row sub"} onClick={() => { setSelectedProjectId("standalone"); closeMenus(); }}>
                      <span className="proj-emoji">▫︎</span> Standalone {selectedProjectId === "standalone" && <Check size={13} className="menu-check" />}
                    </button>
                    {projects.map((project) => (
                      <button
                        key={project.id}
                        className={selectedProjectId === project.id ? "menu-row sub on" : "menu-row sub"}
                        onClick={() => { setSelectedProjectId(project.id); closeMenus(); }}
                      >
                        <span className="proj-emoji">{projectIcon(project)}</span> {project.name}
                        {selectedProjectId === project.id && <Check size={13} className="menu-check" />}
                      </button>
                    ))}
                    {newProject === null ? (
                      <button className="menu-row sub" onClick={() => setNewProject({ icon: "📁", name: "" })}>
                        <Plus size={14} /> New project…
                      </button>
                    ) : (
                      <div className="new-project-row">
                        <input
                          className="emoji-input"
                          value={newProject.icon}
                          onChange={(event) => setNewProject({ ...newProject, icon: event.target.value.slice(0, 2) })}
                          aria-label="Project icon"
                        />
                        <input
                          className="new-project-name"
                          autoFocus
                          value={newProject.name}
                          placeholder="Project name"
                          onChange={(event) => setNewProject({ ...newProject, name: event.target.value })}
                          onKeyDown={(event) => event.key === "Enter" && void createNewProject()}
                        />
                        <button className="ghost-button" disabled={!newProject.name.trim()} onClick={() => void createNewProject()}>
                          Create
                        </button>
                      </div>
                    )}
                  </div>
                )}
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
          <div className="plus-wrap">
            <button
              className={menu === "effort" ? "icon-button active" : "icon-button"}
              title={`Effort: ${REASONING_LABELS[reasoning]}`}
              onClick={() => setMenu(menu === "effort" ? null : "effort")}
            >
              <Gauge size={17} />
            </button>
            {menu === "effort" && (
              <div className="plus-menu left compact" onMouseLeave={() => setMenu(null)}>
                {(Object.keys(REASONING_LABELS) as Reasoning[]).map((level) => (
                  <button key={level} className={reasoning === level ? "menu-row on" : "menu-row"} onClick={() => { setReasoning(level); setMenu(null); }}>
                    {REASONING_LABELS[level]} {reasoning === level && <Check size={13} className="menu-check" />}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="plus-wrap">
            <button
              className={`icon-button perm-${permissionMode}${menu === "permission" ? " active" : ""}`}
              title={`Permission: ${PERMISSION_LABELS[permissionMode]}`}
              onClick={() => setMenu(menu === "permission" ? null : "permission")}
            >
              <PermissionIcon mode={permissionMode} />
            </button>
            {menu === "permission" && (
              <div className="plus-menu left compact" onMouseLeave={() => setMenu(null)}>
                {(Object.keys(PERMISSION_LABELS) as PermissionMode[]).map((mode) => (
                  <button key={mode} className={`menu-row${permissionMode === mode ? " on" : ""}`} onClick={() => { setPermissionMode(mode); setMenu(null); }}>
                    <PermissionIcon mode={mode} size={15} /> {PERMISSION_LABELS[mode]} {permissionMode === mode && <Check size={13} className="menu-check" />}
                  </button>
                ))}
              </div>
            )}
          </div>
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
        <input
          ref={fileInputRef}
          type="file"
          multiple
          style={{ display: "none" }}
          onChange={(event) => {
            void uploadFiles(event.target.files);
            event.target.value = "";
          }}
        />
        {(planFirst || tools.length > 0 || attachments.length > 0 || selectedProject) && (
          <div className="composer-flags">
            {selectedProject && (
              <span className="flag-chip file-chip">
                {projectIcon(selectedProject)} {selectedProject.name}
                <button onClick={() => setSelectedProjectId("standalone")} title="Remove">
                  <X size={12} />
                </button>
              </span>
            )}
            {planFirst && <span className="flag-chip">Plan first</span>}
            {tools.map((tool) => (
              <span key={tool} className="flag-chip">
                {tool}
              </span>
            ))}
            {attachments.map((file, index) => (
              <span key={file.path} className="flag-chip file-chip">
                {file.name}
                <button onClick={() => setAttachments((prev) => prev.filter((_, i) => i !== index))} title="Remove">
                  <X size={12} />
                </button>
              </span>
            ))}
          </div>
        )}
        {(error || uploadError) && <p className="inline-error">{error ?? uploadError}</p>}
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

export function useVoiceInput(onText: (text: string) => void) {
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
