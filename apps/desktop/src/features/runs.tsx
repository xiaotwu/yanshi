import { Check, FileText, FolderOpen, Shield, SquarePen, X } from "lucide-react";
import { Fragment, useEffect, useRef } from "react";

import { canRevealFiles, revealPath } from "../api/desktop";
import { useT } from "../i18n";
import { EmptyView, agentLabel, eventSummary, projectIcon } from "../lib/shared";
import { useRuntimeStore } from "../stores/runtimeStore";

export const TRANSCRIPT_EVENT_TYPES = new Set(["observation.created", "artifact.created"]);

/**
 * Chat view — the user-facing conversation between the user and Yanshi (internal view id "runs";
 * runtime records stay runs/tasks). Claude-style layout: user message, Yanshi message blocks built
 * from real observations, compact output/file cards, plan + approval cards, working indicator.
 * The runtime does not support continuing a finished run, so there is no fake follow-up composer —
 * the footer offers a real "Start a new chat" action instead. Raw run details are Developer-only.
 */
export function ChatView({ onNewChat }: { onNewChat: () => void }) {
  const { t } = useT();
  const { runs, activeRunId, events, approvals, decideApproval, appSettings, loading, projects } = useRuntimeStore();
  const run = runs.find((item) => item.id === activeRunId) ?? runs[0];
  const developerMode = appSettings?.developerMode ?? false;
  const scrollRef = useRef<HTMLDivElement>(null);

  const runEvents = events.filter((entry) => !run || entry.event.runId === run.id);
  const transcript = runEvents.filter((entry) => TRANSCRIPT_EVENT_TYPES.has(entry.event.type));

  // Keep the newest message in view while the chat is live.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [transcript.length, run?.status]);

  if (!run) return <EmptyView title={t("project.tasks")} text={t("project.noTasks")} />;

  const project = run.projectId ? projects.find((p) => p.id === run.projectId) : null;
  const runApprovals = approvals.filter((approval) => approval.runId === run.id);
  const finished = run.status === "completed" || run.status === "failed";

  return (
    <section className="chat-view">
      <header className="chat-head">
        {project && (
          <span className="chat-project muted">
            {projectIcon(project)} {project.name}
          </span>
        )}
        <h2 className="ellipsis" title={run.task}>{run.task}</h2>
        <span className={`status-pill ${run.status}`}>{run.status.replace("_", " ")}</span>
      </header>

      <div className="chat-scroll" ref={scrollRef}>
        <div className="chat-msg user">
          <p>{run.task}</p>
        </div>

        {run.plan.length > 0 && (
          <details className="chat-plan">
            <summary>{t("tasks.plan", { count: run.plan.length })}</summary>
            <ol>
              {run.plan.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
          </details>
        )}

        {runApprovals.map((approval) => (
          <article key={approval.id} className="approval-card chat-card">
            <Shield size={18} />
            <div>
              <strong>{approval.request}</strong>
              <span>{t("tasks.risk", { level: approval.riskLevel })}</span>
            </div>
            <button onClick={() => void decideApproval(approval.id, "approved")} disabled={loading}>
              <Check size={16} /> {t("approvals.approve")}
            </button>
            <button className="danger" onClick={() => void decideApproval(approval.id, "denied")} disabled={loading}>
              <X size={16} /> {t("approvals.deny")}
            </button>
          </article>
        ))}

        {transcript.map(({ seq, event }) =>
          event.type === "artifact.created" ? (
            <div key={seq} className="chat-output-card">
              <FileText size={15} />
              <div className="chat-output-main">
                <strong>{String(event.payload.title ?? t("chat.output"))}</strong>
                {typeof event.payload.path === "string" && <small className="muted ellipsis">{event.payload.path}</small>}
              </div>
              {typeof event.payload.path === "string" && canRevealFiles() && (
                <button className="icon-button ghost" title={t("library.reveal")} onClick={() => void revealPath(String(event.payload.path))}>
                  <FolderOpen size={14} />
                </button>
              )}
            </div>
          ) : (
            <ChatMessage key={seq} event={event} developerMode={developerMode} />
          ),
        )}

        {!finished && transcript.length === 0 && (
          <div className="chat-msg yanshi">
            <span className="chat-author">{t("brand")}</span>
            <p className="chat-working">
              {t("tasks.working")}
              <span className="working-dots" aria-hidden>
                <i /><i /><i />
              </span>
            </p>
          </div>
        )}

        {finished && run.resultSummary && (
          <div className={`chat-msg yanshi ${run.status === "failed" ? "failed" : "final"}`}>
            <span className="chat-author">{run.status === "failed" ? t("tasks.stopped") : t("brand")}</span>
            <p>{run.resultSummary}</p>
          </div>
        )}

        {developerMode && (
          <details className="plan-box chat-raw">
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

      <footer className="chat-foot">
        <button className="chat-new" onClick={onNewChat}>
          <SquarePen size={15} /> {t("chat.startNew")}
        </button>
      </footer>
    </section>
  );
}

/** A Yanshi message block built from a real observation event. */
function ChatMessage({ event, developerMode }: { event: import("@yanshi/shared").YanshiEvent; developerMode: boolean }) {
  const { t } = useT();
  const output = (event.payload.structuredOutput ?? {}) as Record<string, unknown>;
  const entries = Object.entries(output).filter(([, value]) => typeof value !== "object" || value === null);
  const hasDetails = entries.length > 0 || developerMode;
  return (
    <div className={event.payload.error ? "chat-msg yanshi failed" : "chat-msg yanshi"}>
      <span className="chat-author">{agentLabel(event.payload.agentId ?? event.agentId, t("brand"))}</span>
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
    </div>
  );
}
