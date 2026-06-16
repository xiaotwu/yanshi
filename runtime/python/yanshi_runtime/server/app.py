from __future__ import annotations

import argparse
import asyncio
import io
import json
import logging
import os
import queue
import re
import secrets
import shutil
import threading
import time
import zipfile
from datetime import UTC, datetime
from pathlib import Path
from uuid import uuid4

logger = logging.getLogger("yanshi")
import uvicorn
from fastapi import BackgroundTasks, Depends, FastAPI, File, HTTPException, Response, UploadFile, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from yanshi_runtime.acp import AcpManager
from yanshi_runtime.config import RuntimeSettings, settings_from_env
from yanshi_runtime.graph import RuntimeGraph
from yanshi_runtime.models import (
    AgentActor3DSummary,
    AgentInstanceSummary,
    AgentProfileSummary,
    AiIntegrationsConfig,
    AiIntegrationsUpdate,
    AppSettings,
    AppSettingsUpdate,
    ApprovalDecisionRequest,
    ApprovalSummary,
    AgentTaskSummary,
    ArtifactSummary,
    AutomationSummary,
    CreateAgentProfileRequest,
    CreateAutomationRequest,
    CreateProjectRequest,
    CreateRunRequest,
    LiveOfficeStateSummary,
    ProjectSummary,
    ProviderHealth,
    ProviderSettingsPublic,
    ProviderSettingsUpdate,
    RuntimeHealth,
    RuntimeStatus,
    UpdateAgentProfileRequest,
    UpdateAutomationRequest,
    UpdateLiveOfficeStateRequest,
    UpdateProjectRequest,
    WorkshopPackEnableRequest,
    WorkshopPackSummary,
)
from yanshi_runtime.providers import OpenAICompatibleProvider, ProviderConfig
from yanshi_runtime.storage import Storage
from yanshi_runtime.workshop import WorkshopPackValidator
from yanshi_runtime.workshop.packs import MAX_WORKSHOP_UPLOAD_BYTES, is_zip_symlink, safe_archive_path

UPLOAD_CHUNK_BYTES = 1024 * 1024
MAX_UPLOAD_FILE_BYTES = 50 * 1024 * 1024

# Image preview: serve the real bytes (browser-scaled in a constrained <img>) rather than bundling a
# resize library — honest preview, no extra native dependency. Bounded so a giant image can't be
# pulled wholesale into the webview; over the cap the frontend falls back to the file-type icon.
MAX_PREVIEW_BYTES = 12 * 1024 * 1024
# Raster types only. SVG is deliberately excluded: it's an active document that can carry script,
# and since the preview URL is directly openable (token in the query string), a malicious workspace
# SVG opened as a top-level document could run script in the runtime origin and read the token.
# The frontend falls back to the file-type icon when a preview isn't served.
_PREVIEW_MEDIA_TYPES = {
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".bmp": "image/bmp",
    ".ico": "image/x-icon",
    ".avif": "image/avif",
    ".heic": "image/heic",
}
# Defense in depth: prevent MIME sniffing and neutralize any script/active content if the response
# is ever loaded as a document rather than via <img>.
_PREVIEW_HEADERS = {
    "Cache-Control": "private, max-age=300",
    "X-Content-Type-Options": "nosniff",
    "Content-Security-Policy": "default-src 'none'; sandbox",
}


