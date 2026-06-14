import {
  Check,
  ChevronRight,
  FolderMinus,
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
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import type { ProjectSummary } from "@yanshi/shared";

import { runtimeApi } from "../api/client";
import { useT } from "../i18n";
import { reportError } from "../lib/errors";
import { MENU_GAP, placeAnchoredMenu, placeSubmenu } from "../lib/menu-placement";
import { ProjectGlyph, projectIcon } from "../lib/shared";
import type { PermissionMode } from "../lib/shared";
import { useRuntimeStore } from "../stores/runtimeStore";
import { CreateProjectModal } from "./create-project-modal";

export const TOOL_HINTS: Record<string, string> = {
  browser: "Use the browser.",
  computer: "Use the computer.",
  terminal: "Use the terminal.",
};

type Reasoning = "low" | "medium" | "high" | "extra_high";
const REASONING_LEVELS: Reasoning[] = ["low", "medium", "high", "extra_high"];
const PERMISSION_MODES: PermissionMode[] = ["default", "auto_review", "full_access"];

function PermissionIcon({ mode, size = 17 }: { mode: PermissionMode; size?: number }) {
  if (mode === "full_access") return <ShieldAlert size={size} />;
  if (mode === "auto_review") return <ShieldCheck size={size} />;
  return <Shield size={size} />;
}

/**
 * The task composer, shared by the home page and the project page. When `lockedProject` is set the
 * composer is project-scoped: the placeholder names the project, runs are created in it, and the
 * Add-to-Project menu entry is hidden. Otherwise the project is chosen via the "+" menu —
 * "Standalone" is not a listed option: no selection simply means a standalone task.
 */
export function Composer({ lockedProject = null, onSubmitted }: { lockedProject?: ProjectSummary | null; onSubmitted: () => void }) {
  const { t } = useT();
  const [task, setTask] = useState("");
  const { createRun, loading, appSettings, projects } = useRuntimeStore();
  const [permissionMode, setPermissionMode] = useState<PermissionMode>(appSettings?.permissionModeDefault ?? "default");
  const [reasoning, setReasoning] = useState<Reasoning>(appSettings?.reasoning ?? "medium");
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [planFirst, setPlanFirst] = useState(false);
  const [tools, setTools] = useState<string[]>([]);
  const [menu, setMenu] = useState<null | "plus" | "effort" | "permission">(null);
  const [projectExpanded, setProjectExpanded] = useState(false);
  const [projectModalOpen, setProjectModalOpen] = useState(false);
  const [attachments, setAttachments] = useState<Array<{ name: string; path: string }>>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const plusWrapRef = useRef<HTMLDivElement>(null);
  const plusMenuRef = useRef<HTMLDivElement>(null);
  const projectRowRef = useRef<HTMLButtonElement>(null);
  const submenuRef = useRef<HTMLDivElement>(null);
  const [plusMenuStyle, setPlusMenuStyle] = useState<CSSProperties | undefined>();
  const [submenuStyle, setSubmenuStyle] = useState<CSSProperties | undefined>();
  const { listening, voiceAvailable, toggleVoice } = useVoiceInput((text) => setTask((prev) => (prev ? `${prev} ${text}` : text)));

  const effectiveProjectId = lockedProject ? lockedProject.id : selectedProjectId;
  const selectedProject = lockedProject ?? projects.find((p) => p.id === selectedProjectId) ?? null;

  const uploadFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    try {
      const result = await runtimeApi.uploadFiles(effectiveProjectId, Array.from(files));
      setAttachments((prev) => [...prev, ...result.files.map((file) => ({ name: file.name, path: file.path }))]);
    } catch (err) {
      reportError("YANSHI_FILE_001", err);
    }
  };

  useEffect(() => {
    if (appSettings?.permissionModeDefault) setPermissionMode(appSettings.permissionModeDefault);
  }, [appSettings?.permissionModeDefault]);

  useEffect(() => {
    if (selectedProjectId && !projects.some((project) => project.id === selectedProjectId)) {
      setSelectedProjectId(null);
    }
  }, [projects, selectedProjectId]);

  // Global shortcut targets (focus-composer / upload-file dispatch through DOM events from App).
  useEffect(() => {
    const onFocus = () => textareaRef.current?.focus();
    const onUpload = () => fileInputRef.current?.click();
    window.addEventListener("yanshi:focus-composer", onFocus);
    window.addEventListener("yanshi:upload-file", onUpload);
    return () => {
      window.removeEventListener("yanshi:focus-composer", onFocus);
      window.removeEventListener("yanshi:upload-file", onUpload);
    };
  }, []);

  const toggleTool = (tool: string) =>
    setTools((prev) => (prev.includes(tool) ? prev.filter((item) => item !== tool) : [...prev, tool]));

  const closeMenus = () => {
    setMenu(null);
    setProjectExpanded(false);
  };

  // V2/UX8/#10: keep the "+" menu inside the viewport — flip upward when the
  // space below the trigger is insufficient, and clamp height to available space.
  useLayoutEffect(() => {
    if (menu !== "plus") {
      setPlusMenuStyle(undefined);
      return;
    }
    const wrap = plusWrapRef.current;
    const el = plusMenuRef.current;
    if (!wrap || !el) return;
    const contentHeight = el.scrollHeight + (el.offsetHeight - el.clientHeight);
    const placement = placeAnchoredMenu(wrap.getBoundingClientRect(), contentHeight, window.innerHeight);
    setPlusMenuStyle(
      placement.direction === "up"
        ? { top: "auto", bottom: `calc(100% + ${MENU_GAP}px)`, maxHeight: placement.maxHeight }
        : { top: `calc(100% + ${MENU_GAP}px)`, bottom: "auto", maxHeight: placement.maxHeight },
    );
  }, [menu, projects.length]);

  // The Add-to-Project flyout is fixed-positioned and placed independently of
  // the parent row: shifted up when the bottom would overflow, flipped to the
  // menu's left side when the right edge would overflow.
  useLayoutEffect(() => {
    if (menu !== "plus" || !projectExpanded) {
      setSubmenuStyle(undefined);
      return;
    }
    const row = projectRowRef.current;
    const menuEl = plusMenuRef.current;
    const el = submenuRef.current;
    if (!row || !menuEl || !el) return;
    const placement = placeSubmenu(
      row.getBoundingClientRect(),
      menuEl.getBoundingClientRect(),
      { width: el.offsetWidth, height: el.scrollHeight + (el.offsetHeight - el.clientHeight) },
      { width: window.innerWidth, height: window.innerHeight },
    );
    setSubmenuStyle({ position: "fixed", top: placement.top, left: placement.left, maxHeight: placement.maxHeight });
  }, [menu, projectExpanded, projects.length, plusMenuStyle]);

  const submit = async () => {
    if (!task.trim()) return;
    const directives = tools.map((tool) => TOOL_HINTS[tool]).join(" ");
    const attachmentNote = attachments.length > 0 ? ` Uploaded files: ${attachments.map((file) => file.path).join(", ")}.` : "";
    const composed = `${task.trim()}${directives ? ` ${directives}` : ""}${attachmentNote}`;
    await createRun(composed, permissionMode, effectiveProjectId, planFirst, reasoning);
    setTask("");
    setTools([]);
    setPlanFirst(false);
    setAttachments([]);
    onSubmitted();
  };

  const placeholder = lockedProject ? t("composer.placeholderProject", { name: lockedProject.name }) : t("composer.placeholder");

  return (
    <div className="composer-block">
      <div className="composer">
        <div className="plus-wrap" ref={plusWrapRef}>
          <button
            className={menu === "plus" ? "icon-button active" : "icon-button"}
            title={t("composer.add")}
            onClick={() => setMenu(menu === "plus" ? null : "plus")}
          >
            <Plus size={18} />
          </button>
          {menu === "plus" && (
            <div className="plus-menu left" ref={plusMenuRef} style={plusMenuStyle} onMouseLeave={closeMenus}>
              <button className="menu-row" onClick={() => { fileInputRef.current?.click(); closeMenus(); }}>
                <Upload size={15} /> {t("composer.uploadFiles")}
              </button>
              <button className={planFirst ? "menu-row on" : "menu-row"} onClick={() => setPlanFirst((value) => !value)}>
                <ListChecks size={15} /> {t("composer.planFirst")} {planFirst && <Check size={14} className="menu-check" />}
              </button>
              <div className="menu-divider" />
              <button className={tools.includes("browser") ? "menu-row on" : "menu-row"} onClick={() => toggleTool("browser")}>
                <Globe size={15} /> {t("composer.useBrowser")} {tools.includes("browser") && <Check size={14} className="menu-check" />}
              </button>
              <button className={tools.includes("computer") ? "menu-row on" : "menu-row"} onClick={() => toggleTool("computer")}>
                <MonitorSmartphone size={15} /> {t("composer.useComputer")} {tools.includes("computer") && <Check size={14} className="menu-check" />}
              </button>
              <button className={tools.includes("terminal") ? "menu-row on" : "menu-row"} onClick={() => toggleTool("terminal")}>
                <TerminalSquare size={15} /> {t("composer.useTerminal")} {tools.includes("terminal") && <Check size={14} className="menu-check" />}
              </button>
              {!lockedProject && (
                <>
                  <div className="menu-divider" />
                  <button className="menu-row" ref={projectRowRef} onClick={() => setProjectExpanded((value) => !value)}>
                    <FolderPlus size={15} /> {t("composer.addToProject")}
                    <ChevronRight size={14} className="menu-chevron" />
                  </button>
                  {projectExpanded && (
                    <div
                      className="menu-submenu floating"
                      ref={submenuRef}
                      style={submenuStyle ?? { position: "fixed", top: 0, left: 0, visibility: "hidden" }}
                    >
                      {projects.map((project) => (
                        <button
                          key={project.id}
                          className={selectedProjectId === project.id ? "menu-row sub on" : "menu-row sub"}
                          onClick={() => { setSelectedProjectId(project.id); closeMenus(); }}
                        >
                          <ProjectGlyph project={project} /> {project.name}
                          {selectedProjectId === project.id && <Check size={13} className="menu-check" />}
                        </button>
                      ))}
                      {selectedProjectId && (
                        <button className="menu-row sub" onClick={() => { setSelectedProjectId(null); closeMenus(); }}>
                          <FolderMinus size={14} /> {t("composer.removeFromProject")}
                        </button>
                      )}
                      <button className="menu-row sub" onClick={() => { setProjectModalOpen(true); closeMenus(); }}>
                        <Plus size={14} /> {t("composer.newProject")}
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
        <textarea
          ref={textareaRef}
          value={task}
          onChange={(event) => setTask(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              void submit();
            }
          }}
          placeholder={placeholder}
          rows={1}
          data-composer
        />
        <div className="plus-wrap">
          <button
            className={menu === "effort" ? "icon-button active" : "icon-button"}
            title={`${t("effort.label")}: ${t(`effort.${reasoning}`)}`}
            onClick={() => setMenu(menu === "effort" ? null : "effort")}
          >
            <Gauge size={17} />
          </button>
          {menu === "effort" && (
            <div className="plus-menu left compact" onMouseLeave={() => setMenu(null)}>
              {REASONING_LEVELS.map((level) => (
                <button key={level} className={reasoning === level ? "menu-row on" : "menu-row"} onClick={() => { setReasoning(level); setMenu(null); }}>
                  {t(`effort.${level}`)} {reasoning === level && <Check size={13} className="menu-check" />}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="plus-wrap">
          <button
            className={`icon-button perm-${permissionMode}${menu === "permission" ? " active" : ""}`}
            title={`${t("permission.label")}: ${t(`permission.${permissionMode}`)}`}
            onClick={() => setMenu(menu === "permission" ? null : "permission")}
          >
            <PermissionIcon mode={permissionMode} />
          </button>
          {menu === "permission" && (
            <div className="plus-menu left compact" onMouseLeave={() => setMenu(null)}>
              {PERMISSION_MODES.map((mode) => (
                <button key={mode} className={`menu-row${permissionMode === mode ? " on" : ""}`} onClick={() => { setPermissionMode(mode); setMenu(null); }}>
                  <PermissionIcon mode={mode} size={15} /> {t(`permission.${mode}`)} {permissionMode === mode && <Check size={13} className="menu-check" />}
                </button>
              ))}
            </div>
          )}
        </div>
        <button
          className={listening ? "icon-button active" : "icon-button"}
          title={voiceAvailable ? (listening ? t("composer.stop") : t("composer.voice")) : t("composer.voiceUnavailable")}
          onClick={toggleVoice}
          disabled={!voiceAvailable}
        >
          <Mic size={18} />
        </button>
        <button className="send-button" onClick={() => void submit()} disabled={loading || !task.trim()} title={t("composer.run")}>
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
      {(planFirst || tools.length > 0 || attachments.length > 0 || (!lockedProject && selectedProject)) && (
        <div className="composer-flags">
          {!lockedProject && selectedProject && (
            <span className="flag-chip file-chip">
              {projectIcon(selectedProject)} {selectedProject.name}
              <button onClick={() => setSelectedProjectId(null)} title={t("composer.remove")}>
                <X size={12} />
              </button>
            </span>
          )}
          {planFirst && <span className="flag-chip">{t("composer.planFirst")}</span>}
          {tools.map((tool) => (
            <span key={tool} className="flag-chip">
              {tool}
            </span>
          ))}
          {attachments.map((file, index) => (
            <span key={file.path} className="flag-chip file-chip">
              {file.name}
              <button onClick={() => setAttachments((prev) => prev.filter((_, i) => i !== index))} title={t("composer.remove")}>
                <X size={12} />
              </button>
            </span>
          ))}
        </div>
      )}
      {projectModalOpen && (
        <CreateProjectModal
          onClose={() => setProjectModalOpen(false)}
          onCreated={(id) => { setSelectedProjectId(id); setProjectModalOpen(false); }}
        />
      )}
    </div>
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
