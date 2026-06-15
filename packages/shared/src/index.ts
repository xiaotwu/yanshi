export const EVENT_SCHEMA_VERSION = 1;

export type RunStatus =
  | "created"
  | "running"
  | "pending_approval"
  | "paused"
  | "completed"
  | "failed"
  | "cancelled";

export type RiskLevel = "low" | "medium" | "high" | "critical";

export type PermissionMode = "default" | "auto_review" | "full_access";

export type EventType =
  | "run.created"
  | "run.started"
  | "run.paused"
  | "run.resumed"
  | "run.completed"
  | "run.failed"
  | "run.cancelled"
  | "agent.created"
  | "agent.updated"
  | "agent.task.assigned"
  | "agent.task.started"
  | "agent.task.completed"
  | "agent.task.failed"
  | "agent.state.changed"
  | "plan.created"
  | "plan.updated"
  | "action.created"
  | "action.started"
  | "action.completed"
  | "action.failed"
  | "observation.created"
  | "approval.requested"
  | "approval.approved"
  | "approval.denied"
  | "approval.expired"
  | "artifact.created"
  | "artifact.updated"
  | "artifact.deleted"
  | "tool.call.requested"
  | "tool.call.started"
  | "tool.call.completed"
  | "tool.call.failed"
  | "project.created"
  | "project.updated"
  | "project.deleted"
  | "workshop.pack.imported"
  | "workshop.pack.enabled"
  | "workshop.pack.disabled"
  | "automation.created"
  | "automation.updated"
  | "automation.deleted"
  | "automation.started"
  | "automation.completed"
  | "liveOffice.state.updated"
  | "runtime.status.changed";

export interface YanshiEvent<TPayload = Record<string, unknown>> {
  eventId: string;
  type: EventType;
  schemaVersion: number;
  sourceRuntimeVersion: string;
  timestamp: string;
  projectId?: string | null;
  runId?: string | null;
  agentId?: string | null;
  payload: TPayload;
}

export interface RunSummary {
  id: string;
  projectId?: string | null;
  standalone: boolean;
  task: string;
  status: RunStatus;
  plan: string[];
  createdAt: string;
  updatedAt: string;
  completedAt?: string | null;
  resultSummary?: string | null;
  /** Conversation threading: runs in one chat share a threadId (own id when single-turn). */
  threadId?: string | null;
  parentRunId?: string | null;
}

