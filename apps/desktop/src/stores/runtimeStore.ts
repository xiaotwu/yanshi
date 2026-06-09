import type {
  AgentInstanceSummary,
  AgentProfileSummary,
  AppSettings,
  ApprovalSummary,
  BehaviorMode,
  DesktopRuntimeStatus,
  LifeAction,
  LiveAgentState,
  LiveOfficeStateSummary,
  MacosPermissionStatus,
  ProjectSummary,
  ProviderHealth,
  ProviderSettingsPublic,
  RunSummary,
  RuntimeStatus,
  WorkshopPackSummary,
  YanshiEvent,
} from "@yanshi/shared";
import { create } from "zustand";

import { runtimeApi } from "../api/client";
import { getDesktopRuntimeStatus, getMacosPermissionStatus, restartDesktopRuntime, sendDesktopNotification } from "../api/desktop";

interface RuntimeStore {
  status: RuntimeStatus | null;
  desktopStatus: DesktopRuntimeStatus | null;
  macosPermissions: MacosPermissionStatus | null;
  providerSettings: ProviderSettingsPublic | null;
  providerHealth: ProviderHealth | null;
  appSettings: AppSettings | null;
  projects: ProjectSummary[];
  workshopPacks: WorkshopPackSummary[];
  runs: RunSummary[];
  approvals: ApprovalSummary[];
  events: Array<{ seq: number; event: YanshiEvent }>;
  activeProjectId: string | null;
  activeRunId: string | null;
  liveAgents: LiveAgentState[];
  agentProfiles: AgentProfileSummary[];
  agentInstances: AgentInstanceSummary[];
  officeState: LiveOfficeStateSummary | null;
  loading: boolean;
  error: string | null;
  hydrate: () => Promise<void>;
  createRun: (
    task: string,
    permissionMode: "default" | "auto_review" | "full_access",
    projectId?: string | null,
    planFirst?: boolean,
    reasoning?: "low" | "medium" | "high" | "extra_high",
  ) => Promise<void>;
  createProject: (name: string, description?: string, icon?: string) => Promise<void>;
  updateProject: (projectId: string, update: { name?: string; description?: string; settings?: Record<string, unknown> }) => Promise<void>;
  deleteProject: (projectId: string) => Promise<void>;
  setActiveProject: (projectId: string | null) => void;
  setActiveRun: (runId: string) => void;
  importWorkshopPack: (file: File) => Promise<void>;
  setWorkshopPackEnabled: (packId: string, enabled: boolean) => Promise<void>;
  decideApproval: (approvalId: string, decision: "approved" | "denied") => Promise<void>;
  pauseAllRuns: () => Promise<void>;
  restartRuntime: () => Promise<void>;
  refreshMacosPermissions: () => Promise<void>;
  saveProviderSettings: (settings: { baseUrl: string; model: string; apiKey?: string }) => Promise<void>;
  checkProviderHealth: () => Promise<void>;
  saveAppSettings: (settings: Partial<AppSettings>) => Promise<void>;
  loadAgentProfiles: () => Promise<void>;
  saveAgentProfile: (id: string, update: Partial<AgentProfileSummary>) => Promise<void>;
  createAgentProfile: (body: { name: string; station?: string; behaviorMode?: BehaviorMode; accent?: string }) => Promise<void>;
  deleteAgentProfile: (id: string) => Promise<void>;
  loadOfficeState: (projectId: string | null) => Promise<void>;
  saveOfficeState: (projectId: string | null, update: Partial<LiveOfficeStateSummary>) => Promise<void>;
  loadAgentInstances: (projectId: string | null) => Promise<void>;
  connectEvents: () => void;
}

