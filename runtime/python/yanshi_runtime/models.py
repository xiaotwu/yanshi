from __future__ import annotations

from datetime import UTC, datetime
from typing import Any, Literal
from uuid import uuid4

from pydantic import BaseModel, Field, field_validator

EVENT_SCHEMA_VERSION = 1


def utc_now() -> str:
    return datetime.now(UTC).isoformat()


def new_id(prefix: str) -> str:
    return f"{prefix}_{uuid4().hex[:18]}"


RiskLevel = Literal["low", "medium", "high", "critical"]
PermissionMode = Literal["default", "auto_review", "full_access"]
RunStatus = Literal["created", "running", "pending_approval", "paused", "completed", "failed", "cancelled"]
ApprovalStatus = Literal["pending", "approved", "denied", "expired"]
AgentTaskStatus = Literal["queued", "running", "completed", "failed", "cancelled"]


class RuntimeEvent(BaseModel):
    eventId: str = Field(default_factory=lambda: new_id("evt"))
    type: str
    schemaVersion: int = EVENT_SCHEMA_VERSION
    sourceRuntimeVersion: str
    timestamp: str = Field(default_factory=utc_now)
    projectId: str | None = None
    runId: str | None = None
    agentId: str | None = None
    payload: dict[str, Any] = Field(default_factory=dict)


class RunSummary(BaseModel):
    id: str
    projectId: str | None = None
    standalone: bool = True
    task: str
    status: RunStatus
    plan: list[str] = Field(default_factory=list)
    createdAt: str
    updatedAt: str
    completedAt: str | None = None
    resultSummary: str | None = None
    # Conversation threading: runs that belong to the same chat share a threadId. A run with
    # no follow-ups simply has threadId == id. parentRunId points at the immediately preceding
    # turn (None for the first message of a chat).
    threadId: str | None = None
    parentRunId: str | None = None


ReasoningLevel = Literal["low", "medium", "high", "extra_high"]


class CreateRunRequest(BaseModel):
    # Bound the task length so a single request can't bloat the prompt/DB (basic DoS guard).
    task: str = Field(..., max_length=16000)
    projectId: str | None = None
    permissionMode: PermissionMode = "default"
    planFirst: bool = False
    reasoning: ReasoningLevel | None = None
    # When set, this run is a follow-up turn in the same chat as parentRunId.
    parentRunId: str | None = None


class ProjectSummary(BaseModel):
    id: str
    name: str
    description: str | None = None
    workspacePath: str
    agentTeamId: str | None = None
    liveOfficeStateId: str | None = None
    settings: dict[str, Any] = Field(default_factory=dict)
    createdAt: str
    updatedAt: str


class CreateProjectRequest(BaseModel):
    name: str
    description: str | None = None


class UpdateProjectRequest(BaseModel):
    name: str | None = None
    description: str | None = None
    settings: dict[str, Any] | None = None


class ApprovalSummary(BaseModel):
    id: str
    runId: str
    targetType: Literal["tool_call", "action", "run", "session_grant"]
    targetId: str
    riskLevel: RiskLevel
    status: ApprovalStatus
    request: str
    createdAt: str


class ApprovalDecisionRequest(BaseModel):
    decision: Literal["approved", "denied"]

    @field_validator("decision", mode="before")
    @classmethod
    def _normalize_decision(cls, value: object) -> object:
        # Accept the intuitive aliases `approve`/`deny` in addition to the canonical forms.
        if isinstance(value, str):
            alias = {"approve": "approved", "deny": "denied"}
            return alias.get(value.strip().lower(), value)
        return value


class ArtifactSummary(BaseModel):
    id: str
    runId: str
    projectId: str | None = None
    agentId: str | None = None
    actionId: str | None = None
    kind: str
    title: str
    summary: str
    path: str
    metadata: dict[str, Any] = Field(default_factory=dict)
    createdAt: str


class AgentTaskSummary(BaseModel):
    id: str
    runId: str
    projectId: str | None = None
    agentId: str
    task: str
    status: AgentTaskStatus
    queueKind: str
    metadata: dict[str, Any] = Field(default_factory=dict)
    createdAt: str
    startedAt: str | None = None
    completedAt: str | None = None


BehaviorMode = Literal["professional", "balanced", "playful"]
CameraMode = Literal["rear", "iso"]


