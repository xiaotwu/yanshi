import type { ApprovalSummary, ProviderHealth, RunSummary, YanshiEvent } from "@yanshi/shared";

import type { MascotExpression } from "./types";

export type MascotPresentationState =
  | "idle"
  | "thinking"
  | "working"
  | "talking"
  | "awaitingApproval"
  | "success"
  | "completed"
  | "failed"
  | "stopped"
  | "offline";

export type MascotMotionState = "none" | "idle" | "thinking" | "working" | "attention" | "celebrate" | "alert";

export interface MascotWorkerRef {
  id: string;
  role: string;
}

export interface MascotPartialAnswer {
  runId: string;
  text: string;
  done?: boolean;
}

export interface MascotStateInput {
  worker: MascotWorkerRef;
  activeRunId?: string | null;
  runs: RunSummary[];
  approvals: ApprovalSummary[];
  events: Array<{ seq: number; event: YanshiEvent }>;
  providerHealth: ProviderHealth | null;
  partialAnswer?: MascotPartialAnswer | null;
  reducedMotion?: boolean;
}

export interface MascotPresentation {
  state: MascotPresentationState;
  expression: MascotExpression;
  motion: MascotMotionState;
  busy: boolean;
  celebrate: boolean;
}

const BUSY_RUN_STATUSES = new Set<RunSummary["status"]>(["created", "running", "pending_approval"]);
const STARTED_EVENT_TYPES = new Set<YanshiEvent["type"]>(["agent.task.started", "action.created", "action.started", "tool.call.started"]);
const COMPLETED_EVENT_TYPES = new Set<YanshiEvent["type"]>(["agent.task.completed", "action.completed", "tool.call.completed"]);
const FAILED_EVENT_TYPES = new Set<YanshiEvent["type"]>(["agent.task.failed", "action.failed", "tool.call.failed", "run.failed"]);
const THINKING_EVENT_TYPES = new Set<YanshiEvent["type"]>([
  "run.started",
  "plan.created",
  "plan.updated",
  "observation.created",
  "action.completed",
  "tool.call.completed",
  "agent.task.completed",
  "approval.approved",
]);

function expressionForState(state: MascotPresentationState): MascotExpression {
  switch (state) {
    case "thinking":
      return "thinking";
    case "working":
      return "focused";
    case "talking":
    case "success":
    case "completed":
      return "happy";
    case "awaitingApproval":
      return "surprised";
    case "failed":
      return "error";
    case "offline":
      return "sleeping";
    case "stopped":
    case "idle":
      return "neutral";
  }
}

function motionForState(state: MascotPresentationState, reducedMotion: boolean): MascotMotionState {
  if (reducedMotion) return "none";
  switch (state) {
    case "thinking":
    case "talking":
      return "thinking";
    case "working":
      return "working";
    case "awaitingApproval":
      return "attention";
    case "success":
    case "completed":
      return "celebrate";
    case "failed":
      return "alert";
    case "idle":
      return "idle";
    case "offline":
    case "stopped":
      return "none";
  }
}

function presentation(state: MascotPresentationState, reducedMotion = false): MascotPresentation {
  return {
    state,
    expression: expressionForState(state),
    motion: motionForState(state, reducedMotion),
    busy: state === "thinking" || state === "working" || state === "talking" || state === "awaitingApproval",
    celebrate: state === "success" || state === "completed",
  };
}

function activeRunFrom(input: MascotStateInput): RunSummary | null {
  if (input.activeRunId) {
    return input.runs.find((run) => run.id === input.activeRunId) ?? null;
  }
  return input.runs.find((run) => BUSY_RUN_STATUSES.has(run.status)) ?? null;
}

function sortedRunEvents(input: MascotStateInput, runId: string): Array<{ seq: number; event: YanshiEvent }> {
  return input.events
    .filter(({ event }) => event.runId === runId)
    .slice()
    .sort((a, b) => a.seq - b.seq);
}

function payloadRecord(event: YanshiEvent): Record<string, unknown> {
  return event.payload as Record<string, unknown>;
}

