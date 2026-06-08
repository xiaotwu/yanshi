import type {
  AgentTaskSummary,
  AppSettings,
  ApprovalSummary,
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
  createRun: (task: string, permissionMode: "default" | "auto_review" | "full_access", projectId?: string | null) =>
    request<RunSummary>("/runs", {
      method: "POST",
      body: JSON.stringify({ task, permissionMode, ...(projectId ? { projectId } : {}) }),
    }),
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
