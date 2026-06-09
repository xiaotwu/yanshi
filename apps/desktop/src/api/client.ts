import type {
  AgentInstanceSummary,
  AgentProfileSummary,
  AgentTaskSummary,
  AppSettings,
  ApprovalSummary,
  ArtifactSummary,
  AutomationSummary,
  BehaviorMode,
  LiveOfficeStateSummary,
  PermissionMode,
  ProjectFilesResult,
  ProjectSummary,
  ProviderHealth,
  ProviderSettingsPublic,
  RunSummary,
  RuntimeHealth,
  RuntimeStatus,
  WorkshopPackSummary,
} from "@yanshi/shared";

const runtimeUrl = import.meta.env.VITE_RUNTIME_URL || "http://127.0.0.1:8765";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${runtimeUrl}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail || response.statusText);
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export const runtimeApi = {
  runtimeUrl,
  health: () => request<RuntimeHealth>("/health"),
  status: () => request<RuntimeStatus>("/runtime/status"),
  appSettings: () => request<AppSettings>("/settings"),
  updateAppSettings: (settings: Partial<AppSettings>) =>
    request<AppSettings>("/settings", {
      method: "PUT",
      body: JSON.stringify(settings),
    }),
  providerSettings: () => request<ProviderSettingsPublic>("/settings/provider"),
  updateProviderSettings: (settings: { baseUrl: string; model: string; apiKey?: string }) =>
    request<ProviderSettingsPublic>("/settings/provider", {
      method: "PUT",
      body: JSON.stringify(settings),
    }),
  providerHealth: () =>
    request<ProviderHealth>("/provider/health", {
      method: "POST",
      body: "{}",
    }),
  projects: () => request<ProjectSummary[]>("/projects"),
  project: (projectId: string) => request<ProjectSummary>(`/projects/${projectId}`),
  createProject: (name: string, description?: string) =>
    request<ProjectSummary>("/projects", {
      method: "POST",
      body: JSON.stringify({ name, ...(description ? { description } : {}) }),
    }),
  updateProject: (projectId: string, update: { name?: string; description?: string; settings?: Record<string, unknown> }) =>
    request<ProjectSummary>(`/projects/${projectId}`, {
      method: "PUT",
      body: JSON.stringify(update),
    }),
  deleteProject: (projectId: string) =>
    request<void>(`/projects/${projectId}`, {
      method: "DELETE",
    }),
  runs: (projectId?: string | null) => request<RunSummary[]>(projectId ? `/runs?projectId=${encodeURIComponent(projectId)}` : "/runs"),
  run: (runId: string) => request<RunSummary>(`/runs/${runId}`),
  createRun: (
    task: string,
    permissionMode: "default" | "auto_review" | "full_access",
    projectId?: string | null,
    planFirst?: boolean,
    reasoning?: "low" | "medium" | "high" | "extra_high",
  ) =>
    request<RunSummary>("/runs", {
      method: "POST",
      body: JSON.stringify({
        task,
        permissionMode,
        ...(projectId ? { projectId } : {}),
        ...(planFirst ? { planFirst } : {}),
        ...(reasoning ? { reasoning } : {}),
      }),
    }),
  projectFiles: (projectId: string) => request<ProjectFilesResult>(`/projects/${projectId}/files`),
  artifacts: (filters?: { projectId?: string | null; runId?: string | null }) => {
    const params = new URLSearchParams();
    if (filters?.projectId) params.set("projectId", filters.projectId);
    if (filters?.runId) params.set("runId", filters.runId);
    const query = params.toString();
    return request<ArtifactSummary[]>(query ? `/artifacts?${query}` : "/artifacts");
  },
  automations: (projectId?: string | null) =>
    request<AutomationSummary[]>(projectId ? `/automations?projectId=${encodeURIComponent(projectId)}` : "/automations"),
  createAutomation: (body: {
    name: string;
    task: string;
    projectId?: string | null;
    permissionMode?: PermissionMode;
    planFirst?: boolean;
    scheduleKind?: "manual" | "interval";
    intervalMinutes?: number | null;
  }) => request<AutomationSummary>("/automations", { method: "POST", body: JSON.stringify(body) }),
  updateAutomation: (automationId: string, update: { enabled?: boolean; name?: string }) =>
    request<AutomationSummary>(`/automations/${automationId}`, { method: "PUT", body: JSON.stringify(update) }),
  deleteAutomation: (automationId: string) => request<void>(`/automations/${automationId}`, { method: "DELETE" }),
  runAutomation: (automationId: string) => request<RunSummary>(`/automations/${automationId}/run`, { method: "POST", body: "{}" }),
  automationRuns: (automationId: string) => request<RunSummary[]>(`/automations/${automationId}/runs`),
  agentProfiles: () => request<AgentProfileSummary[]>("/agent-profiles"),
  createAgentProfile: (body: { name: string; role?: string; station?: string; behaviorMode?: BehaviorMode; accent?: string; taskPriority?: number }) =>
    request<AgentProfileSummary>("/agent-profiles", { method: "POST", body: JSON.stringify(body) }),
  updateAgentProfile: (id: string, update: Partial<Pick<AgentProfileSummary, "name" | "prompt" | "personality" | "accent" | "behaviorMode" | "station" | "taskPriority">>) =>
    request<AgentProfileSummary>(`/agent-profiles/${id}`, { method: "PUT", body: JSON.stringify(update) }),
  deleteAgentProfile: (id: string) => request<void>(`/agent-profiles/${id}`, { method: "DELETE" }),
  agentInstances: (projectId?: string | null) =>
    request<AgentInstanceSummary[]>(projectId ? `/agent-instances?projectId=${encodeURIComponent(projectId)}` : "/agent-instances"),
  liveOffice: (projectId?: string | null) =>
    request<LiveOfficeStateSummary>(projectId ? `/live-office?projectId=${encodeURIComponent(projectId)}` : "/live-office"),
  updateLiveOffice: (projectId: string | null, update: Partial<Pick<LiveOfficeStateSummary, "theme" | "behaviorMode" | "cameraMode" | "stationLayout">>) =>
    request<LiveOfficeStateSummary>(projectId ? `/live-office?projectId=${encodeURIComponent(projectId)}` : "/live-office", {
      method: "PUT",
      body: JSON.stringify(update),
    }),
  exportPackUrl: (projectId?: string | null) => `${runtimeUrl}/workshop/export${projectId ? `?projectId=${encodeURIComponent(projectId)}` : ""}`,
  uploadFiles: async (projectId: string | null, files: File[]) => {
    const form = new FormData();
    files.forEach((file) => form.append("files", file));
    const response = await fetch(`${runtimeUrl}/uploads${projectId ? `?projectId=${encodeURIComponent(projectId)}` : ""}`, {
      method: "POST",
      body: form,
    });
    if (!response.ok) throw new Error(await response.text());
    return (await response.json()) as { files: Array<{ name: string; path: string; size: number }> };
  },
  pauseRun: (runId: string) =>
    request<RunSummary>(`/runs/${runId}/pause`, {
      method: "POST",
      body: "{}",
    }),
  approvals: () => request<ApprovalSummary[]>("/approvals"),
  agentTasks: (filters?: { runId?: string | null; projectId?: string | null; agentId?: string | null }) => {
    const params = new URLSearchParams();
    if (filters?.runId) params.set("runId", filters.runId);
    if (filters?.projectId) params.set("projectId", filters.projectId);
    if (filters?.agentId) params.set("agentId", filters.agentId);
    const query = params.toString();
    return request<AgentTaskSummary[]>(query ? `/agent-tasks?${query}` : "/agent-tasks");
  },
  decideApproval: (approvalId: string, decision: "approved" | "denied") =>
    request<ApprovalSummary>(`/approvals/${approvalId}/decision`, {
      method: "POST",
      body: JSON.stringify({ decision }),
    }),
  eventsUrl: () => `${runtimeUrl.replace(/^http/, "ws")}/events`,
  validatePack: async (file: File) => {
    const form = new FormData();
    form.append("pack", file);
    const response = await fetch(`${runtimeUrl}/workshop/validate`, {
      method: "POST",
      body: form,
    });
    if (!response.ok) throw new Error(await response.text());
    return (await response.json()) as { ok: boolean; errors: string[]; name?: string; version?: string };
  },
  importPack: async (file: File) => {
    const form = new FormData();
    form.append("pack", file);
    const response = await fetch(`${runtimeUrl}/workshop/import`, {
      method: "POST",
      body: form,
    });
    if (!response.ok) throw new Error(await response.text());
    return (await response.json()) as WorkshopPackSummary;
  },
  workshopPacks: () => request<WorkshopPackSummary[]>("/workshop/packs"),
  setWorkshopPackEnabled: (packId: string, enabled: boolean) =>
    request<WorkshopPackSummary>(`/workshop/packs/${packId}/enabled`, {
      method: "PUT",
      body: JSON.stringify({ enabled }),
    }),
};