function structuredOutput(event: YanshiEvent): Record<string, unknown> | null {
  const structured = payloadRecord(event).structuredOutput;
  return structured && typeof structured === "object" ? (structured as Record<string, unknown>) : null;
}

function eventIndicatesFailure(event: YanshiEvent): boolean {
  if (FAILED_EVENT_TYPES.has(event.type)) return true;
  const payload = payloadRecord(event);
  const error = payload.error;
  if (typeof error === "string" && error.length > 0) return true;
  const missingRequirement = payload.missingRequirement ?? structuredOutput(event)?.missingRequirement;
  return typeof missingRequirement === "string" && missingRequirement.length > 0;
}

function latestWorkerEvent(events: Array<{ seq: number; event: YanshiEvent }>, workerId: string): YanshiEvent | null {
  const significant = events.filter(({ event }) => {
    if (event.agentId !== workerId) return false;
    return STARTED_EVENT_TYPES.has(event.type) || COMPLETED_EVENT_TYPES.has(event.type) || eventIndicatesFailure(event);
  });
  return significant.at(-1)?.event ?? null;
}

function hasPendingApproval(input: MascotStateInput, runId: string, events: Array<{ seq: number; event: YanshiEvent }>): boolean {
  if (input.approvals.some((approval) => approval.runId === runId && approval.status === "pending")) return true;
  return events.some(({ event }) => event.type === "approval.requested");
}

function partialAnswerIsActive(input: MascotStateInput, runId: string): boolean {
  const partial = input.partialAnswer;
  return Boolean(partial && partial.runId === runId && !partial.done && partial.text.trim().length > 0);
}

function workerShouldShowApproval(worker: MascotWorkerRef): boolean {
  return worker.role === "manager" || worker.role === "reviewer" || worker.id === "agent_manager" || worker.id === "agent_reviewer";
}

function managerIsInDecidePhase(run: RunSummary, events: Array<{ seq: number; event: YanshiEvent }>): boolean {
  if (run.status !== "running") return false;
  const latest = events.at(-1)?.event;
  if (!latest) return true;
  return THINKING_EVENT_TYPES.has(latest.type);
}

export function deriveMascotState(input: MascotStateInput): MascotPresentation {
  const activeRun = activeRunFrom(input);
  const reducedMotion = input.reducedMotion ?? false;

  if (!activeRun) {
    if (input.providerHealth?.status === "not_configured") return presentation("offline", reducedMotion);
    return presentation("idle", reducedMotion);
  }

  const events = sortedRunEvents(input, activeRun.id);

  if (activeRun.status === "completed") return presentation("completed", reducedMotion);
  if (activeRun.status === "failed") return presentation("failed", reducedMotion);
  if (activeRun.status === "cancelled") return presentation("stopped", reducedMotion);

  const workerEvent = latestWorkerEvent(events, input.worker.id);
  if (workerEvent && eventIndicatesFailure(workerEvent)) return presentation("failed", reducedMotion);

  const runFailureForReviewer = events.some(({ event }) => {
    if (!eventIndicatesFailure(event)) return false;
    return input.worker.role === "manager" || input.worker.role === "reviewer" || event.agentId === input.worker.id;
  });
  if (runFailureForReviewer) return presentation("failed", reducedMotion);

  if ((activeRun.status === "pending_approval" || hasPendingApproval(input, activeRun.id, events)) && workerShouldShowApproval(input.worker)) {
    return presentation("awaitingApproval", reducedMotion);
  }

  if ((input.worker.role === "manager" || input.worker.id === "agent_manager") && partialAnswerIsActive(input, activeRun.id)) {
    return presentation("talking", reducedMotion);
  }

  if (workerEvent && COMPLETED_EVENT_TYPES.has(workerEvent.type)) return presentation("success", reducedMotion);
  if (workerEvent && STARTED_EVENT_TYPES.has(workerEvent.type)) return presentation("working", reducedMotion);

  if ((input.worker.role === "manager" || input.worker.id === "agent_manager") && managerIsInDecidePhase(activeRun, events)) {
    return presentation("thinking", reducedMotion);
  }

  return presentation("idle", reducedMotion);
}
