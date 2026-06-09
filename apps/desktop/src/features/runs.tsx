import { Check, Shield, X } from "lucide-react";
import { useState } from "react";

import { EmptyView, TranscriptMessage, eventSummary, groupRuns } from "../lib/shared";
import type { RunGrouping } from "../lib/shared";
import { useRuntimeStore } from "../stores/runtimeStore";

export const TRANSCRIPT_EVENT_TYPES = new Set(["observation.created", "artifact.created"]);
export function RunsView() {
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