class AgentProfileSummary(BaseModel):
    id: str
    name: str
    role: str
    prompt: str = ""
    personality: str = ""
    defaultTools: list[str] = Field(default_factory=list)
    defaultPermissions: list[str] = Field(default_factory=list)
    accent: str = "#277f71"
    behaviorMode: BehaviorMode = "balanced"
    station: str
    sound: str | None = None
    motionPack: str = "default"
    taskPriority: int = 5
    createdAt: str
    updatedAt: str


class UpdateAgentProfileRequest(BaseModel):
    name: str | None = None
    prompt: str | None = None
    personality: str | None = None
    accent: str | None = None
    behaviorMode: BehaviorMode | None = None
    station: str | None = None
    taskPriority: int | None = None


class CreateAgentProfileRequest(BaseModel):
    name: str
    role: str = "custom"
    station: str = "manager"
    prompt: str = ""
    personality: str = ""
    accent: str = "#277f71"
    behaviorMode: BehaviorMode = "balanced"
    taskPriority: int = 5


class FurnitureItem(BaseModel):
    id: str
    type: str  # desk, plant, shelf, couch, table, lamp, divider
    x: float = 0.0
    z: float = 0.0


class LiveOfficeStateSummary(BaseModel):
    id: str
    projectId: str | None = None
    theme: str = "warm-light"
    behaviorMode: BehaviorMode = "balanced"
    cameraMode: CameraMode = "rear"
    stationLayout: dict[str, list[float]] = Field(default_factory=dict)
    furniture: list[FurnitureItem] = Field(default_factory=list)
    updatedAt: str


class UpdateLiveOfficeStateRequest(BaseModel):
    theme: str | None = None
    behaviorMode: BehaviorMode | None = None
    cameraMode: CameraMode | None = None
    stationLayout: dict[str, list[float]] | None = None
    furniture: list[FurnitureItem] | None = None


class AgentInstanceSummary(BaseModel):
    id: str
    profileId: str
    projectId: str | None = None
    name: str
    role: str
    status: str = "idle"
    currentTask: str | None = None
    queueCount: int = 0
    fatigue: float = 0.0
    behaviorMode: BehaviorMode = "balanced"
    station: str
    accent: str
    availability: str = "available"
    updatedAt: str


class AgentActor3DSummary(BaseModel):
    id: str
    instanceId: str
    profileId: str
    projectId: str | None = None
    x: float = 0.0
    z: float = 0.0
    station: str
    animation: str = "idle"
    expression: str = "neutral"
    motionState: str = "still"
    updatedAt: str


ScheduleKind = Literal["manual", "interval"]


class AutomationSummary(BaseModel):
    id: str
    projectId: str | None = None
    name: str
    task: str
    permissionMode: PermissionMode = "default"
    planFirst: bool = False
    enabled: bool = True
    scheduleKind: ScheduleKind = "manual"
    intervalMinutes: int | None = None
    createdAt: str
    updatedAt: str
    lastRunAt: str | None = None


class CreateAutomationRequest(BaseModel):
    name: str
    task: str
    projectId: str | None = None
    permissionMode: PermissionMode = "default"
    planFirst: bool = False
    scheduleKind: ScheduleKind = "manual"
    intervalMinutes: int | None = None


class UpdateAutomationRequest(BaseModel):
    enabled: bool | None = None
    name: str | None = None


class WorkshopPackSummary(BaseModel):
    id: str
    name: str
    version: str
    author: str | None = None
    manifestPath: str
    installedPath: str
    enabled: bool
    contentTypes: list[str] = Field(default_factory=list)
    suggestedPermissions: list[str] = Field(default_factory=list)
    securityStatus: str
    createdAt: str


class WorkshopPackEnableRequest(BaseModel):
    enabled: bool


class RuntimeHealth(BaseModel):
    ok: bool
    runtimeVersion: str
    databasePath: str


class RuntimeStatus(BaseModel):
    status: Literal["starting", "running", "degraded", "failed"]
    details: str
    missingRequirements: list[str] = Field(default_factory=list)


class ToolResult(BaseModel):
    ok: bool
    summary: str
    structuredOutput: dict[str, Any] = Field(default_factory=dict)
    missingRequirement: str | None = None


class ProviderSettingsUpdate(BaseModel):
    baseUrl: str = "https://api.openai.com/v1"
    model: str
    apiKey: str | None = None


class ProviderSettingsPublic(BaseModel):
    baseUrl: str = "https://api.openai.com/v1"
    model: str | None = None
    apiKeyConfigured: bool = False


