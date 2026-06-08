from __future__ import annotations

from datetime import UTC, datetime
from typing import Any, Literal
from uuid import uuid4

from pydantic import BaseModel, Field

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


class CreateRunRequest(BaseModel):
    task: str
    projectId: str | None = None
    permissionMode: PermissionMode = "default"


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


class AppSettings(BaseModel):
    permissionModeDefault: PermissionMode = "default"
    developerMode: bool = False
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


class AppSettingsUpdate(BaseModel):
    permissionModeDefault: PermissionMode | None = None
    developerMode: bool | None = None
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
