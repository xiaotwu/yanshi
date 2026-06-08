import type {
  AppSettings,
  ApprovalSummary,
  DesktopRuntimeStatus,
  LiveAgentState,
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
  loading: boolean;
  error: string | null;
  hydrate: () => Promise<void>;
  createRun: (task: string, permissionMode: "default" | "auto_review" | "full_access", projectId?: string | null) => Promise<void>;
  createProject: (name: string, description?: string) => Promise<void>;
  updateProject: (projectId: string, update: { name?: string; description?: string; settings?: Record<string, unknown> }) => Promise<void>;
  deleteProject: (projectId: string) => Promise<void>;
  setActiveProject: (projectId: string | null) => void;
  importWorkshopPack: (file: File) => Promise<void>;
  setWorkshopPackEnabled: (packId: string, enabled: boolean) => Promise<void>;
  decideApproval: (approvalId: string, decision: "approved" | "denied") => Promise<void>;
  pauseAllRuns: () => Promise<void>;
  restartRuntime: () => Promise<void>;
  refreshMacosPermissions: () => Promise<void>;
  saveProviderSettings: (settings: { baseUrl: string; model: string; apiKey?: string }) => Promise<void>;
  checkProviderHealth: () => Promise<void>;
  saveAppSettings: (settings: Partial<AppSettings>) => Promise<void>;
  connectEvents: () => void;
}

const defaultAgents: LiveAgentState[] = [
  { id: "agent_manager", name: "Manager", role: "manager", status: "idle", station: "manager", queueCount: 0, fatigue: 0 },
  { id: "agent_browser", name: "Browser", role: "browser", status: "idle", station: "browser", queueCount: 0, fatigue: 0 },
  { id: "agent_computer", name: "Computer", role: "computer", status: "idle", station: "computer", queueCount: 0, fatigue: 0 },
  { id: "agent_file", name: "File", role: "file", status: "idle", station: "file", queueCount: 0, fatigue: 0 },
  { id: "agent_reviewer", name: "Reviewer", role: "reviewer", status: "idle", station: "reviewer", queueCount: 0, fatigue: 0 },
  { id: "agent_terminal", name: "Terminal", role: "terminal", status: "idle", station: "terminal", queueCount: 0, fatigue: 0 },
];

let socket: WebSocket | null = null;

function eventStatus(event: YanshiEvent): LiveAgentState["status"] | null {
  if (event.type === "agent.task.assigned" || event.type === "action.created") return "working";
  if (event.type === "agent.task.completed" || event.type === "action.completed") return "done";
  if (event.type === "agent.task.failed" || event.type === "action.failed") return "failed";
  if (event.type === "approval.requested") return "waiting_approval";
  if (event.type === "run.failed") return "failed";
  if (event.type === "run.completed") return "done";
  return null;
}

function reduceAgents(agents: LiveAgentState[], event: YanshiEvent): LiveAgentState[] {
  const status = eventStatus(event);
  if (!status) return agents;
  const agentId = event.agentId || (event.type.startsWith("approval.") ? "agent_reviewer" : "agent_manager");
  return agents.map((agent) => (agent.id === agentId ? { ...agent, status, queueCount: status === "working" ? 1 : 0 } : agent));
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
  liveAgents: defaultAgents,
  loading: false,
  error: null,

  hydrate: async () => {
    set({ loading: true, error: null });
    try {
      const [status, runs, approvals, providerSettings, appSettings, projects, workshopPacks] = await Promise.all([
        runtimeApi.status(),
        runtimeApi.runs(),
        runtimeApi.approvals(),
        runtimeApi.providerSettings(),
        runtimeApi.appSettings(),
        runtimeApi.projects(),
        runtimeApi.workshopPacks(),
      ]);
      const [desktopStatus, macosPermissions] = await Promise.all([getDesktopRuntimeStatus(), getMacosPermissionStatus()]);
      const activeProjectId = projects.some((project) => project.id === get().activeProjectId) ? get().activeProjectId : null;
      set({
        status,
        desktopStatus,
        macosPermissions,
        providerSettings,
        appSettings,
        projects,
        workshopPacks,
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

  createRun: async (task, permissionMode, projectId) => {
    set({ loading: true, error: null });
    try {
      const run = await runtimeApi.createRun(task, permissionMode, projectId);
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

  createProject: async (name, description) => {
    set({ loading: true, error: null });
    try {
      const project = await runtimeApi.createProject(name, description);
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

  connectEvents: () => {
    if (socket && socket.readyState !== WebSocket.CLOSED) return;
    socket = new WebSocket(runtimeApi.eventsUrl());
    socket.onmessage = (message) => {
      const payload = JSON.parse(message.data) as { seq: number; event: YanshiEvent };
      set((state) => ({
        events: [...state.events.slice(-300), payload],
        liveAgents: reduceAgents(state.liveAgents, payload.event),
      }));
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