export interface ProjectSummary {
  id: string;
  name: string;
  description?: string | null;
  workspacePath: string;
  agentTeamId?: string | null;
  liveOfficeStateId?: string | null;
  settings: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface ApprovalSummary {
  id: string;
  runId: string;
  targetType: "tool_call" | "action" | "run" | "session_grant";
  targetId: string;
  riskLevel: RiskLevel;
  status: "pending" | "approved" | "denied" | "expired";
  request: string;
  createdAt: string;
}

export interface AgentTaskSummary {
  id: string;
  runId: string;
  projectId?: string | null;
  agentId: string;
  task: string;
  status: "queued" | "running" | "completed" | "failed" | "cancelled";
  queueKind: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  startedAt?: string | null;
  completedAt?: string | null;
}

export interface RuntimeHealth {
  ok: boolean;
  runtimeVersion: string;
  databasePath: string;
}

export interface RuntimeStatus {
  status: "starting" | "running" | "degraded" | "failed";
  details: string;
  missingRequirements: string[];
}

export interface DesktopRuntimeStatus {
  status: "not_started" | "running" | "stopped" | "failed" | "setup_required" | string;
  detail: string;
  launchMode: string;
  runtimeUrl: string;
  logPath?: string | null;
  commandLabel?: string | null;
  lastError?: string | null;
  missingRequirements: string[];
  repairActions: string[];
}

export type MacosPermissionState = "granted" | "permission_required" | "unsupported" | string;

export interface MacosPermissionStatus {
  accessibility: MacosPermissionState;
  screenRecording: MacosPermissionState;
  requiredAction: string;
}

export interface ProviderSettingsPublic {
  baseUrl: string;
  model?: string | null;
  apiKeyConfigured: boolean;
}

export interface ProviderHealth {
  ok: boolean;
  status: "not_configured" | "healthy" | "failed";
  detail: string;
  baseUrl?: string | null;
  model?: string | null;
}

export interface AppSettings {
  permissionModeDefault: PermissionMode;
  developerMode: boolean;
  onboarded: boolean;
  theme: "light" | "dark" | "system";
  language: "system" | "en-US" | "zh-CN";
  reasoning: "low" | "medium" | "high" | "extra_high";
  liveOfficeAutoOpen: boolean;
  liveOfficeDefaultOpen: boolean;
  browserToolEnabled: boolean;
  computerToolEnabled: boolean;
  terminalToolEnabled: boolean;
  notificationsEnabled: boolean;
  openYanshiShortcut: string;
  dockerImage: string;
  dockerMemory: string;
  dockerCpus: string;
  dockerPidsLimit: number;
  gpuAcceleration: boolean;
  /** In-app shortcut overrides keyed by command id; defaults live in the frontend. */
  shortcuts: Record<string, string>;
  profile: UserProfileSettings;
  /** Preferred provider per action kind ("default" today; per-action routing is future work). */
  preferredActions: Record<string, string>;
}

/** Local workspace identity — display only. No account, login, or subscription exists. */
export interface UserProfileSettings {
  displayName: string;
  avatarType: "emoji" | "preset";
  avatarValue: string;
  avatarBackground?: string | null;
  workspaceLabel: string;
}

/**
 * AI integration configs are persisted settings. External Agents have a real minimal ACP
 * foundation (stdio launch + initialize handshake); live state ("starting"/"connected"/"error")
 * is overlaid server-side on read and never persisted. MCP has no client yet, so MCP statuses
 * stay "not_implemented"/"not_configured" — discovered tools are never faked.
 */
export type IntegrationStatus = "not_configured" | "configured" | "starting" | "connected" | "ready" | "error" | "not_implemented";

export interface ExternalAgentConfig {
  id: string;
  name: string;
  protocol: "acp" | "custom";
  command?: string | null;
  args: string[];
  env: Record<string, string>;
  endpoint?: string | null;
  enabled: boolean;
  status: IntegrationStatus;
  capabilities: string[];
  lastError?: string | null;
}

export interface McpServerConfig {
  id: string;
  name: string;
  transport: "stdio" | "http" | "sse";
  command?: string | null;
  args: string[];
  url?: string | null;
  env: Record<string, string>;
  enabled: boolean;
  status: IntegrationStatus;
  tools: string[];
}

export interface AiIntegrationsConfig {
  externalAgents: ExternalAgentConfig[];
  mcpServers: McpServerConfig[];
}

export interface WorkshopPackSummary {
  id: string;
  name: string;
  version: string;
  author?: string | null;
  manifestPath: string;
  installedPath: string;
  enabled: boolean;
  contentTypes: string[];
  suggestedPermissions: string[];
  securityStatus: string;
  createdAt: string;
}

export interface ArtifactSummary {
  id: string;
  runId: string;
  projectId?: string | null;
  agentId?: string | null;
  actionId?: string | null;
  kind: string;
  title: string;
  summary: string;
  path: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export type ScheduleKind = "manual" | "interval";

export interface AutomationSummary {
  id: string;
  projectId?: string | null;
  name: string;
  task: string;
  permissionMode: PermissionMode;
  planFirst: boolean;
  enabled: boolean;
  scheduleKind: ScheduleKind;
  intervalMinutes?: number | null;
  createdAt: string;
  updatedAt: string;
  lastRunAt?: string | null;
}

export interface WorkspaceFile {
  name: string;
  path: string;
  type: "file" | "directory";
  size?: number | null;
}

export interface ProjectFilesResult {
  ok: boolean;
  summary: string;
  missingRequirement?: string | null;
  structuredOutput: { root?: string; items?: WorkspaceFile[] };
}

export type BehaviorMode = "professional" | "balanced" | "playful";
export type CameraMode = "rear" | "iso";

export type AgentStatus = "idle" | "working" | "waiting_approval" | "blocked" | "failed" | "done";
export type LifeAction =
  | "coffee_break"
  | "stretching"
  | "nap"
  | "walking_around"
  | "playing_phone"
  | "chatting_with_neighbor";

export interface LiveAgentState {
  id: string;
  name: string;
  role: string;
  status: AgentStatus;
  station: string;
  queueCount: number;
  fatigue: number;
  accent: string;
  behaviorMode: BehaviorMode;
  currentTask?: string | null;
  lifeAction?: LifeAction | null;
}

export interface AgentProfileSummary {
  id: string;
  name: string;
  role: string;
  prompt: string;
  personality: string;
  defaultTools: string[];
  defaultPermissions: string[];
  accent: string;
  behaviorMode: BehaviorMode;
  station: string;
  sound?: string | null;
  motionPack: string;
  taskPriority: number;
  createdAt: string;
  updatedAt: string;
}

export interface AgentInstanceSummary {
  id: string;
  profileId: string;
  projectId?: string | null;
  name: string;
  role: string;
  status: AgentStatus;
  currentTask?: string | null;
  queueCount: number;
  fatigue: number;
  behaviorMode: BehaviorMode;
  station: string;
  accent: string;
  availability: string;
  updatedAt: string;
}

export interface FurnitureItem {
  id: string;
  type: string;
  x: number;
  z: number;
}

export interface LiveOfficeStateSummary {
  id: string;
  projectId?: string | null;
  theme: string;
  behaviorMode: BehaviorMode;
  cameraMode: CameraMode;
  stationLayout: Record<string, number[]>;
  furniture: FurnitureItem[];
  updatedAt: string;
}
