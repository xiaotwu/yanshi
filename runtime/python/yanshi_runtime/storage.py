from __future__ import annotations

import json
import sqlite3
from functools import wraps
from pathlib import Path
from threading import RLock
from typing import Any

from .models import (
    AgentTaskSummary,
    AppSettings,
    AppSettingsUpdate,
    ApprovalSummary,
    ArtifactSummary,
    ProjectSummary,
    ProviderSettingsPublic,
    RuntimeEvent,
    RunSummary,
    WorkshopPackSummary,
    new_id,
    utc_now,
)


def locked_storage_method(method):
    @wraps(method)
    def wrapper(self, *args, **kwargs):
        with self._lock:
            return method(self, *args, **kwargs)

    return wrapper


class Storage:
    def __init__(self, database_path: Path, runtime_version: str) -> None:
        self.database_path = database_path
        self.runtime_version = runtime_version
        self._lock = RLock()
        self.database_path.parent.mkdir(parents=True, exist_ok=True)
        self.conn = sqlite3.connect(self.database_path, check_same_thread=False)
        self.conn.row_factory = sqlite3.Row
        self.conn.execute("PRAGMA journal_mode=WAL")
        self.conn.execute("PRAGMA foreign_keys=ON")
        self.migrate()

    def migrate(self) -> None:
        self.conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS runs (
              id TEXT PRIMARY KEY,
              project_id TEXT,
              standalone INTEGER NOT NULL,
              task TEXT NOT NULL,
              status TEXT NOT NULL,
              plan_json TEXT NOT NULL DEFAULT '[]',
              created_at TEXT NOT NULL,
              updated_at TEXT NOT NULL,
              completed_at TEXT,
              result_summary TEXT
            );

            CREATE TABLE IF NOT EXISTS projects (
              id TEXT PRIMARY KEY,
              name TEXT NOT NULL,
              description TEXT,
              workspace_path TEXT NOT NULL,
              agent_team_id TEXT,
              live_office_state_id TEXT,
              settings_json TEXT NOT NULL DEFAULT '{}',
              created_at TEXT NOT NULL,
              updated_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS events (
              seq INTEGER PRIMARY KEY AUTOINCREMENT,
              event_id TEXT NOT NULL UNIQUE,
              type TEXT NOT NULL,
              schema_version INTEGER NOT NULL,
              runtime_version TEXT NOT NULL,
              timestamp TEXT NOT NULL,
              project_id TEXT,
              run_id TEXT,
              agent_id TEXT,
              payload_json TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS approvals (
              id TEXT PRIMARY KEY,
              run_id TEXT NOT NULL,
              target_type TEXT NOT NULL,
              target_id TEXT NOT NULL,
              risk_level TEXT NOT NULL,
              status TEXT NOT NULL,
              request TEXT NOT NULL,
              created_at TEXT NOT NULL,
              decided_at TEXT,
              decision TEXT
            );

            CREATE TABLE IF NOT EXISTS actions (
              id TEXT PRIMARY KEY,
              run_id TEXT NOT NULL,
              agent_id TEXT,
              type TEXT NOT NULL,
              input_json TEXT NOT NULL,
              risk_level TEXT NOT NULL,
              status TEXT NOT NULL,
              created_at TEXT NOT NULL,
              completed_at TEXT
            );

            CREATE TABLE IF NOT EXISTS observations (
              id TEXT PRIMARY KEY,
              action_id TEXT,
              run_id TEXT NOT NULL,
              agent_id TEXT,
              type TEXT NOT NULL,
              summary TEXT NOT NULL,
              structured_output_json TEXT NOT NULL,
              error TEXT,
              created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS artifacts (
              id TEXT PRIMARY KEY,
              run_id TEXT NOT NULL,
              project_id TEXT,
              agent_id TEXT,
              action_id TEXT,
              kind TEXT NOT NULL,
              title TEXT NOT NULL,
              summary TEXT NOT NULL,
              path TEXT NOT NULL,
              metadata_json TEXT NOT NULL,
              created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS agent_tasks (
              id TEXT PRIMARY KEY,
              run_id TEXT NOT NULL,
              project_id TEXT,
              agent_id TEXT NOT NULL,
              task TEXT NOT NULL,
              status TEXT NOT NULL,
              queue_kind TEXT NOT NULL,
              metadata_json TEXT NOT NULL,
              created_at TEXT NOT NULL,
              started_at TEXT,
              completed_at TEXT
            );

            CREATE TABLE IF NOT EXISTS workshop_packs (
              id TEXT PRIMARY KEY,
              name TEXT NOT NULL,
              version TEXT NOT NULL,
              author TEXT,
              manifest_path TEXT NOT NULL,
              installed_path TEXT NOT NULL,
              enabled INTEGER NOT NULL,
              content_types_json TEXT NOT NULL,
              suggested_permissions_json TEXT NOT NULL,
              security_status TEXT NOT NULL,
              created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS settings (
              key TEXT PRIMARY KEY,
              value_json TEXT NOT NULL,
              updated_at TEXT NOT NULL
            );
            """
        )
        self.conn.commit()

    def create_project(self, name: str, *, description: str | None = None, workspace_root: Path) -> ProjectSummary:
        now = utc_now()
        project_id = new_id("proj")
        workspace_path = workspace_root / project_id
        workspace_path.mkdir(parents=True, exist_ok=True)
        self.conn.execute(
            """
            INSERT INTO projects (
              id, name, description, workspace_path, agent_team_id, live_office_state_id,
              settings_json, created_at, updated_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                project_id,
                name,
                description,
                str(workspace_path),
                f"team_{project_id}",
                f"office_{project_id}",
                "{}",
                now,
                now,
            ),
        )
        self.conn.commit()
        return self.get_project(project_id)

    def list_projects(self) -> list[ProjectSummary]:
        rows = self.conn.execute("SELECT * FROM projects ORDER BY updated_at DESC").fetchall()
        return [self._project_from_row(row) for row in rows]

    def get_project(self, project_id: str) -> ProjectSummary:
        row = self.conn.execute("SELECT * FROM projects WHERE id = ?", (project_id,)).fetchone()
        if row is None:
            raise KeyError(project_id)
        return self._project_from_row(row)

    def update_project(
        self,
        project_id: str,
        *,
        name: str | None = None,
        description: str | None = None,
        settings: dict[str, Any] | None = None,
    ) -> ProjectSummary:
        current = self.get_project(project_id)
        next_settings = settings if settings is not None else current.settings
        self.conn.execute(
            """
            UPDATE projects
            SET name = ?, description = ?, settings_json = ?, updated_at = ?
            WHERE id = ?
            """,
            (
                name if name is not None else current.name,
                description if description is not None else current.description,
                json.dumps(next_settings),
                utc_now(),
                project_id,
            ),
        )
        self.conn.commit()
        return self.get_project(project_id)

    def delete_project(self, project_id: str) -> None:
        self.get_project(project_id)
        self.conn.execute(
            "UPDATE runs SET project_id = NULL, standalone = 1, updated_at = ? WHERE project_id = ?",
            (utc_now(), project_id),
        )
        self.conn.execute("DELETE FROM projects WHERE id = ?", (project_id,))
        self.conn.commit()

    def create_run(self, task: str, project_id: str | None = None) -> RunSummary:
        if project_id:
            self.get_project(project_id)
        now = utc_now()
        run_id = new_id("run")
        self.conn.execute(
            """
            INSERT INTO runs (id, project_id, standalone, task, status, plan_json, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (run_id, project_id, 0 if project_id else 1, task, "created", "[]", now, now),
        )
        self.conn.commit()
        return self.get_run(run_id)

    def get_run(self, run_id: str) -> RunSummary:
        row = self.conn.execute("SELECT * FROM runs WHERE id = ?", (run_id,)).fetchone()
        if row is None:
            raise KeyError(run_id)
        return self._run_from_row(row)

    def list_runs(self) -> list[RunSummary]:
        rows = self.conn.execute("SELECT * FROM runs ORDER BY created_at DESC").fetchall()
        return [self._run_from_row(row) for row in rows]

    def list_runs_for_project(self, project_id: str) -> list[RunSummary]:
        rows = self.conn.execute(
            "SELECT * FROM runs WHERE project_id = ? ORDER BY created_at DESC",
            (project_id,),
        ).fetchall()
        return [self._run_from_row(row) for row in rows]

    def update_run(
        self,
        run_id: str,
        *,
        status: str | None = None,
        plan: list[str] | None = None,
        result_summary: str | None = None,
        completed: bool = False,
    ) -> RunSummary:
        current = self.get_run(run_id)
        next_status = status or current.status
        now = utc_now()
        self.conn.execute(
            """
            UPDATE runs
            SET status = ?, plan_json = ?, updated_at = ?, completed_at = COALESCE(?, completed_at),
                result_summary = COALESCE(?, result_summary)
            WHERE id = ?
            """,
            (
                next_status,
                json.dumps(plan if plan is not None else current.plan),
                now,
                now if completed else None,
                result_summary,
                run_id,
            ),
        )
        self.conn.commit()
        return self.get_run(run_id)

    def append_event(
        self,
        event_type: str,
        *,
        payload: dict[str, Any] | None = None,
        project_id: str | None = None,
        run_id: str | None = None,
        agent_id: str | None = None,
    ) -> RuntimeEvent:
        if project_id is None and run_id is not None:
            project_id = self._project_id_for_run(run_id)
        event = RuntimeEvent(
            type=event_type,
            sourceRuntimeVersion=self.runtime_version,
            projectId=project_id,
            runId=run_id,
            agentId=agent_id,
            payload=payload or {},
        )
        self.conn.execute(
            """
            INSERT INTO events (
              event_id, type, schema_version, runtime_version, timestamp,
              project_id, run_id, agent_id, payload_json
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                event.eventId,
                event.type,
                event.schemaVersion,
                event.sourceRuntimeVersion,
                event.timestamp,
                event.projectId,
                event.runId,
                event.agentId,
                json.dumps(event.payload),
            ),
        )
        self.conn.commit()
        return event

    def list_events(self, *, after_seq: int = 0, run_id: str | None = None) -> list[tuple[int, RuntimeEvent]]:
        params: list[Any] = [after_seq]
        where = "seq > ?"
        if run_id:
            where += " AND run_id = ?"
            params.append(run_id)
        rows = self.conn.execute(
            f"SELECT * FROM events WHERE {where} ORDER BY seq ASC LIMIT 100",
            params,
        ).fetchall()
        return [(row["seq"], self._event_from_row(row)) for row in rows]

    def create_action(self, run_id: str, action_type: str, risk_level: str, input_data: dict[str, Any], agent_id: str | None = None) -> str:
        action_id = new_id("act")
        now = utc_now()
        self.conn.execute(
            """
            INSERT INTO actions (id, run_id, agent_id, type, input_json, risk_level, status, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (action_id, run_id, agent_id, action_type, json.dumps(input_data), risk_level, "created", now),
        )
        self.conn.commit()
        self.append_event(
            "action.created",
            run_id=run_id,
            agent_id=agent_id,
            payload={"actionId": action_id, "type": action_type, "riskLevel": risk_level},
        )
        return action_id

    def complete_action(self, action_id: str, run_id: str, *, status: str = "completed", agent_id: str | None = None) -> None:
        self.conn.execute(
            "UPDATE actions SET status = ?, completed_at = ? WHERE id = ?",
            (status, utc_now(), action_id),
        )
        self.conn.commit()
        self.append_event(
            "action.completed" if status == "completed" else "action.failed",
            run_id=run_id,
            agent_id=agent_id,
            payload={"actionId": action_id},
        )

    def create_observation(
        self,
        run_id: str,
        observation_type: str,
        summary: str,
        *,
        action_id: str | None = None,
        agent_id: str | None = None,
        structured_output: dict[str, Any] | None = None,
        error: str | None = None,
    ) -> str:
        observation_id = new_id("obs")
        self.conn.execute(
            """
            INSERT INTO observations (
              id, action_id, run_id, agent_id, type, summary, structured_output_json, error, created_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                observation_id,
                action_id,
                run_id,
                agent_id,
                observation_type,
                summary,
                json.dumps(structured_output or {}),
                error,
                utc_now(),
            ),
        )
        self.conn.commit()
        self.append_event(
            "observation.created",
            run_id=run_id,
            agent_id=agent_id,
            payload={
                "observationId": observation_id,
                "actionId": action_id,
                "type": observation_type,
                "summary": summary,
                "error": error,
                "structuredOutput": structured_output or {},
            },
        )
        return observation_id

    def enqueue_agent_task(
        self,
        run_id: str,
        agent_id: str,
        task: str,
        *,
        queue_kind: str = "agent",
        metadata: dict[str, Any] | None = None,
    ) -> AgentTaskSummary:
        task_id = new_id("agtask")
        now = utc_now()
        project_id = self._project_id_for_run(run_id)
        self.conn.execute(
            """
            INSERT INTO agent_tasks (
              id, run_id, project_id, agent_id, task, status, queue_kind,
              metadata_json, created_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                task_id,
                run_id,
                project_id,
                agent_id,
                task,
                "queued",
                queue_kind,
                json.dumps(metadata or {}),
                now,
            ),
        )
        self.conn.commit()
        agent_task = self.get_agent_task(task_id)
        self.append_event(
            "agent.task.assigned",
            run_id=run_id,
            project_id=project_id,
            agent_id=agent_id,
            payload=agent_task.model_dump(),
        )
        return agent_task

    def get_agent_task(self, task_id: str) -> AgentTaskSummary:
        row = self.conn.execute("SELECT * FROM agent_tasks WHERE id = ?", (task_id,)).fetchone()
        if row is None:
            raise KeyError(task_id)
        return self._agent_task_from_row(row)

    def start_agent_task(self, task_id: str) -> AgentTaskSummary:
        current = self.get_agent_task(task_id)
        now = utc_now()
        self.conn.execute(
            "UPDATE agent_tasks SET status = ?, started_at = COALESCE(started_at, ?) WHERE id = ?",
            ("running", now, task_id),
        )
        self.conn.commit()
        agent_task = self.get_agent_task(task_id)
        self.append_event(
            "agent.task.started",
            run_id=agent_task.runId,
            project_id=agent_task.projectId,
            agent_id=agent_task.agentId,
            payload=agent_task.model_dump(),
        )
        return agent_task

    def complete_agent_task(
        self,
        task_id: str,
        *,
        status: str = "completed",
        result: dict[str, Any] | None = None,
    ) -> AgentTaskSummary:
        now = utc_now()
        self.conn.execute(
            "UPDATE agent_tasks SET status = ?, completed_at = ? WHERE id = ?",
            (status, now, task_id),
        )
        self.conn.commit()
        agent_task = self.get_agent_task(task_id)
        payload = agent_task.model_dump()
        if result:
            payload["result"] = result
        self.append_event(
            "agent.task.completed" if status == "completed" else "agent.task.failed",
            run_id=agent_task.runId,
            project_id=agent_task.projectId,
            agent_id=agent_task.agentId,
            payload=payload,
        )
        return agent_task

    def list_agent_tasks(
        self,
        *,
        run_id: str | None = None,
        project_id: str | None = None,
        agent_id: str | None = None,
    ) -> list[AgentTaskSummary]:
        clauses: list[str] = []
        params: list[Any] = []
        if run_id is not None:
            clauses.append("run_id = ?")
            params.append(run_id)
        if project_id is not None:
            clauses.append("project_id = ?")
            params.append(project_id)
        if agent_id is not None:
            clauses.append("agent_id = ?")
            params.append(agent_id)
        where = f"WHERE {' AND '.join(clauses)}" if clauses else ""
        rows = self.conn.execute(
            f"SELECT * FROM agent_tasks {where} ORDER BY created_at ASC",
            params,
        ).fetchall()
        return [self._agent_task_from_row(row) for row in rows]

    def create_approval(self, run_id: str, target_type: str, target_id: str, risk_level: str, request: str) -> ApprovalSummary:
        approval_id = new_id("appr")
        now = utc_now()
        self.conn.execute(
            """
            INSERT INTO approvals (id, run_id, target_type, target_id, risk_level, status, request, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (approval_id, run_id, target_type, target_id, risk_level, "pending", request, now),
        )
        self.conn.commit()
        approval = self.get_approval(approval_id)
        self.append_event(
            "approval.requested",
            run_id=run_id,
            payload=approval.model_dump(),
        )
        return approval

    def get_approval(self, approval_id: str) -> ApprovalSummary:
        row = self.conn.execute("SELECT * FROM approvals WHERE id = ?", (approval_id,)).fetchone()
        if row is None:
            raise KeyError(approval_id)
        return ApprovalSummary(
            id=row["id"],
            runId=row["run_id"],
            targetType=row["target_type"],
            targetId=row["target_id"],
            riskLevel=row["risk_level"],
            status=row["status"],
            request=row["request"],
            createdAt=row["created_at"],
        )

    def list_pending_approvals(self) -> list[ApprovalSummary]:
        rows = self.conn.execute(
            "SELECT * FROM approvals WHERE status = 'pending' ORDER BY created_at ASC"
        ).fetchall()
        return [self.get_approval(row["id"]) for row in rows]

    def decide_approval(self, approval_id: str, decision: str) -> ApprovalSummary:
        status = "approved" if decision == "approved" else "denied"
        self.conn.execute(
            "UPDATE approvals SET status = ?, decision = ?, decided_at = ? WHERE id = ?",
            (status, decision, utc_now(), approval_id),
        )
        self.conn.commit()
        approval = self.get_approval(approval_id)
        self.append_event(
            "approval.approved" if status == "approved" else "approval.denied",
            run_id=approval.runId,
            payload=approval.model_dump(),
        )
        return approval

    def create_artifact(
        self,
        run_id: str,
        kind: str,
        title: str,
        summary: str,
        path: str,
        *,
        project_id: str | None = None,
        agent_id: str | None = None,
        action_id: str | None = None,
        metadata: dict[str, Any] | None = None,
    ) -> ArtifactSummary:
        artifact_id = new_id("art")
        now = utc_now()
        self.conn.execute(
            """
            INSERT INTO artifacts (
              id, run_id, project_id, agent_id, action_id, kind, title, summary, path, metadata_json, created_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                artifact_id,
                run_id,
                project_id,
                agent_id,
                action_id,
                kind,
                title,
                summary,
                path,
                json.dumps(metadata or {}),
                now,
            ),
        )
        self.conn.commit()
        artifact = ArtifactSummary(
            id=artifact_id,
            runId=run_id,
            projectId=project_id,
            agentId=agent_id,
            actionId=action_id,
            kind=kind,
            title=title,
            summary=summary,
            path=path,
            metadata=metadata or {},
            createdAt=now,
        )
        self.append_event("artifact.created", run_id=run_id, agent_id=agent_id, payload=artifact.model_dump())
        return artifact

    def install_workshop_pack(
        self,
        *,
        name: str,
        version: str,
        author: str | None,
        manifest_path: Path,
        installed_path: Path,
        content_types: list[str],
        suggested_permissions: list[str],
        security_status: str = "validated",
    ) -> WorkshopPackSummary:
        pack_id = new_id("pack")
        now = utc_now()
        self.conn.execute(
            """
            INSERT INTO workshop_packs (
              id, name, version, author, manifest_path, installed_path, enabled,
              content_types_json, suggested_permissions_json, security_status, created_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                pack_id,
                name,
                version,
                author,
                str(manifest_path),
                str(installed_path),
                0,
                json.dumps(content_types),
                json.dumps(suggested_permissions),
                security_status,
                now,
            ),
        )
        self.conn.commit()
        return self.get_workshop_pack(pack_id)

    def list_workshop_packs(self) -> list[WorkshopPackSummary]:
        rows = self.conn.execute("SELECT * FROM workshop_packs ORDER BY created_at DESC").fetchall()
        return [self._workshop_pack_from_row(row) for row in rows]

    def get_workshop_pack(self, pack_id: str) -> WorkshopPackSummary:
        row = self.conn.execute("SELECT * FROM workshop_packs WHERE id = ?", (pack_id,)).fetchone()
        if row is None:
            raise KeyError(pack_id)
        return self._workshop_pack_from_row(row)

    def set_workshop_pack_enabled(self, pack_id: str, enabled: bool) -> WorkshopPackSummary:
        self.get_workshop_pack(pack_id)
        self.conn.execute(
            "UPDATE workshop_packs SET enabled = ? WHERE id = ?",
            (1 if enabled else 0, pack_id),
        )
        self.conn.commit()
        return self.get_workshop_pack(pack_id)

    def set_setting(self, key: str, value: dict[str, Any]) -> None:
        self.conn.execute(
            """
            INSERT INTO settings (key, value_json, updated_at)
            VALUES (?, ?, ?)
            ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json, updated_at = excluded.updated_at
            """,
            (key, json.dumps(value), utc_now()),
        )
        self.conn.commit()

    def get_setting(self, key: str) -> dict[str, Any] | None:
        row = self.conn.execute("SELECT value_json FROM settings WHERE key = ?", (key,)).fetchone()
        if row is None:
            return None
        return json.loads(row["value_json"] or "{}")

    def set_provider_settings(self, *, base_url: str, model: str, api_key: str | None) -> ProviderSettingsPublic:
        existing = self.get_setting("provider") or {}
        next_value = {
            "baseUrl": base_url.rstrip("/"),
            "model": model,
            "apiKey": api_key if api_key is not None else existing.get("apiKey"),
        }
        self.set_setting("provider", next_value)
        return self.get_provider_settings_public()

    def get_provider_settings_secret(self) -> dict[str, Any] | None:
        value = self.get_setting("provider")
        if value and value.get("baseUrl") and value.get("model") and value.get("apiKey"):
            return value
        return None

    def get_provider_settings_public(self) -> ProviderSettingsPublic:
        value = self.get_setting("provider") or {}
        return ProviderSettingsPublic(
            baseUrl=value.get("baseUrl") or "https://api.openai.com/v1",
            model=value.get("model"),
            apiKeyConfigured=bool(value.get("apiKey")),
        )

    def get_app_settings(self) -> AppSettings:
        value = self.get_setting("app") or {}
        return AppSettings(**value)

    def update_app_settings(self, update: AppSettingsUpdate) -> AppSettings:
        current = self.get_app_settings()
        patch = update.model_dump(exclude_none=True)
        next_settings = current.model_copy(update=patch)
        self.set_setting("app", next_settings.model_dump())
        return next_settings

    def _run_from_row(self, row: sqlite3.Row) -> RunSummary:
        return RunSummary(
            id=row["id"],
            projectId=row["project_id"],
            standalone=bool(row["standalone"]),
            task=row["task"],
            status=row["status"],
            plan=json.loads(row["plan_json"] or "[]"),
            createdAt=row["created_at"],
            updatedAt=row["updated_at"],
            completedAt=row["completed_at"],
            resultSummary=row["result_summary"],
        )

    def _project_from_row(self, row: sqlite3.Row) -> ProjectSummary:
        return ProjectSummary(
            id=row["id"],
            name=row["name"],
            description=row["description"],
            workspacePath=row["workspace_path"],
            agentTeamId=row["agent_team_id"],
            liveOfficeStateId=row["live_office_state_id"],
            settings=json.loads(row["settings_json"] or "{}"),
            createdAt=row["created_at"],
            updatedAt=row["updated_at"],
        )

    def _workshop_pack_from_row(self, row: sqlite3.Row) -> WorkshopPackSummary:
        return WorkshopPackSummary(
            id=row["id"],
            name=row["name"],
            version=row["version"],
            author=row["author"],
            manifestPath=row["manifest_path"],
            installedPath=row["installed_path"],
            enabled=bool(row["enabled"]),
            contentTypes=json.loads(row["content_types_json"] or "[]"),
            suggestedPermissions=json.loads(row["suggested_permissions_json"] or "[]"),
            securityStatus=row["security_status"],
            createdAt=row["created_at"],
        )

    def _agent_task_from_row(self, row: sqlite3.Row) -> AgentTaskSummary:
        return AgentTaskSummary(
            id=row["id"],
            runId=row["run_id"],
            projectId=row["project_id"],
            agentId=row["agent_id"],
            task=row["task"],
            status=row["status"],
            queueKind=row["queue_kind"],
            metadata=json.loads(row["metadata_json"] or "{}"),
            createdAt=row["created_at"],
            startedAt=row["started_at"],
            completedAt=row["completed_at"],
        )

    def _project_id_for_run(self, run_id: str) -> str | None:
        row = self.conn.execute("SELECT project_id FROM runs WHERE id = ?", (run_id,)).fetchone()
        return row["project_id"] if row is not None else None

    def _event_from_row(self, row: sqlite3.Row) -> RuntimeEvent:
        return RuntimeEvent(
            eventId=row["event_id"],
            type=row["type"],
            schemaVersion=row["schema_version"],
            sourceRuntimeVersion=row["runtime_version"],
            timestamp=row["timestamp"],
            projectId=row["project_id"],
            runId=row["run_id"],
            agentId=row["agent_id"],
            payload=json.loads(row["payload_json"] or "{}"),
        )


for _storage_method_name in [
    "migrate",
    "create_project",
    "list_projects",
    "get_project",
    "update_project",
    "delete_project",
    "create_run",
    "get_run",
    "list_runs",
    "list_runs_for_project",
    "update_run",
    "append_event",
    "list_events",
    "create_action",
    "complete_action",
    "create_observation",
    "enqueue_agent_task",
    "get_agent_task",
    "start_agent_task",
    "complete_agent_task",
    "list_agent_tasks",
    "create_approval",
    "get_approval",
    "list_pending_approvals",
    "decide_approval",
    "create_artifact",
    "install_workshop_pack",
    "list_workshop_packs",
    "get_workshop_pack",
    "set_workshop_pack_enabled",
    "set_setting",
    "get_setting",
    "set_provider_settings",
    "get_provider_settings_secret",
    "get_provider_settings_public",
    "get_app_settings",
    "update_app_settings",
    "_project_id_for_run",
]:
    setattr(Storage, _storage_method_name, locked_storage_method(getattr(Storage, _storage_method_name)))
