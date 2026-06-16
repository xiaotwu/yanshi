import { Check, FolderOpen, Globe, Shield, X } from "lucide-react";
import { useState } from "react";

import { canRevealFiles, revealPath } from "../api/desktop";
import { useT } from "../i18n";
import { FileTypeIcon, PlanSteps, agentDisplayName, agentStateLabel, outputFileName, statusLabel } from "../lib/shared";
import { useRuntimeStore } from "../stores/runtimeStore";

type PanelSection = "progress" | "files" | "approvals" | "agents";

const STATUS_TONE: Record<string, string> = {
  running: "tone-active",
  pending_approval: "tone-warn",
  completed: "tone-ok",
  failed: "tone-danger",
};

/**
 * Compact contextual utility panel. The titlebar owns open/close and the Atelier — this panel
 * has no duplicate chrome. One dropdown selects the section; generated outputs appear under
 * Files (the user-facing Artifacts concept is gone — artifact records surface as file cards,
 * with a Web source link when the metadata carries a URL). No raw logs in normal mode.
 */
export function ProgressPanel({ inChat = false }: { inChat?: boolean }) {
  const { t } = useT();
  const { runs, activeRunId, liveAgents, approvals, events, decideApproval } = useRuntimeStore();
  const [section, setSection] = useState<PanelSection>("progress");
  // The panel is contextual to the open chat. Outside a chat (new chat, Library, …) it must not
  // bleed the last run's status/plan/files — it shows its idle/empty state instead.
  const run = inChat ? runs.find((item) => item.id === activeRunId) ?? null : null;
  const developer = useRuntimeStore((state) => state.appSettings?.developerMode ?? false);

  // Generated outputs for the active chat = its real artifact events presented as files.
  const outputs = events.filter(
    (entry) => entry.event.type === "artifact.created" && (!run || entry.event.runId === run.id),
  );
  const fileOutputs = run ? outputs.filter((entry) => typeof entry.event.payload.path === "string") : [];
  const runApprovals = run ? approvals.filter((approval) => approval.runId === run.id) : [];

  // Latest reviewer telemetry for the active chat (routed here out of the conversation). Built
  // from structured output so it is localized rather than echoing the runtime's English string.
  const reviewerEvent = run
    ? [...events].reverse().find(
        (entry) =>
          entry.event.runId === run.id &&
          entry.event.type === "observation.created" &&
          entry.event.payload.type === "ReviewerObservation",
      )
    : undefined;
  const reviewNote = (() => {
    if (!reviewerEvent) return null;
    const output = (reviewerEvent.event.payload.structuredOutput ?? {}) as Record<string, unknown>;
    if (output.qualityPassed === false || Array.isArray(output.failedAgentTasks) && (output.failedAgentTasks as unknown[]).length > 0) {
      return t("review.failed");
    }
    const completed = Array.isArray(output.completedAgentTasks) ? (output.completedAgentTasks as unknown[]).length : 0;
    return t("review.passed", { count: completed });
  })();

  const sections: Array<{ id: PanelSection; label: string; badge?: number }> = [
    { id: "progress", label: t("progress.tabProgress") },
    { id: "files", label: t("progress.tabFiles"), badge: fileOutputs.length || undefined },
    { id: "approvals", label: t("progress.tabApprovals"), badge: runApprovals.length || undefined },
    { id: "agents", label: t("progress.tabAgents") },
  ];

  return (
    <section className="progress-panel">
      <div className="panel-tabs" role="tablist" aria-label={t("progress.tabProgress")}>
        {sections.map((item) => (
          <button
            key={item.id}
            role="tab"
            aria-selected={section === item.id}
            className={section === item.id ? "panel-tab active" : "panel-tab"}
            onClick={() => setSection(item.id)}
          >
            {item.label}
            {item.badge ? <span className="panel-tab-badge">{item.badge}</span> : null}
          </button>
        ))}
      </div>

      <div className="progress-body" key={section}>
        {section === "progress" && (
          run ? (
            <div className="progress-stack">
              <div className="progress-run">
                <span className="muted">{t("progress.status")}</span>
                <span className={`status-pill ${STATUS_TONE[run.status] ?? ""}`}>{statusLabel(run.status, t)}</span>
              </div>
              <div className="progress-task">{run.task}</div>
              {run.plan.length > 0 && (
                <div className="progress-section">
                  <span className="muted">{t("progress.plan")}</span>
                  <PlanSteps steps={run.plan} done={run.status === "completed"} />
                </div>
              )}
              {reviewNote && (
                <div className="progress-section">
                  <span className="muted">{t("review.title")}</span>
                  <p className="review-note">{reviewNote}</p>
                </div>
              )}
              <div className="progress-section">
                <span className="muted">{t("progress.queue")}</span>
                {(() => {
                  // At rest the full roster is noise — show only agents that are actually busy,
                  // and a compact "all idle" line otherwise. The full roster lives in Agents.
                  const active = liveAgents.filter((agent) => agent.status !== "idle" || agent.queueCount > 0);
                  if (active.length === 0) return <p className="agent-idle muted">{t("progress.allIdle")}</p>;
                  return (
                    <div className="agent-rows">
                      {active.map((agent) => (
                        <div key={agent.id} className="agent-row">
                          <span className={agent.status === "working" ? "agent-dot working" : "agent-dot"} style={{ background: agent.accent }} />
                          <span className="agent-name">{agentDisplayName(agent.id, agent.name, t)}</span>
                          <span className="agent-state muted">{agent.currentTask ?? agentStateLabel(agent.status, t)}</span>
                          {agent.queueCount > 0 && <b>{agent.queueCount}</b>}
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>
            </div>
          ) : (
            <p className="transcript-empty">{t("progress.noRun")}</p>
          )
        )}

        {section === "files" && (
          fileOutputs.length === 0 ? (
            <p className="transcript-empty">{t("progress.noFiles")}</p>
          ) : (
            <div className="progress-list">
              {fileOutputs.map(({ seq, event }) => {
                const url = typeof event.payload.url === "string" ? event.payload.url : null;
                const path = String(event.payload.path);
                const title = typeof event.payload.title === "string" ? event.payload.title : null;
                // Real file name is the primary label; the artifact title ("File scan") is
                // secondary context only — same model as the Library.
                const name = outputFileName(path, title);
                return (
                  <div key={seq} className="progress-item static file-output">
                    <button
                      className="progress-item-main"
                      disabled={!path}
                      onClick={() => canRevealFiles() && void revealPath(path)}
                      title={path}
                    >
                      <FileTypeIcon name={name} size={15} />
                      <span className="file-output-text">
                        <span className="ellipsis">{name}</span>
                        <small className="muted ellipsis">{title && title !== name ? `${title} · ${path}` : path}</small>
                      </span>
                    </button>
                    {url && (
                      <button className="web-source" title={url} onClick={() => window.open(url, "_blank", "noreferrer")}>
                        <Globe size={12} /> {t("library.webSource")}
                      </button>
                    )}
                    {developer && event.payload.summary ? <small className="muted">{String(event.payload.summary)}</small> : null}
                  </div>
                );
              })}
            </div>
          )
        )}

        {section === "approvals" && (
          runApprovals.length === 0 ? (
            <p className="transcript-empty">{t("progress.noApprovals")}</p>
          ) : (
            <div className="progress-list">
              {runApprovals.map((approval) => (
                <div key={approval.id} className="approval-mini">
                  <div className="approval-mini-head">
                    <Shield size={14} /> {approval.request}
                  </div>
                  <div className="approval-mini-actions">
                    <button className="primary" onClick={() => void decideApproval(approval.id, "approved")}>
                      <Check size={13} /> {t("approvals.approve")}
                    </button>
                    <button onClick={() => void decideApproval(approval.id, "denied")}>
                      <X size={13} /> {t("approvals.deny")}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )
        )}

        {section === "agents" && (
          <div className="agent-rows">
            {liveAgents.map((agent) => (
              <div key={agent.id} className="agent-row">
                <span className={agent.status === "working" ? "agent-dot working" : "agent-dot"} style={{ background: agent.accent }} />
                <span className="agent-name">{agentDisplayName(agent.id, agent.name, t)}</span>
                <span className="agent-state muted">{agent.currentTask ?? agentStateLabel(agent.status, t)}</span>
                {agent.queueCount > 0 && <b>{agent.queueCount}</b>}
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
