import type {
  AgentInstanceSummary,
  AgentProfileSummary,
  AgentTaskSummary,
  AiIntegrationsConfig,
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
  YanshiEvent,
} from "@yanshi/shared";

const runtimeUrl = import.meta.env.VITE_RUNTIME_URL || "http://127.0.0.1:8765";

// Per-session token gate: the runtime rejects every request (except /health) without it. The token
// is sent only as an Authorization header — never in a URL. It comes from the Tauri shell (which
// minted it and shares it with the sidecar) or, in the browser dev flow, from VITE_RUNTIME_TOKEN.
let tokenPromise: Promise<string | null> | null = null;

async function resolveToken(): Promise<string | null> {
  const envToken = import.meta.env.VITE_RUNTIME_TOKEN as string | undefined;
  if (envToken) return envToken;
  if (typeof window !== "undefined" && "__TAURI_INTERNALS__" in window) {
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      return (await invoke<string | null>("runtime_token")) ?? null;
    } catch {
      return null;
    }
  }
  return null;
}

function ensureToken(): Promise<string | null> {
  if (!tokenPromise) tokenPromise = resolveToken();
  return tokenPromise;
}
void ensureToken();

// Header-less callers (the event WebSocket, <img> preview src, window.open downloads) can't send the
// Authorization header, so they use short-lived, scope-bound tickets instead of the raw token. The
// runtime mints them at /auth/ticket (header-authenticated). Cache per scope and refresh near expiry.
type CachedTicket = { value: string; expiresAtMs: number };
const ticketCache: Record<string, CachedTicket> = {};
const ticketInFlight: Record<string, Promise<string | null> | undefined> = {};

async function ensureTicket(scope: "events" | "preview" | "export"): Promise<string | null> {
  const cached = ticketCache[scope];
  if (cached && cached.expiresAtMs - 10_000 > Date.now()) return cached.value;
  if (!ticketInFlight[scope]) {
    ticketInFlight[scope] = (async () => {
      try {
        const res = await request<{ ticket: string; expiresAt: string }>("/auth/ticket", {
          method: "POST",
          body: JSON.stringify({ scope }),
        });
        ticketCache[scope] = { value: res.ticket, expiresAtMs: Date.parse(res.expiresAt) };
        return res.ticket;
      } catch {
        return null;
      } finally {
        ticketInFlight[scope] = undefined;
      }
    })();
  }
  return ticketInFlight[scope]!;
}