class RuntimeService:
    def __init__(self, settings: RuntimeSettings) -> None:
        self.settings = settings
        self.api_token = resolve_api_token(settings)
        self.storage = Storage(settings.database_path, settings.runtime_version)
        self._seed_provider_from_env()
        self.provider = OpenAICompatibleProvider(ProviderConfig.from_secret_settings(self.storage.get_provider_settings_secret()))
        self.graph = RuntimeGraph(
            storage=self.storage,
            checkpoint_path=settings.checkpoint_path,
            workspace_root=settings.workspace_root,
            provider=self.provider,
        )
        self.pack_validator = WorkshopPackValidator()
        self.acp = AcpManager()
        self.max_workshop_upload_bytes = MAX_WORKSHOP_UPLOAD_BYTES
        # Bounded run execution: a fixed pool of plain worker threads drains a queue. Plain threads
        # (not a ThreadPoolExecutor) are required — LangGraph's invoke() breaks when run inside a
        # pooled executor's worker context. The pool size caps concurrency; excess runs wait in the
        # queue as "created" until a worker frees up. Tests use synchronous_runs and skip the pool.
        self._shutting_down = False
        self._run_queue: "queue.Queue[tuple[str, str, str, bool, str] | None]" = queue.Queue()
        self._run_workers: list[threading.Thread] = []
        if not settings.synchronous_runs:
            for i in range(max(1, settings.max_concurrent_runs)):
                worker = threading.Thread(target=self._run_worker, name=f"yanshi-run-worker-{i}", daemon=True)
                worker.start()
                self._run_workers.append(worker)
        # Recover from a previous crash: any run left mid-flight is marked failed (no zombies).
        interrupted = self.storage.reconcile_interrupted_runs()
        if interrupted:
            logger.info("reconciled %d interrupted run(s) from a previous session", interrupted)
        # Keep the event log bounded across long-lived sessions.
        pruned = self.storage.prune_events()
        if pruned:
            logger.info("pruned %d old event(s)", pruned)
        self._seed_default_workspace()
        self.storage.append_event(
            "runtime.status.changed",
            payload={"status": "running", "databasePath": str(settings.database_path)},
        )

    def health(self) -> RuntimeHealth:
        return RuntimeHealth(ok=True, runtimeVersion=self.settings.runtime_version, databasePath=str(self.settings.database_path))

    def status(self) -> RuntimeStatus:
        missing: list[str] = []
        if not self.provider.configured:
            missing.append("model_provider")
        return RuntimeStatus(
            status="degraded" if missing else "running",
            details="Runtime is available. Some task execution requires additional configuration." if missing else "Runtime is ready.",
            missingRequirements=missing,
        )

    def create_run(self, request: CreateRunRequest, background_tasks: BackgroundTasks):
        if not request.task.strip():
            raise HTTPException(status_code=400, detail="Task is required.")
        try:
            run = self.storage.create_run(request.task.strip(), request.projectId, request.parentRunId)
        except KeyError as exc:
            raise HTTPException(status_code=404, detail="Project not found.") from exc
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        reasoning = request.reasoning or self.storage.get_app_settings().reasoning
        self.storage.append_event("run.created", run_id=run.id, project_id=run.projectId, payload=run.model_dump())
        self._dispatch_run(run.id, request.task.strip(), request.permissionMode, request.planFirst, reasoning)
        return run

    def _dispatch_run(self, run_id: str, task: str, permission_mode: str, plan_first: bool, reasoning: str = "medium") -> None:
        if self.settings.synchronous_runs:
            self.start_run(run_id, task, permission_mode, plan_first, reasoning)
            return
        self._run_queue.put((run_id, task, permission_mode, plan_first, reasoning))

    def _run_worker(self) -> None:
        """Worker loop: pull queued runs and execute them one at a time. A ``None`` item is the
        shutdown sentinel. Runs queued but not yet started at shutdown stay ``created`` and are
        reconciled to ``failed`` on the next launch."""
        while True:
            item = self._run_queue.get()
            try:
                if item is None:
                    return
                if self._shutting_down:
                    continue
                run_id, task, permission_mode, plan_first, reasoning = item
                self.start_run(run_id, task, permission_mode, plan_first, reasoning)
            finally:
                self._run_queue.task_done()

    def shutdown(self) -> None:
        """Stop accepting work and unblock the worker pool so threads exit cleanly."""
        self._shutting_down = True
        for _ in self._run_workers:
            self._run_queue.put(None)
        self.acp.shutdown()

    def start_run(self, run_id: str, task: str, permission_mode: str, plan_first: bool = False, reasoning: str = "medium") -> None:
        started = time.monotonic()
        logger.info("run %s started", run_id)
        try:
            self.graph.start(run_id, task, permission_mode, plan_first, reasoning)
            logger.info("run %s finished in %.1fs", run_id, time.monotonic() - started)
        except Exception:  # noqa: BLE001 — a crashing run must not silently kill the worker
            logger.exception("run %s crashed", run_id)
            try:
                self.storage.update_run(run_id, status="failed", result_summary="Run failed unexpectedly.", completed=True)
                self.storage.append_event("run.failed", run_id=run_id, payload={"summary": "Run failed unexpectedly."})
            except Exception:  # noqa: BLE001
                logger.exception("failed to mark run %s failed after crash", run_id)

    def list_project_files(self, project_id: str) -> dict:
        try:
            project = self.storage.get_project(project_id)
        except KeyError as exc:
            raise HTTPException(status_code=404, detail="Project not found.") from exc
        from yanshi_runtime.tools import FileTool

        result = FileTool(Path(project.workspacePath)).list_files(".")
        return result.model_dump()

    def list_artifacts(self, project_id: str | None, run_id: str | None) -> list[ArtifactSummary]:
        return self.storage.list_artifacts(project_id=project_id, run_id=run_id)

    def image_preview(self, project_id: str | None, path: str) -> "FileResponse":
        """Serve a workspace/artifact image for an inline preview. Guards against path traversal:
        the resolved file must live under *this* project's workspace (not the shared workspace root,
        which would let one project read another's files) or the artifacts root. Restricts to known
        image types and caps the size."""
        from fastapi.responses import FileResponse

        workspace = self._workspace_for_project(project_id)
        # Workspace listings hand back paths relative to the workspace; artifacts use absolute paths.
        candidate = (Path(path) if Path(path).is_absolute() else workspace / path).resolve()
        # Scoped to the specific project workspace + artifacts root only — no global workspace_root.
        allowed_roots = [
            workspace.resolve(),
            self.settings.artifacts_root.resolve(),
        ]
        if not any(candidate == root or root in candidate.parents for root in allowed_roots):
            raise HTTPException(status_code=403, detail="Preview path is outside the allowed roots.")
        if not candidate.is_file():
            raise HTTPException(status_code=404, detail="File not found.")
        media_type = _PREVIEW_MEDIA_TYPES.get(candidate.suffix.lower())
        if media_type is None:
            raise HTTPException(status_code=415, detail="Not a previewable image type.")
        if candidate.stat().st_size > MAX_PREVIEW_BYTES:
            raise HTTPException(status_code=413, detail="Image is too large to preview.")
        return FileResponse(candidate, media_type=media_type, headers=_PREVIEW_HEADERS)

    def _workspace_for_project(self, project_id: str | None) -> Path:
        if project_id is None:
            return self.settings.workspace_root / "default"
        try:
            return Path(self.storage.get_project(project_id).workspacePath)
        except KeyError as exc:
            raise HTTPException(status_code=404, detail="Project not found.") from exc

    async def save_uploads(self, project_id: str | None, files: list[UploadFile]) -> list[dict]:
        workspace = self._workspace_for_project(project_id)
        uploads_dir = workspace / "uploads"
        uploads_dir.mkdir(parents=True, exist_ok=True)
        saved: list[dict] = []
        for upload in files:
            name = safe_upload_basename(upload.filename)
            target = uploads_dir / name
            # Resolve and confirm the destination stays inside the uploads dir (path traversal guard).
            if uploads_dir.resolve() not in target.resolve().parents and target.resolve() != (uploads_dir / name).resolve():
                raise HTTPException(status_code=400, detail="Unsafe upload path.")
            # Refuse to write through a pre-planted symlink: reject an existing symlink and open with
            # O_NOFOLLOW so the write lands on a regular file inside uploads_dir, never elsewhere.
            if target.is_symlink():
                raise HTTPException(status_code=400, detail="Unsafe upload path.")
            total = 0
            flags = os.O_WRONLY | os.O_CREAT | os.O_TRUNC | getattr(os, "O_NOFOLLOW", 0)
            fd = os.open(target, flags, 0o600)
            with os.fdopen(fd, "wb") as handle:
                while True:
                    chunk = await upload.read(UPLOAD_CHUNK_BYTES)
                    if not chunk:
                        break
                    total += len(chunk)
                    if total > MAX_UPLOAD_FILE_BYTES:
                        handle.close()
                        target.unlink(missing_ok=True)
                        raise HTTPException(status_code=413, detail=f"Upload too large. Limit is {MAX_UPLOAD_FILE_BYTES} bytes.")
                    handle.write(chunk)
            saved.append({"name": name, "path": str(target.relative_to(workspace)), "size": total})
        return saved

    def create_automation(self, request: CreateAutomationRequest) -> AutomationSummary:
        name = request.name.strip()
        task = request.task.strip()
        if not name or not task:
            raise HTTPException(status_code=400, detail="Automation name and task are required.")
        if request.projectId is not None:
            try:
                self.storage.get_project(request.projectId)
            except KeyError as exc:
                raise HTTPException(status_code=404, detail="Project not found.") from exc
        if request.scheduleKind == "interval" and (request.intervalMinutes is None or request.intervalMinutes < 1):
            raise HTTPException(status_code=400, detail="Interval automations need intervalMinutes >= 1.")
        automation = self.storage.create_automation(
            name=name,
            task=task,
            project_id=request.projectId,
            permission_mode=request.permissionMode,
            plan_first=request.planFirst,
            schedule_kind=request.scheduleKind,
            interval_minutes=request.intervalMinutes,
        )
        self.storage.append_event("automation.created", project_id=automation.projectId, payload=automation.model_dump())
        return automation

    def update_automation(self, automation_id: str, request: UpdateAutomationRequest) -> AutomationSummary:
        try:
            automation = self.storage.update_automation(automation_id, enabled=request.enabled, name=request.name)
        except KeyError as exc:
            raise HTTPException(status_code=404, detail="Automation not found.") from exc
        self.storage.append_event("automation.updated", project_id=automation.projectId, payload=automation.model_dump())
        return automation

    def delete_automation(self, automation_id: str) -> None:
        try:
            self.storage.delete_automation(automation_id)
        except KeyError as exc:
            raise HTTPException(status_code=404, detail="Automation not found.") from exc
        self.storage.append_event("automation.deleted", payload={"automationId": automation_id})

    def run_automation(self, automation_id: str, background_tasks: BackgroundTasks | None) -> dict:
        try:
            automation = self.storage.get_automation(automation_id)
        except KeyError as exc:
            raise HTTPException(status_code=404, detail="Automation not found.") from exc
        return self._launch_automation(automation, background_tasks)

    def _launch_automation(self, automation: AutomationSummary, background_tasks: BackgroundTasks | None) -> dict:
        run = self.storage.create_run(automation.task, automation.projectId)
        self.storage.append_event("run.created", run_id=run.id, project_id=run.projectId, payload=run.model_dump())
        self.storage.record_automation_run(automation.id, run.id)
        self.storage.append_event(
            "automation.started",
            run_id=run.id,
            project_id=automation.projectId,
            payload={"automationId": automation.id, "name": automation.name, "runId": run.id},
        )
        if background_tasks is not None:
            self._dispatch_run(run.id, automation.task, automation.permissionMode, automation.planFirst)
        else:
            self.start_run(run.id, automation.task, automation.permissionMode, automation.planFirst)
        return run.model_dump()

    def run_due_automations(self, now: datetime) -> int:
        launched = 0
        for automation in self.storage.list_automations():
            if not is_automation_due(automation, now):
                continue
            # Don't stack runs: skip if the previous run is still in flight (e.g. it's taking longer
            # than the interval). It'll fire on a later tick once the current run finishes.
            if self.storage.automation_has_active_run(automation.id):
                logger.info("automation %s still has an active run; skipping this tick", automation.id)
                continue
            self._launch_automation(automation, background_tasks=None)
            launched += 1
        return launched

    def export_workshop_pack(self, project_id: str | None) -> bytes:
        """Build a real, re-importable .zip pack from current agent profiles + office theme."""
        profiles = self.storage.list_agent_profiles()
        office = self.storage.get_live_office_state(project_id)
        manifest = {
            "name": "Yanshi Team Export",
            "version": "1.0.0",
            "author": "Yanshi",
            "contentTypes": ["agents", "themes"],
            "suggestedPermissions": [],
        }
        buffer = io.BytesIO()
        with zipfile.ZipFile(buffer, "w", compression=zipfile.ZIP_DEFLATED) as archive:
            archive.writestr("manifest.json", json.dumps(manifest, indent=2))
            for profile in profiles:
                archive.writestr(f"agents/{profile.id}.json", json.dumps(profile.model_dump(), indent=2))
            archive.writestr("themes/office.json", json.dumps(office.model_dump(), indent=2))
        return buffer.getvalue()

    def decide_approval(self, approval_id: str, decision: str) -> ApprovalSummary:
        approval = self.storage.decide_approval(approval_id, decision)
        self.graph.resume(approval.runId, approved=decision == "approved")
        return approval

    def provider_settings(self) -> ProviderSettingsPublic:
        return self.storage.get_provider_settings_public()

    def update_provider_settings(self, request: ProviderSettingsUpdate) -> ProviderSettingsPublic:
        settings = self.storage.set_provider_settings(
            base_url=request.baseUrl,
            model=request.model,
            api_key=request.apiKey,
        )
        self.provider.update_config(ProviderConfig.from_secret_settings(self.storage.get_provider_settings_secret()))
        self.storage.append_event(
            "runtime.status.changed",
            payload={"status": "provider.updated", "baseUrl": settings.baseUrl, "model": settings.model},
        )
        return settings

    def provider_health(self) -> ProviderHealth:
        return self.provider.healthcheck()

    def app_settings(self) -> AppSettings:
        return self.storage.get_app_settings()

    def update_app_settings(self, request: AppSettingsUpdate) -> AppSettings:
        settings = self.storage.update_app_settings(request)
        self.storage.append_event(
            "runtime.status.changed",
            payload={"status": "settings.updated", "developerMode": settings.developerMode},
        )
        return settings

    def ai_integrations(self) -> AiIntegrationsConfig:
        return self._overlay_acp_state(self.storage.get_ai_integrations())

    def _overlay_acp_state(self, config: AiIntegrationsConfig) -> AiIntegrationsConfig:
        """Overlay live ACP connection state (never persisted) on the honest stored baseline."""
        for agent in config.externalAgents:
            live = self.acp.live_state(agent.id)
            if live is not None:
                agent.status = live.status
                agent.capabilities = list(live.capabilities)
                agent.lastError = live.error
        return config

    def connect_external_agent(self, agent_id: str) -> AiIntegrationsConfig:
        config = self.storage.get_ai_integrations()
        agent = next((item for item in config.externalAgents if item.id == agent_id), None)
        if agent is None:
            raise HTTPException(status_code=404, detail="External agent not found.")
        try:
            connection = self.acp.connect(agent)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        self.storage.append_event(
            "runtime.status.changed",
            payload={"status": "acp.connection", "agentId": agent_id, "result": connection.status},
        )
        return self._overlay_acp_state(config)

    def disconnect_external_agent(self, agent_id: str) -> AiIntegrationsConfig:
        self.acp.disconnect(agent_id)
        return self.ai_integrations()

    def update_ai_integrations(self, request: AiIntegrationsUpdate) -> AiIntegrationsConfig:
        # Drop live connections for agents that were removed or had their config replaced.
        if request.externalAgents is not None:
            kept = {agent.id for agent in request.externalAgents}
            for agent in self.storage.get_ai_integrations().externalAgents:
                if agent.id not in kept:
                    self.acp.disconnect(agent.id)
        config = self.storage.update_ai_integrations(request)
        self.storage.append_event(
            "runtime.status.changed",
            payload={
                "status": "integrations.updated",
                "externalAgents": len(config.externalAgents),
                "mcpServers": len(config.mcpServers),
            },
        )
        return self._overlay_acp_state(config)

    def create_project(self, request: CreateProjectRequest) -> ProjectSummary:
        name = request.name.strip()
        if not name:
            raise HTTPException(status_code=400, detail="Project name is required.")
        project = self.storage.create_project(name, description=request.description, workspace_root=self.settings.workspace_root)
        self.storage.ensure_agent_team(project.id)
        self.storage.append_event("project.created", project_id=project.id, payload=project.model_dump())
        return project

    def update_project(self, project_id: str, request: UpdateProjectRequest) -> ProjectSummary:
        try:
            project = self.storage.update_project(
                project_id,
                name=request.name.strip() if request.name is not None else None,
                description=request.description,
                settings=request.settings,
            )
        except KeyError as exc:
            raise HTTPException(status_code=404, detail="Project not found.") from exc
        self.storage.append_event("project.updated", project_id=project.id, payload=project.model_dump())
        return project

    def delete_project(self, project_id: str) -> None:
        try:
            self.storage.delete_project(project_id)
        except KeyError as exc:
            raise HTTPException(status_code=404, detail="Project not found.") from exc
        self.storage.append_event("project.deleted", project_id=project_id, payload={"projectId": project_id})

    def import_workshop_pack(self, pack_path: Path) -> WorkshopPackSummary:
        validation = self.pack_validator.validate_zip(pack_path)
        if not validation.ok:
            raise HTTPException(status_code=400, detail={"errors": validation.errors})
        if validation.name is None or validation.version is None:
            raise HTTPException(status_code=400, detail={"errors": ["Pack manifest is incomplete."]})

        installed_path = self.settings.packs_root / "installed" / self._pack_folder_name(validation.name, validation.version)
        if installed_path.exists():
            shutil.rmtree(installed_path)
        installed_path.mkdir(parents=True, exist_ok=True)
        self._extract_validated_pack(pack_path, installed_path)
        pack = self.storage.install_workshop_pack(
            name=validation.name,
            version=validation.version,
            author=validation.author,
            manifest_path=installed_path / "manifest.json",
            installed_path=installed_path,
            content_types=validation.contentTypes,
            suggested_permissions=validation.suggestedPermissions,
            security_status="validated",
        )
        self.storage.append_event("workshop.pack.imported", payload=pack.model_dump())
        return pack

    def set_workshop_pack_enabled(self, pack_id: str, enabled: bool) -> WorkshopPackSummary:
        try:
            pack = self.storage.set_workshop_pack_enabled(pack_id, enabled)
        except KeyError as exc:
            raise HTTPException(status_code=404, detail="Workshop pack not found.") from exc
        self.storage.append_event(
            "workshop.pack.enabled" if enabled else "workshop.pack.disabled",
            payload=pack.model_dump(),
        )
        return pack

    async def save_workshop_upload(self, pack: UploadFile) -> Path:
        incoming_root = self.settings.packs_root / "incoming"
        incoming_root.mkdir(parents=True, exist_ok=True)
        target = incoming_root / f"{uuid4().hex}-{safe_upload_basename(pack.filename)}"
        total_bytes = 0
        try:
            with target.open("wb") as handle:
                while True:
                    chunk = await pack.read(UPLOAD_CHUNK_BYTES)
                    if not chunk:
                        break
                    total_bytes += len(chunk)
                    if total_bytes > self.max_workshop_upload_bytes:
                        raise HTTPException(
                            status_code=413,
                            detail=f"Workshop pack upload is too large. Limit is {self.max_workshop_upload_bytes} bytes.",
                        )
                    handle.write(chunk)
        except Exception:
            target.unlink(missing_ok=True)
            raise

        if total_bytes == 0:
            target.unlink(missing_ok=True)
            raise HTTPException(status_code=400, detail="Workshop pack upload is empty.")
        return target

    def _seed_provider_from_env(self) -> None:
        if self.storage.get_provider_settings_secret():
            return
        if self.settings.model_provider and self.settings.model_api_key:
            self.storage.set_provider_settings(
                base_url=self.settings.model_provider,
                model="gpt-4o-mini",
                api_key=self.settings.model_api_key,
            )

    def _seed_default_workspace(self) -> None:
        """Drop a small welcome file into a fresh standalone workspace so first-run file tools
        (and the onboarding demo) return real content instead of an empty scan. Only seeds when
        the workspace has no files yet — never overwrites the user's work."""
        workspace = self.settings.workspace_root / "default"
        try:
            workspace.mkdir(parents=True, exist_ok=True)
            if any(workspace.iterdir()):
                return
            (workspace / "welcome.md").write_text(
                "# Welcome to your Yanshi workspace\n\n"
                "This is a sample file so the File tool has something real to read.\n"
                "Drop your own documents here, then ask Yanshi to summarize or scan them.\n",
                encoding="utf-8",
            )
            (workspace / "notes.txt").write_text(
                "todo: try asking Yanshi to list or summarize the files in this workspace\n",
                encoding="utf-8",
            )
        except OSError:
            # Seeding is a nicety, never fatal to startup.
            pass

    def _pack_folder_name(self, name: str, version: str) -> str:
        slug = re.sub(r"[^a-zA-Z0-9_.-]+", "-", f"{name}-{version}").strip("-").lower()
        return slug or "pack"

    def _extract_validated_pack(self, pack_path: Path, installed_path: Path) -> None:
        root = installed_path.resolve()
        with zipfile.ZipFile(pack_path) as archive:
            total_copied = 0
            for member in archive.infolist():
                relative_path = safe_archive_path(member.filename)
                if relative_path is None:
                    raise HTTPException(status_code=400, detail={"errors": [f"Unsafe path: {member.filename}"]})
                if is_zip_symlink(member):
                    raise HTTPException(status_code=400, detail={"errors": [f"Symbolic links are not allowed: {member.filename}"]})
                target = (root / relative_path).resolve()
                if target != root and root not in target.parents:
                    raise HTTPException(status_code=400, detail={"errors": [f"Unsafe path: {member.filename}"]})
                if member.is_dir():
                    target.mkdir(parents=True, exist_ok=True)
                    continue
                if member.file_size > self.pack_validator.max_member_bytes:
                    raise HTTPException(status_code=400, detail={"errors": [f"Pack member is too large: {member.filename}"]})
                target.parent.mkdir(parents=True, exist_ok=True)
                copied = 0
                with archive.open(member) as source, target.open("wb") as destination:
                    while True:
                        chunk = source.read(UPLOAD_CHUNK_BYTES)
                        if not chunk:
                            break
                        copied += len(chunk)
                        total_copied += len(chunk)
                        if copied > self.pack_validator.max_member_bytes:
                            target.unlink(missing_ok=True)
                            raise HTTPException(status_code=400, detail={"errors": [f"Pack member is too large: {member.filename}"]})
                        if total_copied > self.pack_validator.max_uncompressed_bytes:
                            target.unlink(missing_ok=True)
                            raise HTTPException(
                                status_code=400,
                                detail={"errors": ["Pack uncompressed size is too large."]},
                            )
                        destination.write(chunk)


