import { ArrowUp, Check, ChevronDown, Copy, FileText, FolderOpen, MessageSquare, RefreshCw, Shield, Sparkles, Square, SquarePen, X } from "lucide-react";
import { Fragment, useEffect, useRef, useState } from "react";

import { runtimeApi } from "../api/client";
import { canRevealFiles, revealPath } from "../api/desktop";
import { Markdown } from "../components/markdown";
import { useT } from "../i18n";
import { EmptyView, PlanSteps, agentLabel, eventSummary, isTerminalStatus, projectIcon, statusLabel } from "../lib/shared";
import { useRuntimeStore } from "../stores/runtimeStore";

export const TRANSCRIPT_EVENT_TYPES = new Set(["observation.created", "artifact.created"]);

/** A runtime/agent message that is really "we can't run without a model provider". */
function isProviderBlocker(payload: Record<string, unknown>): boolean {
  if (payload.error === "model_not_configured") return true;
  const output = payload.structuredOutput as Record<string, unknown> | undefined;
  return output?.missingRequirement === "model_provider";
}

/**
 * Whether an event belongs in the conversation thread (vs. the right-panel telemetry). The chat
 * shows what the user cares about: real tool/agent outputs, blockers, and Yanshi's final answer
 * (rendered once via the summary block). Internal process chatter — reviewer quality checks and
 * intermediate Manager drafts — is routed to the panel so the conversation stays clean.
 */
function isConversational(event: import("@yanshi/shared").YanshiEvent): boolean {
  if (event.type === "artifact.created") return true;
  if (event.type !== "observation.created") return false;
  const payload = event.payload;
  // Blockers/errors are always shown in the conversation (with a localized message + CTA).
  if (payload.error || payload.type === "ErrorObservation") return true;
  // Reviewer/review telemetry lives in the panel, not the chat.
  if (payload.type === "ReviewerObservation" || payload.type === "ReviewObservation") return false;
  // The Manager's synthesis is the final answer — shown once via the summary block (authored by
  // Yanshi), so its raw observations (including intermediate drafts) stay out of the thread.
  if ((payload.agentId ?? event.agentId) === "agent_manager") return false;
  return true;
}

/**
 * Chat view — the user-facing conversation between the user and Yanshi. A chat is a *thread* of
 * one or more turns (runtime runs sharing a threadId); each turn is the user's message plus
 * Yanshi's answer built from real observations. A persistent composer at the bottom continues
 * the conversation (real follow-up turns with prior context), so a "Chat" is an actual
 * conversation rather than a one-shot task. The plan/queue telemetry lives in the right panel;
 * when that panel is closed the plan is shown inline so it is never lost. Raw run details are
 * Developer-only.
 */