const FALLBACK_PROFILES: Array<Pick<AgentProfileSummary, "id" | "name" | "role" | "station" | "accent" | "behaviorMode">> = [
  { id: "agent_manager", name: "Manager", role: "manager", station: "manager", accent: "#277f71", behaviorMode: "balanced" },
  { id: "agent_browser", name: "Browser", role: "browser", station: "browser", accent: "#3f7fb0", behaviorMode: "balanced" },
  { id: "agent_computer", name: "Computer", role: "computer", station: "computer", accent: "#9a5b2d", behaviorMode: "balanced" },
  { id: "agent_file", name: "File", role: "file", station: "file", accent: "#5b8d55", behaviorMode: "balanced" },
  { id: "agent_reviewer", name: "Reviewer", role: "reviewer", station: "reviewer", accent: "#b65c2f", behaviorMode: "balanced" },
  { id: "agent_terminal", name: "Terminal", role: "terminal", station: "terminal", accent: "#6a6f86", behaviorMode: "balanced" },
];

const LIFE_ACTIONS: LifeAction[] = ["coffee_break", "stretching", "walking_around", "playing_phone", "chatting_with_neighbor", "nap"];

let socket: WebSocket | null = null;

interface AgentAccumulator {
  status: LiveAgentState["status"];
  queue: number;
  work: number;
  task: string | null;
}

/**
 * Derive live agent state from real runtime events. Task status, current task, and queue come
 * straight from `agent.task.*` / `action.*` / `approval.*` events. Fatigue accumulates from how
 * much real work an agent has done in the recent event window, and life/idle animations are
 * generated from behavior mode + fatigue + idleness (never faked task progress).
 */
function computeAgents(
  profiles: AgentProfileSummary[],
  events: Array<{ seq: number; event: YanshiEvent }>,
  officeBehavior: BehaviorMode,
  instances: AgentInstanceSummary[] = [],
): LiveAgentState[] {
  const base = profiles.length > 0 ? profiles : FALLBACK_PROFILES;
  // Seed each agent from its persisted AgentInstance so restored office state shows last-known
  // status/fatigue/queue before any live events arrive; events then overlay the live run.
  const instanceById = new Map(instances.map((instance) => [instance.profileId, instance]));
  const acc = new Map<string, AgentAccumulator>();
  for (const profile of base) {
    const persisted = instanceById.get(profile.id);
    acc.set(profile.id, {
      status: persisted?.status ?? "idle",
      queue: persisted?.queueCount ?? 0,
      work: persisted ? Math.round(persisted.fatigue / 0.16) : 0,
      task: persisted?.currentTask ?? null,
    });
  }

  for (const { event } of events) {
    const id = event.agentId || (event.type.startsWith("approval.") ? "agent_reviewer" : "agent_manager");
    const state = acc.get(id);
    if (!state) continue;
    const payloadTask = typeof event.payload.task === "string" ? event.payload.task : typeof event.payload.summary === "string" ? event.payload.summary : null;
    switch (event.type) {
      case "agent.task.assigned":
        state.queue += 1;
        break;
      case "agent.task.started":
      case "action.created":
        state.status = "working";
        state.work += 1;
        if (payloadTask) state.task = payloadTask;
        break;
      case "agent.task.completed":
      case "action.completed":
        state.status = "done";
        state.queue = Math.max(0, state.queue - 1);
        break;
      case "agent.task.failed":
      case "action.failed":
        state.status = "failed";
        state.queue = Math.max(0, state.queue - 1);
        break;
      case "approval.requested":
        state.status = "waiting_approval";
        break;
      case "observation.created":
        if (payloadTask) state.task = payloadTask;
        break;
      case "run.completed":
        if (state.status === "working") state.status = "done";
        break;
      case "run.failed":
        if (state.status === "working") state.status = "failed";
        break;
      default:
        break;
    }
  }

  return base.map((profile, index) => {
    const state = acc.get(profile.id) ?? { status: "idle" as const, queue: 0, work: 0, task: null };
    const fatigue = Math.min(1, state.work * 0.16);
    const behaviorMode = profile.behaviorMode ?? officeBehavior;
    const idle = state.status === "idle" || state.status === "done";
    return {
      id: profile.id,
      name: profile.name,
      role: profile.role,
      status: state.status,
      station: profile.station,
      queueCount: state.queue,
      fatigue,
      accent: profile.accent,
      behaviorMode,
      currentTask: state.status === "working" ? state.task : null,
      lifeAction: idle ? pickLifeAction(profile.id, index, fatigue, behaviorMode) : null,
    };
  });
}

