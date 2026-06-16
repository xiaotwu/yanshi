import { Check, File, FileCode, FileJson, FileText, Folder, Image as ImageIcon } from "lucide-react";
import { Fragment, type ReactNode } from "react";
import type { MacosPermissionStatus, RunSummary } from "@yanshi/shared";

const CODE_EXTS = new Set([
  "js", "jsx", "ts", "tsx", "py", "go", "rs", "java", "c", "h", "cpp", "rb", "php", "sh", "css", "html", "sql", "yml", "yaml", "toml",
]);
const DOC_EXTS = new Set(["md", "txt", "pdf", "doc", "docx", "rtf", "csv"]);
const IMAGE_RE = /^(png|jpe?g|gif|webp|svg|bmp|heic|ico|avif)$/;

/** Type-aware file icon for Library rows and the panel Files list. */
export function FileTypeIcon({ name, type, size = 15 }: { name: string; type?: string; size?: number }) {
  if (type === "folder" || type === "directory") return <Folder size={size} />;
  const ext = (name.split(".").pop() ?? "").toLowerCase();
  if (IMAGE_RE.test(ext)) return <ImageIcon size={size} />;
  if (ext === "json") return <FileJson size={size} />;
  if (CODE_EXTS.has(ext)) return <FileCode size={size} />;
  if (DOC_EXTS.has(ext)) return <FileText size={size} />;
  return <File size={size} />;
}

export type FileCategory = "all" | "image" | "code" | "data" | "doc" | "other";

/** Coarse category for Library type facets. */
export function fileCategory(name: string, type?: string): Exclude<FileCategory, "all"> {
  if (type === "folder" || type === "directory") return "other";
  const ext = (name.split(".").pop() ?? "").toLowerCase();
  if (IMAGE_RE.test(ext)) return "image";
  if (["json", "csv", "yml", "yaml", "toml"].includes(ext)) return "data";
  if (CODE_EXTS.has(ext)) return "code";
  if (["md", "txt", "pdf", "doc", "docx", "rtf"].includes(ext)) return "doc";
  return "other";
}

import { useT } from "../i18n";
import type { TKey } from "../i18n/en";

/** The translator returned by `useT()`. */
export type Translator = (key: TKey, vars?: Record<string, string | number>) => string;

// "runs" is the internal task-detail surface (reached from Recents / project task lists);
// the user-facing top-level nav shows Library instead of a technical Runs page.
export type View = "new-task" | "search" | "projects" | "project" | "runs" | "library" | "approvals" | "developer";
export type PermissionMode = "default" | "auto_review" | "full_access";
export type RunGrouping = "time" | "project" | "status";
export const STATION_OPTIONS = ["manager", "browser", "computer", "file", "reviewer", "terminal"];
export const BEHAVIOR_OPTIONS: import("@yanshi/shared").BehaviorMode[] = ["professional", "balanced", "playful"];

export function projectIcon(project: { settings?: Record<string, unknown> }): string {
  const icon = project.settings?.icon;
  return typeof icon === "string" && icon ? icon : "📁";
}

export function projectColor(project: { settings?: Record<string, unknown> }): string {
  const color = project.settings?.color;
  return typeof color === "string" && color ? color : "var(--accent)";
}

/** The project's emoji on its background color — used identically in the sidebar, project
 *  header, Add-to-Project menu, search results and Library so the customization is consistent. */
export function ProjectGlyph({ project, size = "sm" }: { project: { settings?: Record<string, unknown> }; size?: "sm" | "lg" }) {
  return (
    <span className={`proj-emoji glyph ${size}`} style={{ background: projectColor(project) }} aria-hidden>
      {projectIcon(project)}
    </span>
  );
}

export function EmptyView({ title, text, icon }: { title: string; text: string; icon?: ReactNode }) {
  return (
    <section className="empty-view">
      {icon && <span className="empty-view-icon">{icon}</span>}
      <h2>{title}</h2>
      <p>{text}</p>
    </section>
  );
}

/**
 * Plan rendered as a vertical stepper with connectors. Honest about state: when the run has
 * completed (`done`), steps show a check; otherwise numbered badges (we don't fake per-step
 * "active" state the runtime doesn't track).
 */
export function PlanSteps({ steps, done = false }: { steps: string[]; done?: boolean }) {
  return (
    <ol className={done ? "plan-steps done" : "plan-steps"}>
      {steps.map((step, index) => (
        <li key={index} className="plan-step">
          <span className="plan-badge">{done ? <Check size={11} /> : index + 1}</span>
          <span className="plan-step-text">{step}</span>
        </li>
      ))}
    </ol>
  );
}

export const AGENT_LABELS: Record<string, string> = {
  agent_manager: "Manager",
  agent_browser: "Browser",
  agent_computer: "Computer",
  agent_file: "File",
  agent_terminal: "Terminal",
  agent_reviewer: "Reviewer",
};

const AGENT_KEYS: Record<string, TKey> = {
  agent_manager: "agent.manager",
  agent_browser: "agent.browser",
  agent_computer: "agent.computer",
  agent_file: "agent.file",
  agent_terminal: "agent.terminal",
  agent_reviewer: "agent.reviewer",
};

