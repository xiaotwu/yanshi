import { Check, FolderOpen, Globe, Shield, X } from "lucide-react";
import { useState } from "react";

import { canRevealFiles, revealPath } from "../api/desktop";
import { useT } from "../i18n";
import { outputFileName } from "../lib/shared";
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
export function ProgressPanel() {
  const { t } = useT();
  const { runs, activeRunId, liveAgents, approvals, events, decideApproval } = useRuntimeStore();
  const [section, setSection] = useState<PanelSection>("progress");
  const run = runs.find((item) => item.id === activeRunId) ?? runs[0];
  const developer = useRuntimeStore((state) => state.appSettings?.developerMode ?? false);

  // Generated outputs = real artifact events presented as files.
  const outputs = events.filter((entry) => entry.event.type === "artifact.created");
  const fileOutputs = outputs.filter((entry) => typeof entry.event.payload.path === "string");

  const sections: Array<{ id: PanelSection; label: string; badge?: number }> = [
    { id: "progress", label: t("progress.tabProgress") },
    { id: "files", label: t("progress.tabFiles"), badge: fileOutputs.length || undefined },
    { id: "approvals", label: t("progress.tabApprovals"), badge: approvals.length || undefined },
    { id: "agents", label: t("progress.tabAgents") },
  ];

  return (
    <section className="progress-panel">
      <select
        className="panel-select"
        value={section}
        onChange={(event) => setSection(event.target.value as PanelSection)}
        aria-label={t("progress.tabProgress")}
      >
        {sections.map((item) => (
          <option key={item.id} value={item.id}>
            {item.label}
            {item.badge ? ` (${item.badge})` : ""}
          </option>
        ))}
      </select>

      <div className="progress-body">
        {section === "progress" && (
          run ? (
            <div className="progress-stack">
              <div className="progress-run">
                <span className="muted">{t("progress.status")}</span>
                <span className={`status-pill ${STATUS_TONE[run.status] ?? ""}`}>{run.status.replace("_", " ")}</span>
              </div>
              <div className="progress-task">{run.task}</div>
              {run.plan.length > 0 && (
                <div className="progress-section">
                  <span className="muted">{t("progress.plan")}</span>
                  <ol className="plan-list">
                    {run.plan.map((step, index) => (
                      <li key={index}>{step}</li>
                    ))}
                  </ol>
                </div>
              )}
              <div className="progress-section">
                <span className="muted">{t("progress.queue")}</span>
                <div className="agent-rows">
                  {liveAgents.map((agent) => (
                    <div key={agent.id} className="agent-row">
                      <span className="agent-dot" style={{ background: agent.accent }} />
                      <span className="agent-name">{agent.name}</span>
                      <span className="agent-state muted">{agent.currentTask ?? agent.status}</span>
                      {agent.queueCount > 0 && <b>{agent.queueCount}</b>}
                    </div>
                  ))}
                </div>
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
                      <FolderOpen size={15} />
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
          approvals.length === 0 ? (
            <p className="transcript-empty">{t("progress.noApprovals")}</p>
          ) : (
            <div className="progress-list">
              {approvals.map((approval) => (
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
                <span className="agent-dot" style={{ background: agent.accent }} />
                <span className="agent-name">{agent.name}</span>
                <span className="agent-state muted">{agent.currentTask ?? agent.status}</span>
                {agent.queueCount > 0 && <b>{agent.queueCount}</b>}
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