def resolve_api_token(settings: RuntimeSettings) -> str:
    """Return the per-session API token: an explicit one from settings/env, otherwise a generated
    token persisted to <data_dir>/runtime.token (0600) so the trusted local shell can read it."""
    if settings.api_token:
        return settings.api_token
    path = settings.token_path
    # Only trust an existing token if it's a real file we own — not a symlink another local process
    # planted to redirect the read.
    try:
        if path.is_file() and not path.is_symlink():
            existing = path.read_text(encoding="utf-8").strip()
            if existing:
                return existing
    except OSError:
        pass
    token = secrets.token_urlsafe(32)
    try:
        # Drop any pre-existing symlink, then create without following symlinks (O_NOFOLLOW) at
        # 0600 so the write can't be redirected outside the data dir.
        if path.is_symlink():
            path.unlink()
        flags = os.O_WRONLY | os.O_CREAT | os.O_TRUNC | getattr(os, "O_NOFOLLOW", 0)
        fd = os.open(path, flags, 0o600)
        with os.fdopen(fd, "w", encoding="utf-8") as handle:
            handle.write(token)
        os.chmod(path, 0o600)
    except OSError:
        logger.warning("could not persist runtime token to %s", path)
    return token


def token_matches(candidate: str | None, token: str) -> bool:
    """Constant-time token comparison (avoids leaking the token via response timing)."""
    return bool(candidate) and secrets.compare_digest(candidate, token)