/**
 * Display name for an agent. When a translator is supplied the role name is localized;
 * the no-translator form (used in tests/utilities) falls back to the English label.
 */
export function agentLabel(agentId: unknown, t?: Translator): string {
  if (typeof agentId === "string" && agentId in AGENT_KEYS) {
    return t ? t(AGENT_KEYS[agentId]) : AGENT_LABELS[agentId];
  }
  return t ? t("brand") : "Yanshi";
}

/** Localized display name for an agent in lists: core roles use the localized role label;
 *  user-renamed/custom agents keep their own name. */
export function agentDisplayName(agentId: string, fallbackName: string, t: Translator): string {
  return agentId in AGENT_KEYS ? t(AGENT_KEYS[agentId]) : fallbackName;
}

const STATUS_KEYS: Record<RunSummary["status"], TKey> = {
  created: "status.created",
  running: "status.running",
  pending_approval: "status.pending_approval",
  paused: "status.paused",
  completed: "status.completed",
  failed: "status.failed",
  cancelled: "status.cancelled",
};

/** Localized label for a run status (replaces the raw English `status.replace("_"," ")`). */
export function statusLabel(status: RunSummary["status"], t: Translator): string {
  const key = STATUS_KEYS[status];
  return key ? t(key) : status.replace("_", " ");
}

const AGENT_STATE_KEYS: Record<string, TKey> = {
  idle: "agentState.idle",
  working: "agentState.working",
  done: "agentState.done",
  failed: "agentState.failed",
  busy: "agentState.busy",
};

/** Localized label for an agent's bare activity state (idle/working/done/…). */
export function agentStateLabel(state: string, t: Translator): string {
  const key = AGENT_STATE_KEYS[state];
  return key ? t(key) : state;
}

const DEFAULT_GROUP_LABELS = { today: "Today", standalone: "Standalone", project: "Project" };

export function groupRuns(
  runs: import("@yanshi/shared").RunSummary[],
  grouping: RunGrouping,
  projects: import("@yanshi/shared").ProjectSummary[],
  labels: { today: string; standalone: string; project: string } = DEFAULT_GROUP_LABELS,
): Array<{ label: string; runs: import("@yanshi/shared").RunSummary[] }> {
  const buckets = new Map<string, import("@yanshi/shared").RunSummary[]>();
  const labelFor = (run: import("@yanshi/shared").RunSummary): string => {
    if (grouping === "status") return run.status.replace("_", " ");
    if (grouping === "project") return run.projectId ? projects.find((p) => p.id === run.projectId)?.name ?? labels.project : labels.standalone;
    const day = run.createdAt.slice(0, 10);
    const today = new Date().toISOString().slice(0, 10);
    return day === today ? labels.today : day;
  };
  for (const run of runs) {
    const label = labelFor(run);
    const list = buckets.get(label) ?? [];
    list.push(run);
    buckets.set(label, list);
  }
  return [...buckets.entries()].map(([label, list]) => ({ label, runs: list }));
}

/**
 * Display name for a generated output: the real file name (basename of the path) is primary;
 * the artifact title (e.g. "File scan") is only a fallback when no path exists. Never invents
 * metadata — empty in, empty out.
 */
export function outputFileName(path: string | null | undefined, title?: string | null): string {
  const base = path ? (path.split("/").filter(Boolean).pop() ?? "") : "";
  return base || (title ?? "").trim() || (path ?? "");
}

export function eventSummary(payload: Record<string, unknown>): string {
  if (typeof payload.summary === "string") return payload.summary;
  if (typeof payload.task === "string") return payload.task;
  if (Array.isArray(payload.steps)) return payload.steps.join(" · ");
  if (typeof payload.request === "string") return payload.request;
  return JSON.stringify(payload);
}

export function permissionSummary(status: MacosPermissionStatus | null): string {
  if (!status) return "Desktop permission status unavailable.";
  return `Accessibility ${permissionLabel(status.accessibility).toLowerCase()} · Screen ${permissionLabel(status.screenRecording).toLowerCase()}`;
}

export function permissionLabel(state: string): string {
  if (state === "granted") return "Granted";
  if (state === "permission_required") return "Required";
  if (state === "unsupported") return "Unsupported";
  return "Unknown";
}

export function TranscriptMessage({ event, developerMode }: { event: import("@yanshi/shared").YanshiEvent; developerMode: boolean }) {
  const { t } = useT();
  const output = (event.payload.structuredOutput ?? {}) as Record<string, unknown>;
  const entries = Object.entries(output).filter(([, value]) => typeof value !== "object" || value === null);
  const hasDetails = entries.length > 0 || developerMode;
  return (
    <article className={event.payload.error ? "event-card error" : "event-card"}>
      <span>{agentLabel(event.payload.agentId ?? event.agentId, t)}</span>
      <p>{eventSummary(event.payload)}</p>
      {hasDetails && (
        <details className="msg-details">
          <summary>{t("tasks.details")}</summary>
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