export function ChatView({
  onNewChat,
  onConfigureProvider,
  progressOpen,
}: {
  onNewChat: () => void;
  onConfigureProvider: () => void;
  progressOpen: boolean;
}) {
  const { t } = useT();
  const { runs, activeRunId, events, approvals, decideApproval, continueChat, cancelRun, appSettings, loading, projects } =
    useRuntimeStore();
  const activeRun = runs.find((item) => item.id === activeRunId) ?? runs[0];
  const developerMode = appSettings?.developerMode ?? false;
  const scrollRef = useRef<HTMLDivElement>(null);
  const [reply, setReply] = useState("");
  const [streamText, setStreamText] = useState("");

  // All turns in this conversation, oldest first.
  const threadId = activeRun?.threadId ?? activeRun?.id;
  const turns = runs
    .filter((item) => (item.threadId ?? item.id) === threadId)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const liveTurn = turns[turns.length - 1] ?? activeRun;
  const liveTurnInFlight = !!liveTurn && (liveTurn.status === "running" || liveTurn.status === "created");
  const threadBusy = turns.some((turn) => turn.status === "running" || turn.status === "created");

  // Stream the in-flight answer: poll the runtime's partial buffer while the live turn runs.
  useEffect(() => {
    if (!liveTurnInFlight || !liveTurn) {
      setStreamText("");
      return;
    }
    let active = true;
    const runId = liveTurn.id;
    const tick = async () => {
      try {
        const partial = await runtimeApi.runPartial(runId);
        if (active) setStreamText(partial.text);
      } catch {
        /* transient; keep polling */
      }
    };
    void tick();
    const timer = setInterval(tick, 400);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [liveTurnInFlight, liveTurn?.id]);

  // "Jump to latest" affordance: only auto-stick to the bottom when the user is already near it,
  // so scrolling up to read history isn't yanked back down while a turn streams.
  const [atBottom, setAtBottom] = useState(true);
  const onScroll = () => {
    const el = scrollRef.current;
    if (el) setAtBottom(el.scrollHeight - el.scrollTop - el.clientHeight < 80);
  };
  const scrollToBottom = () => {
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  };
  useEffect(() => {
    const el = scrollRef.current;
    if (el && atBottom) el.scrollTop = el.scrollHeight;
  }, [events.length, liveTurn?.status, turns.length, streamText, atBottom]);

  if (!activeRun) return <EmptyView title={t("project.tasks")} text={t("project.noTasks")} icon={<MessageSquare size={22} />} />;

  const project = activeRun.projectId ? projects.find((p) => p.id === activeRun.projectId) : null;

  const submitReply = () => {
    const text = reply.trim();
    if (!text || threadBusy) return;
    setReply("");
    void continueChat(text);
  };

  return (
    <section className="chat-view">
      <header className="chat-head">
        {project && (
          <span className="chat-project muted">
            {projectIcon(project)} {project.name}
          </span>
        )}
        <h2 className="ellipsis" title={turns[0]?.task ?? activeRun.task}>{turns[0]?.task ?? activeRun.task}</h2>
        <span className={`status-pill ${liveTurn.status}`}>{statusLabel(liveTurn.status, t)}</span>
      </header>

      <div className="chat-scroll" ref={scrollRef} onScroll={onScroll}>
        {turns.map((turn, index) => {
          const isLive = turn.id === liveTurn.id && liveTurnInFlight;
          const isLast = index === turns.length - 1;
          return (
            <ChatTurn
              key={turn.id}
              turn={turn}
              events={events}
              approvals={approvals}
              decideApproval={decideApproval}
              loading={loading}
              developerMode={developerMode}
              showPlan={!progressOpen}
              onConfigureProvider={onConfigureProvider}
              streamText={isLive ? streamText : ""}
              onStop={isLive ? () => void cancelRun(turn.id) : undefined}
              onRegenerate={isLast && !threadBusy ? () => void continueChat(turn.task) : undefined}
            />
          );
        })}
      </div>

      {!atBottom && (
        <button className="chat-jump" onClick={scrollToBottom} aria-label={t("chat.jumpToLatest")} title={t("chat.jumpToLatest")}>
          <ChevronDown size={16} />
        </button>
      )}

      <footer className="chat-foot">
        <div className="chat-reply">
          <textarea
            className="chat-reply-input"
            value={reply}
            onChange={(event) => setReply(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                submitReply();
              }
            }}
            placeholder={t("chat.followUpPlaceholder")}
            rows={1}
            aria-label={t("chat.followUpPlaceholder")}
          />
          <button
            className="chat-reply-send"
            onClick={submitReply}
            disabled={!reply.trim() || threadBusy}
            title={t("chat.send")}
            aria-label={t("chat.send")}
          >
            <ArrowUp size={16} />
          </button>
        </div>
        <button className="chat-new ghost" onClick={onNewChat}>
          <SquarePen size={14} /> {t("chat.startNew")}
        </button>
      </footer>
    </section>
  );
}

