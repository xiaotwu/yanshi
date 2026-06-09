from __future__ import annotations

import argparse
import asyncio
import re
import shutil
import threading
import time
import zipfile
from datetime import UTC, datetime
from pathlib import Path
from uuid import uuid4
import uvicorn
from fastapi import BackgroundTasks, Depends, FastAPI, File, HTTPException, UploadFile, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from yanshi_runtime.config import RuntimeSettings, settings_from_env
from yanshi_runtime.graph import RuntimeGraph
from yanshi_runtime.models import (
    AppSettings,
    AppSettingsUpdate,
    ApprovalDecisionRequest,
    ApprovalSummary,
    AgentTaskSummary,
    ArtifactSummary,
    AutomationSummary,
    CreateAutomationRequest,
    CreateProjectRequest,
    CreateRunRequest,
    ProjectSummary,
    ProviderHealth,
    ProviderSettingsPublic,
    ProviderSettingsUpdate,
    RuntimeHealth,
    RuntimeStatus,
    UpdateAutomationRequest,
    UpdateProjectRequest,
    WorkshopPackEnableRequest,
    WorkshopPackSummary,
)
from yanshi_runtime.providers import OpenAICompatibleProvider, ProviderConfig
from yanshi_runtime.storage import Storage
from yanshi_runtime.workshop import WorkshopPackValidator
from yanshi_runtime.workshop.packs import MAX_WORKSHOP_UPLOAD_BYTES, is_zip_symlink, safe_archive_path

UPLOAD_CHUNK_BYTES = 1024 * 1024


class RuntimeService:
    def __init__(self, settings: RuntimeSettings) -> None:
        self.settings = settings
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
        self.max_workshop_upload_bytes = MAX_WORKSHOP_UPLOAD_BYTES
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
            run = self.storage.create_run(request.task.strip(), request.projectId)
        except KeyError as exc:
            raise HTTPException(status_code=404, detail="Project not found.") from exc
        self.storage.append_event("run.created", run_id=run.id, project_id=run.projectId, payload=run.model_dump())
        background_tasks.add_task(self.start_run, run.id, request.task.strip(), request.permissionMode, request.planFirst)
        return run

    def start_run(self, run_id: str, task: str, permission_mode: str, plan_first: bool = False) -> None:
        self.graph.start(run_id, task, permission_mode, plan_first)

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
            background_tasks.add_task(self.start_run, run.id, automation.task, automation.permissionMode, automation.planFirst)
        else:
            self.start_run(run.id, automation.task, automation.permissionMode, automation.planFirst)
        return run.model_dump()

    def run_due_automations(self, now: datetime) -> int:
        launched = 0
        for automation in self.storage.list_automations():
            if is_automation_due(automation, now):
                self._launch_automation(automation, background_tasks=None)
                launched += 1
        return launched

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

    def create_project(self, request: CreateProjectRequest) -> ProjectSummary:
        name = request.name.strip()
        if not name:
            raise HTTPException(status_code=400, detail="Project name is required.")
        project = self.storage.create_project(name, description=request.description, workspace_root=self.settings.workspace_root)
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
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["tauri://localhost", "http://tauri.localhost"],
        allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1):\d+$",
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.state.runtime_service = RuntimeService(runtime_settings)

    def service_dep() -> RuntimeService:
        return get_service(app)

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

    @app.get("/artifacts", response_model=list[ArtifactSummary])
    def list_artifacts(
        projectId: str | None = None,
        runId: str | None = None,
        service: RuntimeService = Depends(service_dep),
    ):
        return service.list_artifacts(projectId, runId)

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
        run = service.storage.update_run(run_id, status="cancelled", completed=True, result_summary="Run cancelled.")
        service.storage.append_event("run.cancelled", run_id=run_id, payload={"runId": run_id})
        return run

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
        await websocket.accept()
        service = get_service(app)
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
                continue

    thread = threading.Thread(target=loop, name="yanshi-automation-scheduler", daemon=True)
    thread.start()
    return thread


def main() -> None:
    parser = argparse.ArgumentParser(description="Run the Yanshi Runtime sidecar.")
    parser.add_argument("--host", default=None)
    parser.add_argument("--port", type=int, default=None)
    parser.add_argument("--data-dir", default=None)
    args = parser.parse_args()
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
