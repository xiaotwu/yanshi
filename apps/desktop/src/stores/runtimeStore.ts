import type {
  AgentInstanceSummary,
  AgentProfileSummary,
  AiIntegrationsConfig,
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
// Used only at call time inside notification helpers — safe despite i18n importing this store.
import { resolveLocale, translate } from "../i18n";
import { codeForMissingRequirement, reportError } from "../lib/errors";
import { isBusyStatus } from "../lib/shared";
import type { LanguagePref, Locale } from "../i18n";

interface RuntimeStore {
  status: RuntimeStatus | null;
  desktopStatus: DesktopRuntimeStatus | null;
  macosPermissions: MacosPermissionStatus | null;
  providerSettings: ProviderSettingsPublic | null;
  providerHealth: ProviderHealth | null;
  appSettings: AppSettings | null;
  aiIntegrations: AiIntegrationsConfig | null;
  projects: ProjectSummary[];
  workshopPacks: WorkshopPackSummary[];
  runs: RunSummary[];
  approvals: ApprovalSummary[];
  events: Array<{ seq: number; event: YanshiEvent }>;
  activeProjectId: string | null;
  activeRunId: string | null;
  eventStreamStatus: EventStreamStatus;
  liveAgents: LiveAgentState[];
  agentProfiles: AgentProfileSummary[];
  agentInstances: AgentInstanceSummary[];
  officeState: LiveOfficeStateSummary | null;
  loading: boolean;
  /** False until the first hydrate resolves — drives initial skeleton/shimmer states. */
  ready: boolean;
  error: string | null;
  hydrate: () => Promise<void>;
  /** Background refresh of the dynamic slices (no loading toggle, no desktop IPC). Driven by the
   *  event stream via a debounce; cheaper than a full hydrate and won't flicker loading-gated UI. */
  refresh: () => Promise<void>;
  createRun: (
    task: string,
    permissionMode: "default" | "auto_review" | "full_access",
    projectId?: string | null,
    planFirst?: boolean,
    reasoning?: "low" | "medium" | "high" | "extra_high",
    parentRunId?: string | null,
  ) => Promise<void>;
  /** Continue the currently-open chat with a follow-up turn (threaded to the active run). */
  continueChat: (task: string) => Promise<void>;
  createProject: (name: string, description?: string, settings?: Record<string, unknown>) => Promise<string | undefined>;
  updateProject: (projectId: string, update: { name?: string; description?: string; settings?: Record<string, unknown> }) => Promise<void>;
  deleteProject: (projectId: string) => Promise<void>;
  setActiveProject: (projectId: string | null) => void;
  setActiveRun: (runId: string) => void;
  importWorkshopPack: (file: File) => Promise<void>;
  setWorkshopPackEnabled: (packId: string, enabled: boolean) => Promise<void>;
  decideApproval: (approvalId: string, decision: "approved" | "denied") => Promise<void>;
  cancelAllRuns: () => Promise<void>;
  cancelRun: (runId: string) => Promise<void>;
  restartRuntime: () => Promise<void>;
  refreshMacosPermissions: () => Promise<void>;
  saveProviderSettings: (settings: { baseUrl: string; model: string; apiKey?: string }) => Promise<boolean>;
  checkProviderHealth: () => Promise<void>;
  saveAppSettings: (settings: Partial<AppSettings>) => Promise<void>;
  loadAiIntegrations: () => Promise<void>;
  saveAiIntegrations: (update: Partial<AiIntegrationsConfig>) => Promise<void>;
  connectExternalAgent: (agentId: string) => Promise<void>;
  disconnectExternalAgent: (agentId: string) => Promise<void>;
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

export type EventStreamStatus = "connecting" | "connected" | "reconnecting" | "polling" | "unavailable";

const STREAM_ERROR = "Event stream unavailable.";

let socket: WebSocket | null = null;
let streamStarted = false;
let lastEventSeq = 0;
let pollTimer: ReturnType<typeof setTimeout> | null = null;
let wsRetryTimer: ReturnType<typeof setTimeout> | null = null;
let wsAttempts = 0;
let pollFailures = 0;
// Coalesce event-driven refreshes: a busy run emits many events, but we only need one refresh per
// burst. Trailing debounce so the last event in a burst still triggers a final refresh.
let refreshTimer: ReturnType<typeof setTimeout> | null = null;
const REFRESH_DEBOUNCE_MS = 200;

/** Exponential backoff for WebSocket reconnects, capped at 15s. */
export function wsBackoffDelay(attempt: number): number {
  return Math.min(1000 * 2 ** Math.max(attempt - 1, 0), 15000);
}

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
    // Seed fatigue/queue (decorative) from the persisted instance, but NOT a stale terminal status —
    // displayed task status comes only from the currently-active run (see activeRunIds below), so the
    // office reads calm/idle between runs instead of stranding old "Failed"/"Done" labels.
    acc.set(profile.id, {
      status: "idle",
      queue: persisted?.queueCount ?? 0,
      work: persisted ? Math.round(persisted.fatigue / 0.16) : 0,
      task: null,
    });
  }

  // A run is "active" if it has started and has no terminal (completed/failed/cancelled) event.
  const terminalRunIds = new Set<string>();
  const startedRunIds = new Set<string>();
  for (const { event } of events) {
    if (!event.runId) continue;
    if (event.type === "run.completed" || event.type === "run.failed" || event.type === "run.cancelled") terminalRunIds.add(event.runId);
    else if (event.type === "run.started") startedRunIds.add(event.runId);
  }
  const activeRunIds = new Set([...startedRunIds].filter((runId) => !terminalRunIds.has(runId)));

  for (const { event } of events) {
    // Only events belonging to an active run drive live worker state — events from finished runs are
    // history and must not produce stale/mixed labels in the Atelier.
    if (!event.runId || !activeRunIds.has(event.runId)) continue;
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
  aiIntegrations: null,
  projects: [],
  workshopPacks: [],
  runs: [],
  approvals: [],
  events: [],
  activeProjectId: null,
  activeRunId: null,
  eventStreamStatus: "connecting",
  liveAgents: computeAgents(FALLBACK_PROFILES as AgentProfileSummary[], [], "balanced"),
  agentProfiles: [],
  agentInstances: [],
  officeState: null,
  loading: false,
  ready: false,
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
      if (desktopStatus?.missingRequirements.some((item) => item.toLowerCase().includes("shortcut"))) {
        reportError("YANSHI_SHORTCUT_002", desktopStatus.missingRequirements);
      }
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
        ready: true,
      });
    } catch (error) {
      reportError("YANSHI_RUNTIME_001", error);
      set({ error: error instanceof Error ? error.message : "Runtime unavailable.", loading: false, ready: true });
      const [desktopStatus, macosPermissions] = await Promise.all([getDesktopRuntimeStatus(), getMacosPermissionStatus()]);
      set({ desktopStatus, macosPermissions });
    }
  },

  refresh: async () => {
    // Only the slices that runtime events can invalidate. Excludes provider/app settings and agent
    // profiles (changed through explicit store actions, not events) and the desktop/permission IPC.
    // Deliberately does not touch `loading` — background refreshes must not flicker gated UI.
    try {
      const currentProjectId = get().activeProjectId;
      const [status, runs, approvals, projects, workshopPacks, officeState, agentInstances] = await Promise.all([
        runtimeApi.status(),
        runtimeApi.runs(),
        runtimeApi.approvals(),
        runtimeApi.projects(),
        runtimeApi.workshopPacks(),
        runtimeApi.liveOffice(currentProjectId),
        runtimeApi.agentInstances(currentProjectId),
      ]);
      const activeProjectId = projects.some((project) => project.id === currentProjectId) ? currentProjectId : null;
      set((state) => ({
        status,
        runs,
        approvals,
        projects,
        workshopPacks,
        officeState,
        agentInstances,
        activeProjectId,
        liveAgents: computeAgents(state.agentProfiles, state.events, officeState.behaviorMode, agentInstances),
      }));
    } catch (error) {
      // A failed background refresh is non-fatal — the next event (or the WS reconnect) retries.
      reportError("YANSHI_RUNTIME_001", error);
    }
  },

  createRun: async (task, permissionMode, projectId, planFirst, reasoning, parentRunId) => {
    set({ loading: true, error: null });
    try {
      const previousProjectId = get().activeProjectId;
      const run = await runtimeApi.createRun(task, permissionMode, projectId, planFirst, reasoning, parentRunId);
      const [runs, approvals] = await Promise.all([runtimeApi.runs(), runtimeApi.approvals()]);
      const nextProjectId = projectId === undefined ? previousProjectId : (projectId ?? null);
      set({
        activeRunId: run.id,
        activeProjectId: nextProjectId,
        runs,
        approvals,
        loading: false,
      });
      // Atelier context follows the chat: a standalone chat resets to the global office, a
      // project chat inherits that project's office state and agent team.
      if (nextProjectId !== previousProjectId) {
        void get().loadAgentInstances(nextProjectId);
        void get().loadOfficeState(nextProjectId);
      }
    } catch (error) {
      reportError("YANSHI_RUNTIME_001", error);
      set({ error: error instanceof Error ? error.message : "Could not create run.", loading: false });
    }
  },

  continueChat: async (task) => {
    const state = get();
    const parent = state.runs.find((item) => item.id === state.activeRunId);
    if (!parent) return;
    // Follow-up turn: same project, threaded to the active run so the runtime carries
    // the prior conversation into the new turn's synthesis.
    await state.createRun(task, "default", parent.projectId ?? null, false, undefined, parent.id);
  },

  createProject: async (name, description, settings) => {
    set({ loading: true, error: null });
    try {
      const project = await runtimeApi.createProject(name, description);
      if (settings && Object.keys(settings).length > 0) {
        await runtimeApi.updateProject(project.id, { settings: { ...project.settings, ...settings } });
      }
      const projects = await runtimeApi.projects();
      set({ projects, activeProjectId: project.id, loading: false });
      return project.id;
    } catch (error) {
      reportError("YANSHI_PROJECT_001", error);
      set({ error: error instanceof Error ? error.message : "Could not create project.", loading: false });
      return undefined;
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
      reportError("YANSHI_PROJECT_001", error);
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
      reportError("YANSHI_PROJECT_001", error);
      set({ error: error instanceof Error ? error.message : "Could not delete project.", loading: false });
    }
  },

  setActiveProject: (projectId) => {
    set({ activeProjectId: projectId });
    void get().loadAgentInstances(projectId);
    void get().loadOfficeState(projectId);
  },

  setActiveRun: (runId) => {
    // Opening a chat also switches the Atelier context to that chat's project (or the global
    // office for standalone chats).
    const run = get().runs.find((item) => item.id === runId);
    const projectId = run ? (run.projectId ?? null) : get().activeProjectId;
    const changed = projectId !== get().activeProjectId;
    set({ activeRunId: runId, activeProjectId: projectId });
    if (changed) {
      void get().loadAgentInstances(projectId);
      void get().loadOfficeState(projectId);
    }
  },

  importWorkshopPack: async (file) => {
    set({ loading: true, error: null });
    try {
      await runtimeApi.importPack(file);
      const workshopPacks = await runtimeApi.workshopPacks();
      set({ workshopPacks, loading: false });
    } catch (error) {
      reportError(error instanceof Error && /unsafe|rejected|validation/i.test(error.message) ? "YANSHI_WORKSHOP_002" : "YANSHI_WORKSHOP_001", error);
      set({ error: error instanceof Error ? error.message : "Could not import pack.", loading: false });
      // Rethrow so the caller doesn't report a false "Imported" success after a rejected pack.
      throw error;
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
      reportError("YANSHI_WORKSHOP_001", error);
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
      reportError("YANSHI_RUNTIME_001", error);
      set({ error: error instanceof Error ? error.message : "Could not decide approval.", loading: false });
    }
  },

  cancelRun: async (runId) => {
    try {
      await runtimeApi.cancelRun(runId);
      const runs = await runtimeApi.runs(get().activeProjectId);
      set({ runs });
    } catch (error) {
      reportError("YANSHI_RUNTIME_001", error);
    }
  },

  cancelAllRuns: async () => {
    // Real "stop everything" (replaces the old fake pause): cancel every in-flight run.
    const activeRuns = get().runs.filter((run) => isBusyStatus(run.status));
    if (activeRuns.length === 0) return;
    set({ loading: true, error: null });
    try {
      await Promise.all(activeRuns.map((run) => runtimeApi.cancelRun(run.id)));
      const runs = await runtimeApi.runs(get().activeProjectId);
      set({ runs, loading: false });
    } catch (error) {
      reportError("YANSHI_RUNTIME_001", error);
      set({ error: error instanceof Error ? error.message : "Could not cancel runs.", loading: false });
    }
  },

  restartRuntime: async () => {
    set({ loading: true, error: null });
    try {
      const [desktopStatus, macosPermissions] = await Promise.all([restartDesktopRuntime(), getMacosPermissionStatus()]);
      set({ desktopStatus, macosPermissions, loading: false });
      await get().hydrate();
    } catch (error) {
      reportError("YANSHI_RUNTIME_003", error);
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
      return true;
    } catch (error) {
      reportError("YANSHI_PROVIDER_003", error);
      set({ error: error instanceof Error ? error.message : "Could not save provider settings.", loading: false });
      return false;
    }
  },

  checkProviderHealth: async () => {
    set({ loading: true, error: null });
    try {
      const providerHealth = await runtimeApi.providerHealth();
      // The healthcheck request succeeded but the provider itself is unusable — still an error.
      if (!providerHealth.ok) {
        reportError(providerHealth.status === "not_configured" ? "YANSHI_PROVIDER_001" : "YANSHI_PROVIDER_002", providerHealth.detail);
      }
      set({ providerHealth, loading: false });
    } catch (error) {
      reportError("YANSHI_PROVIDER_002", error);
      set({ error: error instanceof Error ? error.message : "Provider healthcheck failed.", loading: false });
    }
  },

  saveAppSettings: async (settings) => {
    // Optimistic merge so rapid consecutive edits (e.g. profile name blur + avatar click) each
    // build on the latest local state instead of a stale snapshot — no lost updates.
    const current = get().appSettings;
    if (current) set({ appSettings: { ...current, ...settings } });
    set({ loading: true, error: null });
    try {
      const appSettings = await runtimeApi.updateAppSettings(settings);
      set({ appSettings, loading: false });
    } catch (error) {
      reportError("YANSHI_SETTINGS_001", error);
      set({ appSettings: current, error: error instanceof Error ? error.message : "Could not save settings.", loading: false });
    }
  },

  loadAiIntegrations: async () => {
    try {
      const aiIntegrations = await runtimeApi.aiIntegrations();
      set({ aiIntegrations });
    } catch {
      // Settings surface shows the runtime-unavailable state; nothing to fake here.
    }
  },

  saveAiIntegrations: async (update) => {
    set({ loading: true, error: null });
    try {
      const aiIntegrations = await runtimeApi.updateAiIntegrations(update);
      set({ aiIntegrations, loading: false });
    } catch (error) {
      reportError("YANSHI_MCP_001", error);
      set({ error: error instanceof Error ? error.message : "Could not save integrations.", loading: false });
    }
  },

  connectExternalAgent: async (agentId) => {
    set({ loading: true, error: null });
    try {
      const aiIntegrations = await runtimeApi.connectExternalAgent(agentId);
      set({ aiIntegrations, loading: false });
    } catch (error) {
      reportError("YANSHI_ACP_001", error);
      set({ error: error instanceof Error ? error.message : "Could not connect the agent.", loading: false });
    }
  },

  disconnectExternalAgent: async (agentId) => {
    set({ loading: true, error: null });
    try {
      const aiIntegrations = await runtimeApi.disconnectExternalAgent(agentId);
      set({ aiIntegrations, loading: false });
    } catch (error) {
      reportError("YANSHI_ACP_001", error);
      set({ error: error instanceof Error ? error.message : "Could not disconnect the agent.", loading: false });
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

  // Event stream: WebSocket primary with backoff reconnect, HTTP polling of the same real
  // `GET /events?after=seq` as fallback (the server's WS loop is itself a 250ms poll, so the
  // transports are equivalent). Needed because the packaged app's tauri:// origin is a secure
  // context and WKWebView blocks insecure ws:// to loopback while plain http:// fetches work.
  // The "Event stream unavailable." error only appears when BOTH transports keep failing, and it
  // clears automatically on recovery; retrying never stops.
  connectEvents: () => {
    if (streamStarted) return;
    streamStarted = true;

    const handlePayload = (payload: { seq: number; event: YanshiEvent }) => {
      if (payload.seq <= lastEventSeq) return; // dedup across WS/poll transports
      lastEventSeq = payload.seq;
      set((state) => {
        const events = [...state.events.slice(-300), payload];
        return {
          events,
          liveAgents: computeAgents(state.agentProfiles, events, state.officeState?.behaviorMode ?? "balanced", state.agentInstances),
        };
      });
      notifyForEvent(payload.event, get().appSettings?.notificationsEnabled ?? true, get().appSettings?.language);
      // Honest tool blockers (missing Chromium, macOS permissions, Docker…) surface as coded
      // toasts; the dedupe window keeps repeated observations from spamming.
      const requirement = payload.event.payload?.missingRequirement;
      if (typeof requirement === "string" && requirement) {
        const requirementCode = codeForMissingRequirement(requirement);
        if (requirementCode) reportError(requirementCode, requirement);
      }
      if (
        payload.event.type.startsWith("run.") ||
        payload.event.type.startsWith("approval.") ||
        payload.event.type.startsWith("project.") ||
        payload.event.type.startsWith("workshop.")
      ) {
        // Coalesce: a run can emit many events in quick succession, but one refresh per burst is
        // enough. Trailing debounce keeps the UI current without a request storm.
        if (refreshTimer) clearTimeout(refreshTimer);
        refreshTimer = setTimeout(() => {
          refreshTimer = null;
          void get().refresh();
        }, REFRESH_DEBOUNCE_MS);
      }
    };

    const setStreamStatus = (status: EventStreamStatus) => {
      // Toast only on the transition into "unavailable" (recovery is silent + auto-clears).
      if (status === "unavailable" && get().eventStreamStatus !== "unavailable") {
        reportError("YANSHI_RUNTIME_002", "event stream unavailable after ws + polling retries");
      }
      const patch: Partial<Pick<RuntimeStore, "eventStreamStatus" | "error">> = { eventStreamStatus: status };
      if (status === "unavailable") patch.error = STREAM_ERROR;
      else if (get().error === STREAM_ERROR) patch.error = null;
      set(patch);
    };

    const stopPolling = () => {
      if (pollTimer) {
        clearTimeout(pollTimer);
        pollTimer = null;
      }
      pollFailures = 0;
    };

    const startPolling = () => {
      if (pollTimer) return;
      const tick = async () => {
        try {
          const batch = await runtimeApi.events(lastEventSeq);
          pollFailures = 0;
          for (const payload of batch) handlePayload(payload);
          if (!socket || socket.readyState !== WebSocket.OPEN) setStreamStatus("polling");
        } catch {
          pollFailures += 1;
          if (pollFailures >= 3 && (!socket || socket.readyState !== WebSocket.OPEN)) setStreamStatus("unavailable");
        }
        // Slow down while clearly unavailable, keep retrying forever.
        pollTimer = setTimeout(() => void tick(), pollFailures >= 3 ? 2000 : 400);
      };
      pollTimer = setTimeout(() => void tick(), 0);
    };

    const scheduleWsRetry = () => {
      if (wsRetryTimer) return;
      wsAttempts += 1;
      wsRetryTimer = setTimeout(() => {
        wsRetryTimer = null;
        connectWs();
      }, wsBackoffDelay(wsAttempts));
    };

    const connectWs = () => {
      let next: WebSocket;
      try {
        next = new WebSocket(runtimeApi.eventsUrl(lastEventSeq));
      } catch {
        startPolling();
        scheduleWsRetry();
        return;
      }
      socket = next;
      next.onopen = () => {
        wsAttempts = 0;
        stopPolling();
        setStreamStatus("connected");
      };
      next.onmessage = (message) => handlePayload(JSON.parse(message.data) as { seq: number; event: YanshiEvent });
      const onDown = () => {
        if (socket !== next) return; // stale socket from a previous attempt
        if (get().eventStreamStatus === "connected") setStreamStatus("reconnecting");
        startPolling();
        scheduleWsRetry();
      };
      next.onerror = onDown;
      next.onclose = onDown;
    };

    setStreamStatus("connecting");
    // The WS carries the session token as a query param (it can't send an Authorization header), so
    // resolve+cache it before the first connect; reconnects read the cached value synchronously.
    void runtimeApi.ensureToken().then(connectWs);
  },
}));

function notifyForEvent(event: YanshiEvent, enabled: boolean, language: string | undefined): void {
  if (!enabled) return;
  const titleBody = notificationForEvent(event, resolveLocale(language as LanguagePref | undefined));
  if (!titleBody) return;
  void sendDesktopNotification(titleBody.title, titleBody.body).catch(() => undefined);
}

// Notification titles follow the UI language so zh-CN users see 偃师, not "Yanshi".
function notificationForEvent(event: YanshiEvent, locale: Locale): { title: string; body: string } | null {
  if (event.type === "approval.requested") {
    return { title: translate(locale, "notify.approval"), body: String(event.payload.request ?? "A run is waiting for approval.") };
  }
  if (event.type === "run.completed") {
    return { title: translate(locale, "notify.completed"), body: String(event.payload.summary ?? "Run completed.") };
  }
  if (event.type === "run.failed") {
    return { title: translate(locale, "notify.failed"), body: String(event.payload.summary ?? "Run failed.") };
  }
  if (event.type === "runtime.status.changed" && String(event.payload.status ?? "").includes("failed")) {
    return { title: translate(locale, "notify.runtimeError"), body: String(event.payload.detail ?? "Runtime reported an error.") };
  }
  return null;
}