def get_service(app: FastAPI) -> RuntimeService:
    return app.state.runtime_service


def is_automation_due(automation: AutomationSummary, now: datetime) -> bool:
    if not automation.enabled or automation.scheduleKind != "interval" or not automation.intervalMinutes:
        return False
    if automation.lastRunAt is None:
        return True
    try:
        last = datetime.fromisoformat(automation.lastRunAt)
    except ValueError:
        return True
    return (now - last).total_seconds() >= automation.intervalMinutes * 60


def safe_upload_basename(filename: str | None) -> str:
    raw = (filename or "pack.zip").replace("\\", "/")
    basename = raw.rsplit("/", 1)[-1].strip()
    basename = re.sub(r"[^a-zA-Z0-9_.-]+", "-", basename).strip(".-")
    if not basename:
        return "pack.zip"
    if len(basename) > 120:
        stem = Path(basename).stem[:90].strip(".-") or "pack"
        suffix = Path(basename).suffix[:20]
        basename = f"{stem}{suffix}"
    return basename


def create_app(settings: RuntimeSettings | None = None) -> FastAPI:
    runtime_settings = settings or settings_from_env()
    runtime_settings.ensure_dirs()
    app = FastAPI(title="Yanshi Runtime", version=runtime_settings.runtime_version)
    cors_origins = ["tauri://localhost", "http://tauri.localhost"]
    if runtime_settings.extra_cors_origins:
        cors_origins += [o.strip() for o in runtime_settings.extra_cors_origins.split(",") if o.strip()]
    app.add_middleware(
        CORSMiddleware,
        allow_origins=cors_origins,
        # The Vite dev server runs on a localhost port; allow them. Cross-origin requests still need
        # the per-session token (enforced below), so an allowed origin alone grants nothing.
        allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1):\d+$",
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.state.runtime_service = RuntimeService(runtime_settings)

    # Require the per-session token on every request (except health + CORS preflight). This closes
    # the local-CSRF hole: a malicious web page can fire requests at localhost but doesn't know the
    # token, so they're rejected. The trusted shell reads the token from <data_dir>/runtime.token.
    _PUBLIC_PATHS = {"/health"}

    @app.middleware("http")
    async def require_token(request, call_next):
        if request.method == "OPTIONS" or request.url.path in _PUBLIC_PATHS:
            return await call_next(request)
        token = get_service(app).api_token
        auth = request.headers.get("authorization", "")
        bearer = auth[len("Bearer ") :] if auth.startswith("Bearer ") else ""
        # Header is the norm; the query param is the escape hatch for browser-initiated GET
        # downloads (window.open) and the WS, which can't attach an Authorization header.
        if not (
            token_matches(bearer, token)
            or token_matches(request.headers.get("x-yanshi-token"), token)
            or token_matches(request.query_params.get("token"), token)
        ):
            from fastapi.responses import JSONResponse

            return JSONResponse({"detail": "Unauthorized"}, status_code=401)
        return await call_next(request)

    @app.exception_handler(Exception)
    async def unhandled_error(request, exc):
        # Last-resort envelope for *unexpected* errors (HTTPException and validation errors keep
        # their own handlers). Logs the traceback server-side and returns a stable coded shape the
        # frontend's error system understands, instead of leaking internals.
        from fastapi.responses import JSONResponse

        logger.exception("unhandled error on %s %s", request.method, request.url.path)
        return JSONResponse(status_code=500, content={"detail": "Internal runtime error.", "code": "YANSHI_RUNTIME_500"})

    def service_dep() -> RuntimeService:
        return get_service(app)

    @app.on_event("shutdown")
    def shutdown_acp() -> None:
        # Stop the run worker pool and kill any launched ACP agent processes with the runtime.
        get_service(app).shutdown()

    @app.get("/health", response_model=RuntimeHealth)
    def health(service: RuntimeService = Depends(service_dep)):
        return service.health()

    @app.get("/runtime/status", response_model=RuntimeStatus)
    def runtime_status(service: RuntimeService = Depends(service_dep)):
        return service.status()

    @app.get("/settings/provider", response_model=ProviderSettingsPublic)
    def get_provider_settings(service: RuntimeService = Depends(service_dep)):
        return service.provider_settings()

    @app.put("/settings/provider", response_model=ProviderSettingsPublic)
    def put_provider_settings(request: ProviderSettingsUpdate, service: RuntimeService = Depends(service_dep)):
        return service.update_provider_settings(request)

    @app.post("/provider/health", response_model=ProviderHealth)
    def provider_health(service: RuntimeService = Depends(service_dep)):
        return service.provider_health()

    @app.get("/settings", response_model=AppSettings)
    def get_app_settings(service: RuntimeService = Depends(service_dep)):
        return service.app_settings()

    @app.put("/settings", response_model=AppSettings)
    def put_app_settings(request: AppSettingsUpdate, service: RuntimeService = Depends(service_dep)):
        return service.update_app_settings(request)

    @app.get("/settings/integrations", response_model=AiIntegrationsConfig)
    def get_ai_integrations(service: RuntimeService = Depends(service_dep)):
        return service.ai_integrations()

    @app.put("/settings/integrations", response_model=AiIntegrationsConfig)
    def put_ai_integrations(request: AiIntegrationsUpdate, service: RuntimeService = Depends(service_dep)):
        return service.update_ai_integrations(request)

    @app.post("/settings/integrations/agents/{agent_id}/connect", response_model=AiIntegrationsConfig)
    def connect_external_agent(agent_id: str, service: RuntimeService = Depends(service_dep)):
        return service.connect_external_agent(agent_id)

    @app.post("/settings/integrations/agents/{agent_id}/disconnect", response_model=AiIntegrationsConfig)
    def disconnect_external_agent(agent_id: str, service: RuntimeService = Depends(service_dep)):
        return service.disconnect_external_agent(agent_id)

    @app.post("/runs")
    def create_run(
        request: CreateRunRequest,
        background_tasks: BackgroundTasks,
        service: RuntimeService = Depends(service_dep),
    ):
        return service.create_run(request, background_tasks)

    @app.get("/runs")
    def list_runs(service: RuntimeService = Depends(service_dep), projectId: str | None = None):
        if projectId:
            return service.storage.list_runs_for_project(projectId)
        return service.storage.list_runs()

    @app.post("/projects", response_model=ProjectSummary)
    def create_project(request: CreateProjectRequest, service: RuntimeService = Depends(service_dep)):
        return service.create_project(request)

    @app.get("/projects", response_model=list[ProjectSummary])
    def list_projects(service: RuntimeService = Depends(service_dep)):
        return service.storage.list_projects()

    @app.get("/projects/{project_id}", response_model=ProjectSummary)
    def get_project(project_id: str, service: RuntimeService = Depends(service_dep)):
        try:
            return service.storage.get_project(project_id)
        except KeyError as exc:
            raise HTTPException(status_code=404, detail="Project not found.") from exc

    @app.get("/projects/{project_id}/files")
    def list_project_files(project_id: str, service: RuntimeService = Depends(service_dep)):
        return service.list_project_files(project_id)

    @app.post("/uploads")
    async def upload_files(
        projectId: str | None = None,
        files: list[UploadFile] = File(...),
        service: RuntimeService = Depends(service_dep),
    ):
        return {"files": await service.save_uploads(projectId, files)}

    @app.get("/artifacts", response_model=list[ArtifactSummary])
    def list_artifacts(
        projectId: str | None = None,
        runId: str | None = None,
        service: RuntimeService = Depends(service_dep),
    ):
        return service.list_artifacts(projectId, runId)

    @app.get("/preview")
    def image_preview(path: str, projectId: str | None = None, service: RuntimeService = Depends(service_dep)):
        return service.image_preview(projectId, path)

    @app.get("/automations", response_model=list[AutomationSummary])
    def list_automations(projectId: str | None = None, service: RuntimeService = Depends(service_dep)):
        return service.storage.list_automations(project_id=projectId)

    @app.post("/automations", response_model=AutomationSummary)
    def create_automation(request: CreateAutomationRequest, service: RuntimeService = Depends(service_dep)):
        return service.create_automation(request)

    @app.put("/automations/{automation_id}", response_model=AutomationSummary)
    def update_automation(automation_id: str, request: UpdateAutomationRequest, service: RuntimeService = Depends(service_dep)):
        return service.update_automation(automation_id, request)

    @app.delete("/automations/{automation_id}", status_code=204)
    def delete_automation(automation_id: str, service: RuntimeService = Depends(service_dep)):
        service.delete_automation(automation_id)
        return None

    @app.post("/automations/{automation_id}/run")
    def run_automation(automation_id: str, background_tasks: BackgroundTasks, service: RuntimeService = Depends(service_dep)):
        return service.run_automation(automation_id, background_tasks)

    @app.get("/automations/{automation_id}/runs")
    def list_automation_runs(automation_id: str, service: RuntimeService = Depends(service_dep)):
        try:
            service.storage.get_automation(automation_id)
        except KeyError as exc:
            raise HTTPException(status_code=404, detail="Automation not found.") from exc
        return service.storage.list_automation_runs(automation_id)

    @app.get("/agent-profiles", response_model=list[AgentProfileSummary])
    def list_agent_profiles(service: RuntimeService = Depends(service_dep)):
        return service.storage.list_agent_profiles()

    @app.post("/agent-profiles", response_model=AgentProfileSummary)
    def create_agent_profile(request: CreateAgentProfileRequest, service: RuntimeService = Depends(service_dep)):
        if not request.name.strip():
            raise HTTPException(status_code=400, detail="Agent name is required.")
        profile = service.storage.create_agent_profile(
            name=request.name.strip(),
            role=request.role,
            station=request.station,
            prompt=request.prompt,
            personality=request.personality,
            accent=request.accent,
            behavior_mode=request.behaviorMode,
            task_priority=request.taskPriority,
        )
        service.storage.append_event("agent.created", agent_id=profile.id, payload=profile.model_dump())
        return profile

    @app.put("/agent-profiles/{profile_id}", response_model=AgentProfileSummary)
    def update_agent_profile(profile_id: str, request: UpdateAgentProfileRequest, service: RuntimeService = Depends(service_dep)):
        try:
            profile = service.storage.update_agent_profile(profile_id, request.model_dump())
        except KeyError as exc:
            raise HTTPException(status_code=404, detail="Agent profile not found.") from exc
        service.storage.append_event("agent.updated", agent_id=profile.id, payload=profile.model_dump())
        return profile

    @app.delete("/agent-profiles/{profile_id}", status_code=204)
    def delete_agent_profile(profile_id: str, service: RuntimeService = Depends(service_dep)):
        try:
            service.storage.delete_agent_profile(profile_id)
        except KeyError as exc:
            raise HTTPException(status_code=404, detail="Agent profile not found.") from exc
        return None

    @app.get("/live-office", response_model=LiveOfficeStateSummary)
    def get_live_office(projectId: str | None = None, service: RuntimeService = Depends(service_dep)):
        return service.storage.get_live_office_state(projectId)

    @app.put("/live-office", response_model=LiveOfficeStateSummary)
    def update_live_office(request: UpdateLiveOfficeStateRequest, projectId: str | None = None, service: RuntimeService = Depends(service_dep)):
        return service.storage.upsert_live_office_state(projectId, request.model_dump())

    @app.get("/agent-instances", response_model=list[AgentInstanceSummary])
    def list_agent_instances(projectId: str | None = None, service: RuntimeService = Depends(service_dep)):
        return service.storage.ensure_agent_team(projectId)

    @app.get("/agent-actors", response_model=list[AgentActor3DSummary])
    def list_agent_actors(projectId: str | None = None, service: RuntimeService = Depends(service_dep)):
        service.storage.ensure_agent_team(projectId)
        return service.storage.list_agent_actors(projectId)

    @app.post("/workshop/export")
    def export_pack(projectId: str | None = None, service: RuntimeService = Depends(service_dep)):
        data = service.export_workshop_pack(projectId)
        return Response(
            content=data,
            media_type="application/zip",
            headers={"Content-Disposition": "attachment; filename=yanshi-team.zip"},
        )

    @app.put("/projects/{project_id}", response_model=ProjectSummary)
    def update_project(project_id: str, request: UpdateProjectRequest, service: RuntimeService = Depends(service_dep)):
        return service.update_project(project_id, request)

    @app.delete("/projects/{project_id}", status_code=204)
    def delete_project(project_id: str, service: RuntimeService = Depends(service_dep)):
        service.delete_project(project_id)
        return None

    @app.get("/runs/{run_id}")
    def get_run(run_id: str, service: RuntimeService = Depends(service_dep)):
        try:
            return service.storage.get_run(run_id)
        except KeyError as exc:
            raise HTTPException(status_code=404, detail="Run not found.") from exc

    @app.get("/events")
    def list_events(
        service: RuntimeService = Depends(service_dep),
        after: int = 0,
        runId: str | None = None,
    ):
        return [{"seq": seq, "event": event.model_dump()} for seq, event in service.storage.list_events(after_seq=after, run_id=runId)]

    @app.post("/runs/{run_id}/pause")
    def pause_run(run_id: str, service: RuntimeService = Depends(service_dep)):
        run = service.storage.update_run(run_id, status="paused")
        service.storage.append_event("run.paused", run_id=run_id, payload={"runId": run_id})
        return run

    @app.post("/runs/{run_id}/resume")
    def resume_run(run_id: str, service: RuntimeService = Depends(service_dep)):
        run = service.storage.update_run(run_id, status="running")
        service.storage.append_event("run.resumed", run_id=run_id, payload={"runId": run_id})
        return run

    @app.post("/runs/{run_id}/cancel")
    def cancel_run(run_id: str, service: RuntimeService = Depends(service_dep)):
        service.graph.request_cancel(run_id)
        run = service.storage.update_run(run_id, status="cancelled", completed=True, result_summary="Run cancelled.")
        service.storage.append_event("run.cancelled", run_id=run_id, payload={"runId": run_id})
        return run

    @app.get("/runs/{run_id}/partial")
    def run_partial(run_id: str, service: RuntimeService = Depends(service_dep)):
        # Streamed partial answer for an in-flight run: {text, done} or {text:"", done:true}
        # when nothing is buffered. Polled by the UI while a turn is generating.
        return service.graph.partial(run_id) or {"text": "", "done": True}

    @app.get("/approvals", response_model=list[ApprovalSummary])
    def list_approvals(service: RuntimeService = Depends(service_dep)):
        return service.storage.list_pending_approvals()

    @app.get("/agent-tasks", response_model=list[AgentTaskSummary])
    def list_agent_tasks(
        runId: str | None = None,
        projectId: str | None = None,
        agentId: str | None = None,
        service: RuntimeService = Depends(service_dep),
    ):
        return service.storage.list_agent_tasks(run_id=runId, project_id=projectId, agent_id=agentId)

    @app.post("/approvals/{approval_id}/decision", response_model=ApprovalSummary)
    def decide_approval(
        approval_id: str,
        request: ApprovalDecisionRequest,
        service: RuntimeService = Depends(service_dep),
    ):
        try:
            return service.decide_approval(approval_id, request.decision)
        except KeyError as exc:
            raise HTTPException(status_code=404, detail="Approval not found.") from exc

    @app.post("/workshop/validate")
    async def validate_pack(
        service: RuntimeService = Depends(service_dep),
        pack: UploadFile = File(...),
    ):
        target = await service.save_workshop_upload(pack)
        return service.pack_validator.validate_zip(target)

    @app.post("/workshop/import", response_model=WorkshopPackSummary)
    async def import_pack(
        service: RuntimeService = Depends(service_dep),
        pack: UploadFile = File(...),
    ):
        target = await service.save_workshop_upload(pack)
        return service.import_workshop_pack(target)

    @app.get("/workshop/packs", response_model=list[WorkshopPackSummary])
    def list_workshop_packs(service: RuntimeService = Depends(service_dep)):
        return service.storage.list_workshop_packs()

    @app.put("/workshop/packs/{pack_id}/enabled", response_model=WorkshopPackSummary)
    def set_workshop_pack_enabled(
        pack_id: str,
        request: WorkshopPackEnableRequest,
        service: RuntimeService = Depends(service_dep),
    ):
        return service.set_workshop_pack_enabled(pack_id, request.enabled)

    @app.websocket("/events")
    async def events_socket(websocket: WebSocket):
        service = get_service(app)
        # The WS can't carry an Authorization header from a browser, so the token rides as a query
        # param (or header for non-browser clients). Reject before accepting if it doesn't match.
        token = service.api_token
        provided = websocket.query_params.get("token") or websocket.headers.get("x-yanshi-token")
        if not token_matches(provided, token):
            await websocket.close(code=4401)
            return
        await websocket.accept()
        run_id = websocket.query_params.get("runId")
        after_seq = int(websocket.query_params.get("after", "0"))
        try:
            while True:
                events = service.storage.list_events(after_seq=after_seq, run_id=run_id)
                for seq, event in events:
                    after_seq = seq
                    await websocket.send_json({"seq": seq, "event": event.model_dump()})
                await asyncio.sleep(0.25)
        except asyncio.CancelledError:
            return
        except WebSocketDisconnect:
            return

    return app


