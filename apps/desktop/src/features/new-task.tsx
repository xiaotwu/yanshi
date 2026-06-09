import { Boxes, Check, ChevronDown, Globe, ListChecks, Loader2, Mic, MonitorSmartphone, Plus, Send, Shield, Sparkles, TerminalSquare, Upload, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { runtimeApi } from "../api/client";
import type { PermissionMode } from "../lib/shared";
import { useRuntimeStore } from "../stores/runtimeStore";

export const TOOL_HINTS: Record<string, string> = {
  browser: "Use the browser.",
  computer: "Use the computer.",
  terminal: "Use the terminal.",
};

export function NewTaskView({ onRuns }: { onRuns: () => void }) {
  const [task, setTask] = useState("");
  const { createRun, loading, error, appSettings, projects, activeProjectId } = useRuntimeStore();
  const [permissionMode, setPermissionMode] = useState<PermissionMode>(appSettings?.permissionModeDefault ?? "default");
  const [reasoning, setReasoning] = useState<"low" | "medium" | "high" | "extra_high">(appSettings?.reasoning ?? "medium");
  const [selectedProjectId, setSelectedProjectId] = useState(activeProjectId ?? "standalone");
  const [planFirst, setPlanFirst] = useState(false);
  const [tools, setTools] = useState<string[]>([]);
  const [plusOpen, setPlusOpen] = useState(false);
  const [attachments, setAttachments] = useState<Array<{ name: string; path: string }>>([]);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { listening, voiceAvailable, toggleVoice } = useVoiceInput((text) => setTask((prev) => (prev ? `${prev} ${text}` : text)));

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
              className={plusOpen ? "icon-button active" : "icon-button"}
              title="Add"
              onClick={() => setPlusOpen((open) => !open)}
            >
              <Plus size={18} />
            </button>
            {plusOpen && (
              <div className="plus-menu" onMouseLeave={() => setPlusOpen(false)}>
                <button className="menu-row" onClick={() => { fileInputRef.current?.click(); setPlusOpen(false); }}>
                  <Upload size={15} /> Upload files
                </button>
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
          <label className="select-chip" title="Reasoning">
            <Sparkles size={15} />
            <select value={reasoning} onChange={(event) => setReasoning(event.target.value as typeof reasoning)}>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="extra_high">Extra</option>
            </select>
            <ChevronDown size={14} />
          </label>
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
        {(planFirst || tools.length > 0 || attachments.length > 0) && (
          <div className="composer-flags">
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