/** One turn in a conversation: the user's message + Yanshi's response built from real events. */
function ChatTurn({
  turn,
  events,
  approvals,
  decideApproval,
  loading,
  developerMode,
  showPlan,
  onConfigureProvider,
  streamText = "",
  onStop,
  onRegenerate,
}: {
  turn: import("@yanshi/shared").RunSummary;
  events: { seq: number; event: import("@yanshi/shared").YanshiEvent }[];
  approvals: import("@yanshi/shared").ApprovalSummary[];
  decideApproval: (id: string, decision: "approved" | "denied") => Promise<void>;
  loading: boolean;
  developerMode: boolean;
  showPlan: boolean;
  onConfigureProvider: () => void;
  streamText?: string;
  onStop?: () => void;
  onRegenerate?: () => void;
}) {
  const { t } = useT();
  const runEvents = events.filter((entry) => entry.event.runId === turn.id);
  const transcript = runEvents.filter(
    (entry) => TRANSCRIPT_EVENT_TYPES.has(entry.event.type) && isConversational(entry.event),
  );
  const turnApprovals = approvals.filter((approval) => approval.runId === turn.id);
  const finished = isTerminalStatus(turn.status);
  // failed and cancelled both render as a "stopped" notice rather than a normal answer.
  const stopped = turn.status === "failed" || turn.status === "cancelled";

  // Dedup: the final summary block usually repeats a tool result or blocker already shown in this
  // turn. Only show it when it adds something new — i.e. when no shown message carries the same
  // text. (Manager drafts are filtered out above, so a normal answer shows once via this block.)
  const messageTexts = transcript
    .filter((entry) => entry.event.type === "observation.created")
    .map((entry) => eventSummary(entry.event.payload));
  const summaryIsDuplicate = !!turn.resultSummary && messageTexts.includes(turn.resultSummary);

  const time = new Date(turn.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return (
    <div className="chat-turn">
      <div className="chat-msg user">
        <p>{turn.task}</p>
        <time className="chat-time" dateTime={turn.createdAt}>{time}</time>
      </div>

      {showPlan && turn.plan.length > 0 && (
        <details className="chat-plan">
          <summary>{t("tasks.plan", { count: turn.plan.length })}</summary>
          <PlanSteps steps={turn.plan} done={turn.status === "completed"} />
        </details>
      )}

      {turnApprovals.map((approval) => (
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
          <ChatMessage key={seq} event={event} developerMode={developerMode} onConfigureProvider={onConfigureProvider} />
        ),
      )}

      {!finished && (
        <div className="chat-msg yanshi">
          <YanshiAuthor label={t("brand")} />
          {streamText ? (
            // Live answer streaming in token-by-token.
            <div className="chat-streaming">
              <Markdown text={streamText} />
              <span className="stream-cursor" aria-hidden />
            </div>
          ) : (
            <p className="chat-working">
              {turn.plan.length > 0 ? t("chat.phase.writing") : t("chat.phase.planning")}
              <span className="working-dots" aria-hidden>
                <i /><i /><i />
              </span>
            </p>
          )}
          {onStop && (
            <button className="chat-stop" onClick={onStop}>
              <Square size={12} /> {t("chat.stop")}
            </button>
          )}
        </div>
      )}

      {finished && turn.resultSummary && !summaryIsDuplicate && (
        <div className={`chat-msg yanshi ${stopped ? "failed" : "final"}`}>
          {stopped ? (
            <span className="chat-author">{t("tasks.stopped")}</span>
          ) : (
            <YanshiAuthor label={t("brand")} />
          )}
          {stopped ? <p>{turn.resultSummary}</p> : <Markdown text={turn.resultSummary} />}
          {turn.status === "completed" && <ChatActions text={turn.resultSummary} onRegenerate={onRegenerate} />}
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
  );
}

/** Assistant author label with a small Yanshi identity mark (Claude-style). */
function YanshiAuthor({ label }: { label: string }) {
  return (
    <span className="chat-author-row">
      <span className="yanshi-avatar" aria-hidden>
        <Sparkles />
      </span>
      <span className="chat-author">{label}</span>
    </span>
  );
}

/** Hover actions under a completed answer: copy, and (for the last turn) regenerate. */
function ChatActions({ text, onRegenerate }: { text: string; onRegenerate?: () => void }) {
  const { t } = useT();
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable */
    }
  };
  return (
    <div className="chat-actions">
      <button onClick={copy} title={t("chat.copy")}>
        {copied ? <Check size={13} /> : <Copy size={13} />} {copied ? t("chat.copied") : t("chat.copy")}
      </button>
      {onRegenerate && (
        <button onClick={onRegenerate} title={t("chat.regenerate")}>
          <RefreshCw size={13} /> {t("chat.regenerate")}
        </button>
      )}
    </div>
  );
}

/** A Yanshi message block built from a real observation event. */
function ChatMessage({
  event,
  developerMode,
  onConfigureProvider,
}: {
  event: import("@yanshi/shared").YanshiEvent;
  developerMode: boolean;
  onConfigureProvider: () => void;
}) {
  const { t } = useT();
  const output = (event.payload.structuredOutput ?? {}) as Record<string, unknown>;
  const entries = Object.entries(output).filter(([, value]) => typeof value !== "object" || value === null);
  const hasDetails = entries.length > 0 || developerMode;
  const providerBlocker = isProviderBlocker(event.payload);

  return (
    <div className={event.payload.error ? "chat-msg yanshi failed" : "chat-msg yanshi"}>
      <span className="chat-author">{agentLabel(event.payload.agentId ?? event.agentId, t)}</span>
      {/* Recognized blockers get a localized, actionable message instead of the raw runtime text. */}
      {providerBlocker ? (
        <p>{t("chat.blocker.modelProvider")}</p>
      ) : (
        <Markdown text={eventSummary(event.payload)} />
      )}
      {providerBlocker && (
        <button className="chat-cta" onClick={onConfigureProvider}>
          {t("chat.blocker.configureProvider")}
        </button>
      )}
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