class ProviderHealth(BaseModel):
    ok: bool
    status: Literal["not_configured", "healthy", "failed"]
    detail: str
    baseUrl: str | None = None
    model: str | None = None


class ChatMessage(BaseModel):
    role: Literal["system", "user", "assistant"]
    content: str


class UserProfileSettings(BaseModel):
    """Local workspace identity — display only. No account, login, or subscription exists."""

    displayName: str = ""
    avatarType: Literal["emoji", "preset"] = "preset"
    avatarValue: str = ""
    avatarBackground: str | None = None
    workspaceLabel: str = ""


class AppSettings(BaseModel):
    permissionModeDefault: PermissionMode = "default"
    developerMode: bool = False
    onboarded: bool = False
    theme: Literal["light", "dark", "system"] = "system"
    language: Literal["system", "en-US", "zh-CN"] = "system"
    reasoning: ReasoningLevel = "medium"
    liveOfficeAutoOpen: bool = True
    liveOfficeDefaultOpen: bool = False
    browserToolEnabled: bool = True
    computerToolEnabled: bool = True
    terminalToolEnabled: bool = False
    notificationsEnabled: bool = True
    openYanshiShortcut: str = "Cmd+Y"
    dockerImage: str = "alpine:3.20"
    dockerMemory: str = "512m"
    dockerCpus: str = "1"
    dockerPidsLimit: int = 128
    gpuAcceleration: bool = True
    # In-app shortcut overrides keyed by command id; defaults live in the frontend.
    shortcuts: dict[str, str] = Field(default_factory=dict)
    profile: UserProfileSettings = Field(default_factory=UserProfileSettings)
    # Preferred provider per action kind ("default" today; per-action routing is future work).
    preferredActions: dict[str, str] = Field(default_factory=dict)


class AppSettingsUpdate(BaseModel):
    permissionModeDefault: PermissionMode | None = None
    developerMode: bool | None = None
    onboarded: bool | None = None
    theme: Literal["light", "dark", "system"] | None = None
    language: Literal["system", "en-US", "zh-CN"] | None = None
    reasoning: ReasoningLevel | None = None
    liveOfficeAutoOpen: bool | None = None
    liveOfficeDefaultOpen: bool | None = None
    browserToolEnabled: bool | None = None
    computerToolEnabled: bool | None = None
    terminalToolEnabled: bool | None = None
    notificationsEnabled: bool | None = None
    openYanshiShortcut: str | None = None
    dockerImage: str | None = None
    dockerMemory: str | None = None
    dockerCpus: str | None = None
    dockerPidsLimit: int | None = None
    gpuAcceleration: bool | None = None
    shortcuts: dict[str, str] | None = None
    profile: UserProfileSettings | None = None
    preferredActions: dict[str, str] | None = None


# --- AI Integrations (External Agents / MCP servers) -------------------------------------------
#
# These are persisted *configuration* records. External Agents now have a real minimal ACP
# foundation (stdio launch + initialize handshake — see acp.py); live connection state is overlaid
# on read by the service. MCP still has no client, so MCP statuses stay honest on read: configs
# with connection details report "not_implemented", incomplete configs "not_configured".
# Statuses are never persisted as connected; "ready" is never produced.

IntegrationStatus = Literal[
    "not_configured", "configured", "starting", "connected", "ready", "error", "not_implemented"
]


class ExternalAgentConfig(BaseModel):
    id: str
    name: str
    protocol: Literal["acp", "custom"] = "acp"
    command: str | None = None
    args: list[str] = Field(default_factory=list)
    env: dict[str, str] = Field(default_factory=dict)
    endpoint: str | None = None
    enabled: bool = False
    status: IntegrationStatus = "not_configured"
    capabilities: list[str] = Field(default_factory=list)
    lastError: str | None = None


class McpServerConfig(BaseModel):
    id: str
    name: str
    transport: Literal["stdio", "http", "sse"] = "stdio"
    command: str | None = None
    args: list[str] = Field(default_factory=list)
    url: str | None = None
    env: dict[str, str] = Field(default_factory=dict)
    enabled: bool = False
    status: IntegrationStatus = "not_configured"
    tools: list[str] = Field(default_factory=list)


class AiIntegrationsConfig(BaseModel):
    externalAgents: list[ExternalAgentConfig] = Field(default_factory=list)
    mcpServers: list[McpServerConfig] = Field(default_factory=list)


class AiIntegrationsUpdate(BaseModel):
    externalAgents: list[ExternalAgentConfig] | None = None
    mcpServers: list[McpServerConfig] | None = None