async function authHeaders(extra?: HeadersInit): Promise<HeadersInit> {
  const token = await ensureToken();
  const headers: Record<string, string> = { ...(extra as Record<string, string>) };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${runtimeUrl}${path}`, {
    ...init,
    headers: await authHeaders({
      "Content-Type": "application/json",
      ...init?.headers,
    }),
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
  aiIntegrations: () => request<AiIntegrationsConfig>("/settings/integrations"),
  updateAiIntegrations: (update: Partial<AiIntegrationsConfig>) =>
    request<AiIntegrationsConfig>("/settings/integrations", {
      method: "PUT",
      body: JSON.stringify(update),
    }),
  connectExternalAgent: (agentId: string) =>
    request<AiIntegrationsConfig>(`/settings/integrations/agents/${agentId}/connect`, { method: "POST", body: "{}" }),
  disconnectExternalAgent: (agentId: string) =>
    request<AiIntegrationsConfig>(`/settings/integrations/agents/${agentId}/disconnect`, { method: "POST", body: "{}" }),
  connectMcpServer: (id: string) =>
    request<AiIntegrationsConfig>(`/settings/integrations/mcp/${id}/connect`, { method: "POST", body: "{}" }),
  disconnectMcpServer: (id: string) =>
    request<AiIntegrationsConfig>(`/settings/integrations/mcp/${id}/disconnect`, { method: "POST", body: "{}" }),
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
  providerModels: () => request<{ models: string[] }>("/provider/models"),
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
    parentRunId?: string | null,
  ) =>
    request<RunSummary>("/runs", {
      method: "POST",
      body: JSON.stringify({
        task,
        permissionMode,
        ...(projectId ? { projectId } : {}),
        ...(planFirst ? { planFirst } : {}),
        ...(reasoning ? { reasoning } : {}),
        ...(parentRunId ? { parentRunId } : {}),
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
  agentProfiles: (projectId?: string | null) =>
    request<AgentProfileSummary[]>(projectId ? `/agent-profiles?projectId=${encodeURIComponent(projectId)}` : "/agent-profiles"),
  createAgentProfile: (body: { name: string; role?: string; station?: string; behaviorMode?: BehaviorMode; accent?: string; taskPriority?: number }, projectId?: string | null) =>
    request<AgentProfileSummary>(projectId ? `/agent-profiles?projectId=${encodeURIComponent(projectId)}` : "/agent-profiles", { method: "POST", body: JSON.stringify(body) }),
  updateAgentProfile: (id: string, update: Partial<Pick<AgentProfileSummary, "name" | "prompt" | "personality" | "accent" | "behaviorMode" | "station" | "taskPriority" | "model" | "defaultTools">>) =>
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
  exportPackUrl: async (projectId?: string | null) => {
    // Opened via window.open (no Authorization header), so it carries a short-lived export ticket.
    const ticket = await ensureTicket("export");
    const params = new URLSearchParams();
    if (projectId) params.set("projectId", projectId);
    if (ticket) params.set("ticket", ticket);
    const qs = params.toString();
    return `${runtimeUrl}/workshop/export${qs ? `?${qs}` : ""}`;
  },
  uploadFiles: async (projectId: string | null, files: File[]) => {
    const form = new FormData();
    files.forEach((file) => form.append("files", file));
    const response = await fetch(`${runtimeUrl}/uploads${projectId ? `?projectId=${encodeURIComponent(projectId)}` : ""}`, {
      method: "POST",
      headers: await authHeaders(),
      body: form,
    });
    if (!response.ok) throw new Error(await response.text());
    return (await response.json()) as { files: Array<{ name: string; path: string; size: number }> };
  },
  cancelRun: (runId: string) =>
    request<RunSummary>(`/runs/${runId}/cancel`, {
      method: "POST",
      body: "{}",
    }),
  runPartial: (runId: string) => request<{ text: string; done: boolean }>(`/runs/${runId}/partial`),
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
  /** Mint a fresh events-scoped ticket for the WS. The store awaits this before (re)connecting. */
  eventsTicket: () => ensureTicket("events"),
  eventsUrl: (after = 0, ticket?: string | null) => {
    const params = new URLSearchParams();
    if (after > 0) params.set("after", String(after));
    if (ticket) params.set("ticket", ticket);
    const qs = params.toString();
    return `${runtimeUrl.replace(/^http/, "ws")}/events${qs ? `?${qs}` : ""}`;
  },
  /** REST view of the same event log as the WebSocket (`{seq, event}` rows after a cursor) —
   *  used as the polling fallback when ws:// is blocked (packaged WKWebView secure context). */
  events: (after = 0) => request<Array<{ seq: number; event: YanshiEvent }>>(`/events?after=${after}`),
  /** URL for an inline image preview (used as an <img src>, which can't set headers — so it carries
   *  a short-lived preview ticket instead of the token). Async because it may mint the ticket. */
  previewUrl: async (path: string, projectId?: string | null) => {
    const ticket = await ensureTicket("preview");
    const params = new URLSearchParams({ path });
    if (projectId) params.set("projectId", projectId);
    if (ticket) params.set("ticket", ticket);
    return `${runtimeUrl}/preview?${params.toString()}`;
  },
  validatePack: async (file: File) => {
    const form = new FormData();
    form.append("pack", file);
    const response = await fetch(`${runtimeUrl}/workshop/validate`, {
      method: "POST",
      headers: await authHeaders(),
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
      headers: await authHeaders(),
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
