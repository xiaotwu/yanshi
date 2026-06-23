import type { ApprovalSummary, ProviderHealth, RunSummary, YanshiEvent } from "@yanshi/shared";
import { describe, expect, it } from "vitest";

import { deriveMascotState } from "./state";

const now = "2026-06-23T00:00:00.000Z";

function run(status: RunSummary["status"], id = "run_1"): RunSummary {
  return {
    id,
    standalone: true,
    task: "Make a plan",
    status,
    plan: [],
    createdAt: now,
    updatedAt: now,
  };
}

function event(type: YanshiEvent["type"], options: Partial<YanshiEvent> = {}, seq = 1): { seq: number; event: YanshiEvent } {
  return {
    seq,
    event: {
      eventId: `evt_${seq}`,
      type,
      schemaVersion: 1,
      sourceRuntimeVersion: "test",
      timestamp: now,
      runId: "run_1",
      payload: {},
      ...options,
    },
  };
}

function approval(runId = "run_1"): ApprovalSummary {
  return {
    id: "approval_1",
    runId,
    targetType: "action",
    targetId: "act_1",
    riskLevel: "medium",
    status: "pending",
    request: "Review the action",
    createdAt: now,
  };
}

const notConfigured: ProviderHealth = {
  ok: false,
  status: "not_configured",
  detail: "Model provider is not configured.",
};

describe("deriveMascotState", () => {
  it("keeps workers idle when there is no active run", () => {
    expect(
      deriveMascotState({
        worker: { id: "agent_browser", role: "browser" },
        activeRunId: null,
        runs: [],
        approvals: [],
        events: [],
        providerHealth: null,
      }),
    ).toMatchObject({ state: "idle", expression: "neutral", busy: false, celebrate: false });
  });

  it("shows offline sleeping only when the provider is not configured and no run is active", () => {
    expect(
      deriveMascotState({
        worker: { id: "agent_manager", role: "manager" },
        activeRunId: null,
        runs: [],
        approvals: [],
        events: [],
        providerHealth: notConfigured,
      }),
    ).toMatchObject({ state: "offline", expression: "sleeping", motion: "none" });
  });

  it("shows Manager thinking after a run starts before any real assignment or action", () => {
    const input = {
      activeRunId: "run_1",
      runs: [run("running")],
      approvals: [],
      events: [event("run.started")],
      providerHealth: null,
    };

    expect(deriveMascotState({ ...input, worker: { id: "agent_manager", role: "manager" } })).toMatchObject({
      state: "thinking",
      expression: "thinking",
      busy: true,
    });
    expect(deriveMascotState({ ...input, worker: { id: "agent_browser", role: "browser" } })).toMatchObject({
      state: "idle",
      expression: "neutral",
      busy: false,
    });
  });

  it("shows Manager thinking between real act steps in the ReAct loop", () => {
    expect(
      deriveMascotState({
        worker: { id: "agent_manager", role: "manager" },
        activeRunId: "run_1",
        runs: [run("running")],
        approvals: [],
        events: [
          event("run.started", {}, 1),
          event("agent.task.started", { agentId: "agent_browser" }, 2),
          event("action.completed", { agentId: "agent_browser" }, 3),
          event("agent.task.completed", { agentId: "agent_browser" }, 4),
        ],
        providerHealth: null,
      }),
    ).toMatchObject({ state: "thinking", expression: "thinking" });
  });

  it("shows a worker working only after real work-start events for that worker", () => {
    expect(
      deriveMascotState({
        worker: { id: "agent_browser", role: "browser" },
        activeRunId: "run_1",
        runs: [run("running")],
        approvals: [],
        events: [
          event("run.started", {}, 1),
          event("agent.task.assigned", { agentId: "agent_browser" }, 2),
          event("tool.call.started", { agentId: "agent_browser" }, 3),
        ],
        providerHealth: null,
      }),
    ).toMatchObject({ state: "working", expression: "focused", busy: true });
  });

  it("shows Manager talking only while real partial answer text exists", () => {
    expect(
      deriveMascotState({
        worker: { id: "agent_manager", role: "manager" },
        activeRunId: "run_1",
        runs: [run("running")],
        approvals: [],
        events: [event("run.started")],
        providerHealth: null,
        partialAnswer: { runId: "run_1", text: "Here is the answer", done: false },
      }),
    ).toMatchObject({ state: "talking", expression: "happy", busy: true });
  });

  it("shows approval waiting from pending approval state without marking it as success", () => {
    expect(
      deriveMascotState({
        worker: { id: "agent_reviewer", role: "reviewer" },
        activeRunId: "run_1",
        runs: [run("pending_approval")],
        approvals: [approval()],
        events: [event("approval.requested", { agentId: "agent_reviewer" })],
        providerHealth: null,
      }),
    ).toMatchObject({ state: "awaitingApproval", expression: "surprised", celebrate: false });
  });

  it("maps completion, failure, cancellation, and model-not-configured honestly", () => {
    expect(
      deriveMascotState({
        worker: { id: "agent_manager", role: "manager" },
        activeRunId: "run_1",
        runs: [run("completed")],
        approvals: [],
        events: [event("run.completed")],
        providerHealth: null,
      }),
    ).toMatchObject({ state: "completed", expression: "happy", celebrate: true });

    expect(
      deriveMascotState({
        worker: { id: "agent_manager", role: "manager" },
        activeRunId: "run_1",
        runs: [run("failed")],
        approvals: [],
        events: [event("run.failed")],
        providerHealth: null,
      }),
    ).toMatchObject({ state: "failed", expression: "error", celebrate: false });

    expect(
      deriveMascotState({
        worker: { id: "agent_manager", role: "manager" },
        activeRunId: "run_1",
        runs: [run("cancelled")],
        approvals: [],
        events: [event("run.cancelled")],
        providerHealth: null,
      }),
    ).toMatchObject({ state: "stopped", expression: "neutral", celebrate: false });

    expect(
      deriveMascotState({
        worker: { id: "agent_reviewer", role: "reviewer" },
        activeRunId: "run_1",
        runs: [run("running")],
        approvals: [],
        events: [
          event("observation.created", {
            agentId: "agent_reviewer",
            payload: {
              error: "model_not_configured",
              structuredOutput: { missingRequirement: "model_provider" },
            },
          }),
        ],
        providerHealth: null,
      }),
    ).toMatchObject({ state: "failed", expression: "error", celebrate: false });
  });

  it("turns loop motion off while preserving the honest state in reduced motion", () => {
    expect(
      deriveMascotState({
        worker: { id: "agent_browser", role: "browser" },
        activeRunId: "run_1",
        runs: [run("running")],
        approvals: [],
        events: [event("tool.call.started", { agentId: "agent_browser" })],
        providerHealth: null,
        reducedMotion: true,
      }),
    ).toMatchObject({ state: "working", expression: "focused", motion: "none", busy: true });
  });
});