function pickLifeAction(id: string, index: number, fatigue: number, behaviorMode: BehaviorMode): LifeAction | null {
  if (behaviorMode === "professional" && fatigue < 0.5) return null;
  if (fatigue > 0.7) return "nap";
  // A slowly-rotating, deterministic choice so idle workers feel alive without flicker.
  const bucket = Math.floor(Date.now() / 9000);
  const liveliness = behaviorMode === "playful" ? 2 : 1;
  const seed = (bucket + index * 3 + id.length) % LIFE_ACTIONS.length;
  if (behaviorMode === "professional" && seed % 2 === 0) return null;
  return LIFE_ACTIONS[(seed * liveliness) % LIFE_ACTIONS.length];
}

export const useRuntimeStore = create<RuntimeStore>((set, get) => ({
  status: null,
  desktopStatus: null,
  macosPermissions: null,
  providerSettings: null,
  providerHealth: null,
  appSettings: null,
  projects: [],
  workshopPacks: [],
  runs: [],
  approvals: [],
  events: [],
  activeProjectId: null,
  activeRunId: null,
  liveAgents: computeAgents(FALLBACK_PROFILES as AgentProfileSummary[], [], "balanced"),
  agentProfiles: [],
  agentInstances: [],
  officeState: null,
  loading: false,
  error: null,

  hydrate: async () => {
    set({ loading: true, error: null });
    try {
      const currentProjectId = get().activeProjectId;
      const [status, runs, approvals, providerSettings, appSettings, projects, workshopPacks, agentProfiles, officeState, agentInstances] =
        await Promise.all([
          runtimeApi.status(),
          runtimeApi.runs(),
          runtimeApi.approvals(),
          runtimeApi.providerSettings(),
          runtimeApi.appSettings(),
          runtimeApi.projects(),
          runtimeApi.workshopPacks(),
          runtimeApi.agentProfiles(),
          runtimeApi.liveOffice(currentProjectId),
          runtimeApi.agentInstances(currentProjectId),
        ]);
      const [desktopStatus, macosPermissions] = await Promise.all([getDesktopRuntimeStatus(), getMacosPermissionStatus()]);
      const activeProjectId = projects.some((project) => project.id === currentProjectId) ? currentProjectId : null;
      set({
        status,
        desktopStatus,
        macosPermissions,
        providerSettings,
        appSettings,
        projects,
        workshopPacks,
        agentProfiles,
        agentInstances,
        officeState,
        liveAgents: computeAgents(agentProfiles, get().events, officeState.behaviorMode, agentInstances),
        runs,
        approvals,
        activeProjectId,
        activeRunId: get().activeRunId ?? runs[0]?.id ?? null,
        loading: false,
      });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : "Runtime unavailable.", loading: false });
      const [desktopStatus, macosPermissions] = await Promise.all([getDesktopRuntimeStatus(), getMacosPermissionStatus()]);
      set({ desktopStatus, macosPermissions });
    }
  },

  createRun: async (task, permissionMode, projectId, planFirst, reasoning) => {
    set({ loading: true, error: null });
    try {
      const run = await runtimeApi.createRun(task, permissionMode, projectId, planFirst, reasoning);
      const [runs, approvals] = await Promise.all([runtimeApi.runs(), runtimeApi.approvals()]);
      set({
        activeRunId: run.id,
        activeProjectId: projectId === undefined ? get().activeProjectId : projectId,
        runs,
        approvals,
        loading: false,
      });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : "Could not create run.", loading: false });
    }
  },

  createProject: async (name, description, icon) => {
    set({ loading: true, error: null });
    try {
      const project = await runtimeApi.createProject(name, description);
      if (icon) {
        await runtimeApi.updateProject(project.id, { settings: { ...project.settings, icon } });
      }
      const projects = await runtimeApi.projects();
      set({ projects, activeProjectId: project.id, loading: false });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : "Could not create project.", loading: false });
    }
  },

  updateProject: async (projectId, update) => {
    set({ loading: true, error: null });
    try {
      const project = await runtimeApi.updateProject(projectId, update);
      set((state) => ({
        projects: state.projects.map((item) => (item.id === project.id ? project : item)),
        activeProjectId: project.id,
        loading: false,
      }));
    } catch (error) {
      set({ error: error instanceof Error ? error.message : "Could not update project.", loading: false });
    }
  },

  deleteProject: async (projectId) => {
    set({ loading: true, error: null });
    try {
      await runtimeApi.deleteProject(projectId);
      const [projects, runs] = await Promise.all([runtimeApi.projects(), runtimeApi.runs()]);
      set((state) => ({
        projects,
        runs,
        activeProjectId: state.activeProjectId === projectId ? null : state.activeProjectId,
        loading: false,
      }));
    } catch (error) {
      set({ error: error instanceof Error ? error.message : "Could not delete project.", loading: false });
    }
  },

  setActiveProject: (projectId) => {
    set({ activeProjectId: projectId });
    void get().loadAgentInstances(projectId);
    void get().loadOfficeState(projectId);
  },

  setActiveRun: (runId) => {
    set({ activeRunId: runId });
  },

  importWorkshopPack: async (file) => {
    set({ loading: true, error: null });
    try {
      await runtimeApi.importPack(file);
      const workshopPacks = await runtimeApi.workshopPacks();
      set({ workshopPacks, loading: false });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : "Could not import pack.", loading: false });
    }
  },

  setWorkshopPackEnabled: async (packId, enabled) => {
    set({ loading: true, error: null });
    try {
      const pack = await runtimeApi.setWorkshopPackEnabled(packId, enabled);
      set((state) => ({
        workshopPacks: state.workshopPacks.map((item) => (item.id === pack.id ? pack : item)),
        loading: false,
      }));
    } catch (error) {
      set({ error: error instanceof Error ? error.message : "Could not update pack.", loading: false });
    }
  },

  decideApproval: async (approvalId, decision) => {
    set({ loading: true, error: null });
    try {
      const approval = await runtimeApi.decideApproval(approvalId, decision);
      const [runs, approvals] = await Promise.all([runtimeApi.runs(), runtimeApi.approvals()]);
      set({ runs, approvals, activeRunId: approval.runId, loading: false });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : "Could not decide approval.", loading: false });
    }
  },

  pauseAllRuns: async () => {
    const pausableRuns = get().runs.filter((run) => run.status === "running" || run.status === "pending_approval");
    if (pausableRuns.length === 0) return;
    set({ loading: true, error: null });
    try {
      await Promise.all(pausableRuns.map((run) => runtimeApi.pauseRun(run.id)));
      const runs = await runtimeApi.runs(get().activeProjectId);
      set({ runs, loading: false });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : "Could not pause runs.", loading: false });
    }
  },

  restartRuntime: async () => {
    set({ loading: true, error: null });
    try {
      const [desktopStatus, macosPermissions] = await Promise.all([restartDesktopRuntime(), getMacosPermissionStatus()]);
      set({ desktopStatus, macosPermissions, loading: false });
      await get().hydrate();
    } catch (error) {
      set({ error: error instanceof Error ? error.message : "Could not restart runtime.", loading: false });
    }
  },

  refreshMacosPermissions: async () => {
    const macosPermissions = await getMacosPermissionStatus();
    set({ macosPermissions });
  },

  saveProviderSettings: async (settings) => {
    set({ loading: true, error: null });
    try {
      const providerSettings = await runtimeApi.updateProviderSettings(settings);
      const status = await runtimeApi.status();
      set({ providerSettings, status, loading: false });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : "Could not save provider settings.", loading: false });
    }
  },

  checkProviderHealth: async () => {
    set({ loading: true, error: null });
    try {
      const providerHealth = await runtimeApi.providerHealth();
      set({ providerHealth, loading: false });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : "Provider healthcheck failed.", loading: false });
    }
  },

  saveAppSettings: async (settings) => {
    set({ loading: true, error: null });
    try {
      const appSettings = await runtimeApi.updateAppSettings(settings);
      set({ appSettings, loading: false });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : "Could not save settings.", loading: false });
    }
  },

  loadAgentProfiles: async () => {
    const agentProfiles = await runtimeApi.agentProfiles();
    set((state) => ({ agentProfiles, liveAgents: computeAgents(agentProfiles, state.events, state.officeState?.behaviorMode ?? "balanced", state.agentInstances) }));
  },

  saveAgentProfile: async (id, update) => {
    await runtimeApi.updateAgentProfile(id, update);
    await get().loadAgentProfiles();
  },

  createAgentProfile: async (body) => {
    await runtimeApi.createAgentProfile(body);
    await get().loadAgentProfiles();
  },

  deleteAgentProfile: async (id) => {
    await runtimeApi.deleteAgentProfile(id);
    await get().loadAgentProfiles();
  },

  loadOfficeState: async (projectId) => {
    const officeState = await runtimeApi.liveOffice(projectId);
    set((state) => ({ officeState, liveAgents: computeAgents(state.agentProfiles, state.events, officeState.behaviorMode, state.agentInstances) }));
  },

  loadAgentInstances: async (projectId) => {
    const agentInstances = await runtimeApi.agentInstances(projectId);
    set((state) => ({
      agentInstances,
      liveAgents: computeAgents(state.agentProfiles, state.events, state.officeState?.behaviorMode ?? "balanced", agentInstances),
    }));
  },

  saveOfficeState: async (projectId, update) => {
    const officeState = await runtimeApi.updateLiveOffice(projectId, update);
    set((state) => ({ officeState, liveAgents: computeAgents(state.agentProfiles, state.events, officeState.behaviorMode, state.agentInstances) }));
  },

  connectEvents: () => {
    if (socket && socket.readyState !== WebSocket.CLOSED) return;
    socket = new WebSocket(runtimeApi.eventsUrl());
    socket.onmessage = (message) => {
      const payload = JSON.parse(message.data) as { seq: number; event: YanshiEvent };
      set((state) => {
        const events = [...state.events.slice(-300), payload];
        return {
          events,
          liveAgents: computeAgents(state.agentProfiles, events, state.officeState?.behaviorMode ?? "balanced", state.agentInstances),
        };
      });
      notifyForEvent(payload.event, get().appSettings?.notificationsEnabled ?? true);
      if (
        payload.event.type.startsWith("run.") ||
        payload.event.type.startsWith("approval.") ||
        payload.event.type.startsWith("project.") ||
        payload.event.type.startsWith("workshop.")
      ) {
        void get().hydrate();
      }
    };
    socket.onerror = () => {
      set({ error: "Event stream unavailable." });
    };
  },
}));

function notifyForEvent(event: YanshiEvent, enabled: boolean): void {
  if (!enabled) return;
  const titleBody = notificationForEvent(event);
  if (!titleBody) return;
  void sendDesktopNotification(titleBody.title, titleBody.body).catch(() => undefined);
}

function notificationForEvent(event: YanshiEvent): { title: string; body: string } | null {
  if (event.type === "approval.requested") {
    return { title: "Yanshi approval requested", body: String(event.payload.request ?? "A run is waiting for approval.") };
  }
  if (event.type === "run.completed") {
    return { title: "Yanshi run completed", body: String(event.payload.summary ?? "Run completed.") };
  }
  if (event.type === "run.failed") {
    return { title: "Yanshi run failed", body: String(event.payload.summary ?? "Run failed.") };
  }
  if (event.type === "runtime.status.changed" && String(event.payload.status ?? "").includes("failed")) {
    return { title: "Yanshi runtime error", body: String(event.payload.detail ?? "Runtime reported an error.") };
  }
  return null;
}