def start_automation_scheduler(app: FastAPI, interval_seconds: int = 30) -> threading.Thread:
    """Run due interval automations on a background daemon thread (real sidecar only)."""

    def loop() -> None:
        while True:
            time.sleep(interval_seconds)
            try:
                get_service(app).run_due_automations(datetime.now(UTC))
            except Exception:  # noqa: BLE001 - scheduler must never crash the runtime
                logger.exception("automation scheduler tick failed")

    thread = threading.Thread(target=loop, name="yanshi-automation-scheduler", daemon=True)
    thread.start()
    return thread


def main() -> None:
    parser = argparse.ArgumentParser(description="Run the Yanshi Runtime sidecar.")
    parser.add_argument("--host", default=None)
    parser.add_argument("--port", type=int, default=None)
    parser.add_argument("--data-dir", default=None)
    parser.add_argument("--log-level", default="info")
    args = parser.parse_args()
    logging.basicConfig(
        level=getattr(logging, args.log_level.upper(), logging.INFO),
        format="%(asctime)s %(levelname)s %(name)s %(message)s",
    )
    settings = settings_from_env(args.data_dir)
    if args.host:
        settings.host = args.host
    if args.port:
        settings.port = args.port
    app = create_app(settings)
    start_automation_scheduler(app)
    uvicorn.run(app, host=settings.host, port=settings.port)


if __name__ == "__main__":
    main()
