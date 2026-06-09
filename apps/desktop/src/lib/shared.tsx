import { Fragment } from "react";
import type { MacosPermissionStatus } from "@yanshi/shared";

export type View = "new-task" | "search" | "projects" | "runs" | "workshop" | "settings" | "approvals" | "artifacts" | "developer";
export type PermissionMode = "default" | "auto_review" | "full_access";
export type RunGrouping = "time" | "project" | "status";
export const STATION_OPTIONS = ["manager", "browser", "computer", "file", "reviewer", "terminal"];
export const BEHAVIOR_OPTIONS: import("@yanshi/shared").BehaviorMode[] = ["professional", "balanced", "playful"];

export function EmptyView({ title, text }: { title: string; text: string }) {
  return (
    <section className="empty-view">
      <h2>{title}</h2>
      <p>{text}</p>
    </section>
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

export function agentLabel(agentId: unknown): string {
  if (typeof agentId === "string" && agentId in AGENT_LABELS) return AGENT_LABELS[agentId];
  return "Yanshi";
}

export function groupRuns(
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
