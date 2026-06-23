import type { AgentProfileSummary, RunSummary, YanshiEvent } from "@yanshi/shared";
import { describe, expect, it } from "vitest";

import { translate } from "../../../i18n";
import { buildMascotViewModels, stationMascotViewModel } from "./viewModel";

const now = "2026-06-23T00:00:00.000Z";

const browserProfile: AgentProfileSummary = {
  id: "agent_browser",
  name: "Scout",
  station: "browser",
  role: "browser",
  accent: "#3f7fb0",
  behaviorMode: "balanced",
  taskPriority: 5,
  personality: "curious",
  prompt: "You are a browser agent.",
  defaultTools: ["browser"],
  defaultPermissions: [],
  motionPack: "default",
  model: null,
  createdAt: now,
  updatedAt: now,
};

function run(status: RunSummary["status"]): RunSummary {
  return {
    id: "run_1",
    standalone: true,
    task: "Research a topic",
    status,
    plan: [],
    createdAt: now,
    updatedAt: now,
  };
}

function event(type: YanshiEvent["type"], options: Partial<YanshiEvent>, seq: number): { seq: number; event: YanshiEvent } {
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

describe("mascot view model", () => {
  it("localizes accessible names from real mascot state", () => {
    const runtime = {
      activeRunId: "run_1",
      runs: [run("running")],
      approvals: [],
      events: [event("tool.call.started", { agentId: "agent_browser" }, 1)],
      providerHealth: null,
      reducedMotion: false,
    };

    const en = buildMascotViewModels([browserProfile], runtime, (key, vars) => translate("en-US", key, vars)).byProfileId.agent_browser;
    const zh = buildMascotViewModels([browserProfile], runtime, (key, vars) => translate("zh-CN", key, vars)).byProfileId.agent_browser;

    expect(en).toMatchObject({
      role: "browser",
      state: "working",
      expression: "focused",
      statusText: "Working",
      accessibleName: "Scout, Browser mascot, Working",
    });
    expect(zh).toMatchObject({
      statusText: "工作中",
      accessibleName: "Scout，浏览器 Q版角色，工作中",
    });
  });

  it("falls back to localized idle station mascots when no profile owns a station", () => {
    expect(stationMascotViewModel("terminal", (key, vars) => translate("en-US", key, vars))).toMatchObject({
      role: "terminal",
      state: "idle",
      accessibleName: "Terminal station mascot, Idle",
    });
  });
});
