from __future__ import annotations

import json
import sqlite3
from functools import wraps
from pathlib import Path
from threading import RLock
from typing import Any, Callable

from .agents.profiles import DEFAULT_AGENT_PROFILES
from .models import (
    AgentActor3DSummary,
    AgentInstanceSummary,
    AgentProfileSummary,
    AgentTaskSummary,
    AiIntegrationsConfig,
    AiIntegrationsUpdate,
    AppSettings,
    AppSettingsUpdate,
    ApprovalSummary,
    ArtifactSummary,
    AutomationSummary,
    LiveOfficeStateSummary,
    ProjectSummary,
    ProviderSettingsPublic,
    RuntimeEvent,
    RunSummary,
    WorkshopPackSummary,
    new_id,
    utc_now,
)
from .secrets import SecretStore, default_secret_store

PROVIDER_API_KEY_SECRET = "provider_api_key"

# Integration (ACP/MCP) env values are secrets: they're stored in the SecretStore (off-DB) as refs
# and never returned raw by the API. A non-empty value reads back as this sentinel so the UI can
# show "set" without seeing it; sending the sentinel back on save preserves the stored secret.
_INTEGRATION_SECRET_SENTINEL = "__YANSHI_SECRET_SET__"


def _is_secret_ref(value: str) -> bool:
    return value.startswith(("file:", "keychain:"))

# Default station floor positions (x, z), mirrored by the Live Office 3D scene.
DEFAULT_STATION_POSITIONS: dict[str, tuple[float, float]] = {
    "manager": (-2.4, -0.6),
    "browser": (-0.9, -1.3),
    "computer": (0.9, -1.3),
    "file": (2.4, -0.6),
    "reviewer": (0.0, 1.0),
    "terminal": (2.2, 1.2),
}


def _station_position(station: str, layout: dict[str, list[float]]) -> tuple[float, float]:
    override = layout.get(station)
    if isinstance(override, list) and len(override) >= 2:
        return float(override[0]), float(override[1])
    return DEFAULT_STATION_POSITIONS.get(station, (0.0, 0.0))


def _actor_visuals(station: str, status: str) -> tuple[str, str, str]:
    """Map an agent status to (animation, expression, motionState) for the 3D actor."""
    if status == "working":
        animation = {
            "browser": "using_browser",
            "computer": "using_computer",
            "file": "organizing_files",
            "reviewer": "reviewing",
            "terminal": "typing",
            "manager": "thinking",
        }.get(station, "typing")
        return animation, "focused", "active"
    if status == "waiting_approval":
        return "waiting_approval", "expectant", "still"
    if status in {"blocked", "failed"}:
        return status, "concerned", "still"
    if status == "done":
        return "celebrating", "pleased", "settling"
    return "idle", "neutral", "still"


def locked_storage_method(method):
    @wraps(method)
    def wrapper(self, *args, **kwargs):
        with self._lock:
            return method(self, *args, **kwargs)

    return wrapper


def _with_honest_integration_statuses(config: AiIntegrationsConfig) -> AiIntegrationsConfig:
    """Recompute persisted integration statuses from what the runtime can actually do.

    External Agents have a real minimal ACP foundation (stdio launch + initialize handshake, see
    acp.py). Live connection state is overlaid by the service on read and never persisted, so the
    stored baseline is: ACP agents with a launch command are "configured" (saved, connectable);
    endpoint-only or custom-protocol entries are "not_implemented" (no client for those paths);
    entries missing details are "not_configured". Capabilities are cleared at rest — only a live
    handshake may report them. MCP still has no client: complete entries stay "not_implemented",
    discovered tools are never faked.
    """
    for agent in config.externalAgents:
        if agent.protocol == "acp" and agent.command:
            agent.status = "configured"
        elif agent.command or agent.endpoint:
            agent.status = "not_implemented"
        else:
            agent.status = "not_configured"
        agent.capabilities = []
        agent.lastError = None
    for server in config.mcpServers:
        connectable = server.command if server.transport == "stdio" else server.url
        server.status = "not_implemented" if connectable else "not_configured"
        server.tools = []
    return config


# Schema version tracked via SQLite's built-in `PRAGMA user_version`. Bump this and register a step
# in `_run_migrations` whenever the schema changes in a way the declarative `CREATE TABLE IF NOT
# EXISTS` block can't express (column drops/renames, backfills, data reshapes). The current
# declarative schema is the v3 baseline; v1→v2 column addition (project_id) and v2→v3 column
# additions (model, reasoning) are handled idempotently by their respective migration methods.
_SCHEMA_VERSION = 3

# Once a run reaches one of these it is finished; its status must not change again.
_TERMINAL_RUN_STATUSES = frozenset({"completed", "failed", "cancelled"})


class Storage:
    def __init__(
        self,
        database_path: Path,
        runtime_version: str,
        secret_store: SecretStore | None = None,
    ) -> None:
        self.database_path = database_path
        self.runtime_version = runtime_version
        self.secret_store = secret_store or default_secret_store(database_path.parent)
        self._lock = RLock()
        self.database_path.parent.mkdir(parents=True, exist_ok=True)
        self.conn = sqlite3.connect(self.database_path, check_same_thread=False)
        self.conn.row_factory = sqlite3.Row
        self.conn.execute("PRAGMA journal_mode=WAL")
        self.conn.execute("PRAGMA foreign_keys=ON")
        self.migrate()
        self._migrate_provider_api_key()

    @locked_storage_method
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

            -- Conversation threading. Kept in a side table so it works on existing databases
            -- without altering the runs schema. A run absent from this table is its own thread.
            CREATE TABLE IF NOT EXISTS run_threads (
              run_id TEXT PRIMARY KEY,
              thread_id TEXT NOT NULL,
              parent_run_id TEXT
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

            CREATE TABLE IF NOT EXISTS automations (
              id TEXT PRIMARY KEY,
              project_id TEXT,
              name TEXT NOT NULL,
              task TEXT NOT NULL,
              permission_mode TEXT NOT NULL,
              plan_first INTEGER NOT NULL DEFAULT 0,
              enabled INTEGER NOT NULL DEFAULT 1,
              schedule_kind TEXT NOT NULL DEFAULT 'manual',
              interval_minutes INTEGER,
              created_at TEXT NOT NULL,
              updated_at TEXT NOT NULL,
              last_run_at TEXT
            );

            CREATE TABLE IF NOT EXISTS automation_runs (
              automation_id TEXT NOT NULL,
              run_id TEXT NOT NULL,
              created_at TEXT NOT NULL,
              PRIMARY KEY (automation_id, run_id)
            );

            CREATE TABLE IF NOT EXISTS agent_profiles (
              id TEXT PRIMARY KEY,
              name TEXT NOT NULL,
              role TEXT NOT NULL,
              prompt TEXT NOT NULL DEFAULT '',
              personality TEXT NOT NULL DEFAULT '',
              default_tools_json TEXT NOT NULL DEFAULT '[]',
              default_permissions_json TEXT NOT NULL DEFAULT '[]',
              accent TEXT NOT NULL DEFAULT '#277f71',
              behavior_mode TEXT NOT NULL DEFAULT 'balanced',
              station TEXT NOT NULL,
              sound TEXT,
              motion_pack TEXT NOT NULL DEFAULT 'default',
              task_priority INTEGER NOT NULL DEFAULT 5,
              project_id TEXT,
              model TEXT,
              reasoning TEXT,
              created_at TEXT NOT NULL,
              updated_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS live_office_state (
              id TEXT PRIMARY KEY,
              project_id TEXT UNIQUE,
              theme TEXT NOT NULL DEFAULT 'warm-light',
              behavior_mode TEXT NOT NULL DEFAULT 'balanced',
              camera_mode TEXT NOT NULL DEFAULT 'rear',
              station_layout_json TEXT NOT NULL DEFAULT '{}',
              furniture_json TEXT NOT NULL DEFAULT '[]',
              updated_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS agent_instances (
              id TEXT PRIMARY KEY,
              profile_id TEXT NOT NULL,
              project_id TEXT,
              status TEXT NOT NULL DEFAULT 'idle',
              current_task TEXT,
              queue_count INTEGER NOT NULL DEFAULT 0,
              fatigue REAL NOT NULL DEFAULT 0,
              behavior_mode TEXT NOT NULL DEFAULT 'balanced',
              station TEXT NOT NULL,
              accent TEXT NOT NULL DEFAULT '#1faa6a',
              availability TEXT NOT NULL DEFAULT 'available',
              updated_at TEXT NOT NULL,
              UNIQUE (profile_id, project_id)
            );

            CREATE TABLE IF NOT EXISTS agent_actor3d (
              id TEXT PRIMARY KEY,
              instance_id TEXT NOT NULL UNIQUE,
              profile_id TEXT NOT NULL,
              project_id TEXT,
              x REAL NOT NULL DEFAULT 0,
              z REAL NOT NULL DEFAULT 0,
              station TEXT NOT NULL,
              animation TEXT NOT NULL DEFAULT 'idle',
              expression TEXT NOT NULL DEFAULT 'neutral',
              motion_state TEXT NOT NULL DEFAULT 'still',
              updated_at TEXT NOT NULL
            );

            -- Hot-path lookups are filtered by run_id (events stream, transcripts, queues) — index
            -- them so queries stay fast as the tables grow.
            CREATE INDEX IF NOT EXISTS idx_events_run_seq ON events(run_id, seq);
            CREATE INDEX IF NOT EXISTS idx_actions_run ON actions(run_id);
            CREATE INDEX IF NOT EXISTS idx_observations_run ON observations(run_id);
            CREATE INDEX IF NOT EXISTS idx_artifacts_run ON artifacts(run_id);
            CREATE INDEX IF NOT EXISTS idx_agent_tasks_run ON agent_tasks(run_id);
            CREATE INDEX IF NOT EXISTS idx_run_threads_thread ON run_threads(thread_id);
            CREATE INDEX IF NOT EXISTS idx_runs_project ON runs(project_id);
            """
        )
        self.conn.commit()
        self._add_missing_columns()
        self._run_migrations()
        self._seed_agent_profiles()

    @locked_storage_method
    def prune_events(self, max_events: int = 20000) -> int:
        """Keep the event log bounded: drop the oldest events beyond a cap. Safe because clients
        read forward by monotonic seq and never need very old events. Returns rows deleted."""
        row = self.conn.execute("SELECT COUNT(*) AS n FROM events").fetchone()
        total = int(row["n"]) if row else 0
        if total <= max_events:
            return 0
        cutoff = self.conn.execute(
            "SELECT seq FROM events ORDER BY seq DESC LIMIT 1 OFFSET ?",
            (max_events - 1,),
        ).fetchone()
        if cutoff is None:
            return 0
        cursor = self.conn.execute("DELETE FROM events WHERE seq < ?", (cutoff["seq"],))
        self.conn.commit()
        return cursor.rowcount

    @locked_storage_method
    def _add_missing_columns(self) -> None:
        """Idempotent column additions for tables that existed before a field was introduced."""
        existing = {row["name"] for row in self.conn.execute("PRAGMA table_info(live_office_state)").fetchall()}
        if "furniture_json" not in existing:
            self.conn.execute("ALTER TABLE live_office_state ADD COLUMN furniture_json TEXT NOT NULL DEFAULT '[]'")
            self.conn.commit()

    @locked_storage_method
    def _migrate_add_agent_profile_project_id(self) -> None:
        """v2: agent profiles become project-scoped. Idempotent — a fresh db already has the
        column from the declarative schema, so guard before ALTER."""
        existing = {row["name"] for row in self.conn.execute("PRAGMA table_info(agent_profiles)").fetchall()}
        if "project_id" not in existing:
            self.conn.execute("ALTER TABLE agent_profiles ADD COLUMN project_id TEXT")

    @locked_storage_method
    def _migrate_add_agent_profile_model_reasoning(self) -> None:
        """v3: each 偃师 gains nullable model and reasoning overrides. Idempotent — a fresh db
        already has both columns from the declarative schema, so guard before each ALTER."""
        existing = {row["name"] for row in self.conn.execute("PRAGMA table_info(agent_profiles)").fetchall()}
        if "model" not in existing:
            self.conn.execute("ALTER TABLE agent_profiles ADD COLUMN model TEXT")
        if "reasoning" not in existing:
            self.conn.execute("ALTER TABLE agent_profiles ADD COLUMN reasoning TEXT")

    @locked_storage_method
    def schema_version(self) -> int:
        return int(self.conn.execute("PRAGMA user_version").fetchone()[0])

    @locked_storage_method
    def _run_migrations(self) -> None:
        """Apply ordered schema migrations exactly once each, gated by `PRAGMA user_version`.

        Each step is keyed by the version it upgrades *to* and runs only when the db is below that
        version. A fresh or pre-versioning db (user_version 0) is brought to the v1 baseline without
        running step bodies — the declarative CREATE TABLE IF NOT EXISTS schema already built it.
        Register future steps here, e.g. ``2: self._migrate_to_v2``.
        """
        current = int(self.conn.execute("PRAGMA user_version").fetchone()[0])
        if current >= _SCHEMA_VERSION:
            return
        migrations: dict[int, Callable[[], None]] = {
            2: self._migrate_add_agent_profile_project_id,
            3: self._migrate_add_agent_profile_model_reasoning,
        }
        for version in range(current + 1, _SCHEMA_VERSION + 1):
            step = migrations.get(version)
            # Each step + its version bump is one transaction: on failure it rolls back together, so
            # the schema is never left half-migrated. (`PRAGMA user_version` is journaled with the
            # transaction.) Steps must still be written idempotently in case of a crash mid-commit.
            with self.conn:
                if step is not None:
                    step()
                # PRAGMA can't bind params; version is an int we control, so the f-string is safe.
                self.conn.execute(f"PRAGMA user_version = {version}")

    @locked_storage_method
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

    @locked_storage_method
    def list_projects(self) -> list[ProjectSummary]:
        rows = self.conn.execute("SELECT * FROM projects ORDER BY updated_at DESC").fetchall()
        return [self._project_from_row(row) for row in rows]

    @locked_storage_method
    def get_project(self, project_id: str) -> ProjectSummary:
        row = self.conn.execute("SELECT * FROM projects WHERE id = ?", (project_id,)).fetchone()
        if row is None:
            raise KeyError(project_id)
        return self._project_from_row(row)

    @locked_storage_method
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

    @locked_storage_method
    def delete_project(self, project_id: str) -> None:
        self.get_project(project_id)
        self.conn.execute(
            "UPDATE runs SET project_id = NULL, standalone = 1, updated_at = ? WHERE project_id = ?",
            (utc_now(), project_id),
        )
        self.conn.execute("DELETE FROM projects WHERE id = ?", (project_id,))
        self.conn.commit()

    @locked_storage_method
    def create_run(self, task: str, project_id: str | None = None, parent_run_id: str | None = None) -> RunSummary:
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
        # Record conversation threading: a follow-up inherits its parent's thread; the first
        # turn of a chat seeds a thread keyed by its own id. The parent must exist (and, when this
        # run belongs to a project, share it) — otherwise _thread_for would silently graft the run
        # onto a fabricated parent id and create an orphan thread.
        if parent_run_id:
            try:
                parent = self.get_run(parent_run_id)
            except KeyError as exc:
                raise ValueError(f"Parent run {parent_run_id} does not exist.") from exc
            if project_id and parent.projectId not in (None, project_id):
                raise ValueError("Parent run belongs to a different project.")
            parent_thread, _ = self._thread_for(parent_run_id)
            self.conn.execute(
                "INSERT OR REPLACE INTO run_threads (run_id, thread_id, parent_run_id) VALUES (?, ?, ?)",
                (run_id, parent_thread, parent_run_id),
            )
        self.conn.commit()
        return self.get_run(run_id)

    @locked_storage_method
    def reconcile_interrupted_runs(self) -> int:
        """Mark runs left in a non-terminal state (a previous process crashed/was killed mid-run)
        as failed, so the UI never shows a permanently-stuck "running" run. Returns the count."""
        now = utc_now()
        cursor = self.conn.execute(
            """
            UPDATE runs SET status = 'failed', completed_at = ?, updated_at = ?,
              result_summary = COALESCE(result_summary, 'Run interrupted by a runtime restart.')
            WHERE status IN ('created', 'running', 'pending_approval', 'paused')
            """,
            (now, now),
        )
        self.conn.commit()
        return cursor.rowcount

    @locked_storage_method
    def _thread_for(self, run_id: str) -> tuple[str, str | None]:
        """Return (thread_id, parent_run_id) for a run; a run with no thread row is its own thread."""
        row = self.conn.execute(
            "SELECT thread_id, parent_run_id FROM run_threads WHERE run_id = ?",
            (run_id,),
        ).fetchone()
        if row is None:
            return run_id, None
        return row["thread_id"], row["parent_run_id"]

    @locked_storage_method
    def thread_history(self, run_id: str) -> list[RunSummary]:
        """Prior completed turns in this run's chat thread, oldest first (excludes this run)."""
        thread_id, _ = self._thread_for(run_id)
        rows = self.conn.execute(
            """
            SELECT r.* FROM runs r
            LEFT JOIN run_threads t ON t.run_id = r.id
            WHERE COALESCE(t.thread_id, r.id) = ? AND r.id != ? AND r.status = 'completed'
            ORDER BY r.created_at ASC
            """,
            (thread_id, run_id),
        ).fetchall()
        return [self._run_from_row(row) for row in rows]

    @locked_storage_method
    def get_run(self, run_id: str) -> RunSummary:
        row = self.conn.execute("SELECT * FROM runs WHERE id = ?", (run_id,)).fetchone()
        if row is None:
            raise KeyError(run_id)
        return self._run_from_row(row)

    @locked_storage_method
    def list_runs(self) -> list[RunSummary]:
        rows = self.conn.execute("SELECT * FROM runs ORDER BY created_at DESC").fetchall()
        return [self._run_from_row(row) for row in rows]

    @locked_storage_method
    def list_runs_for_project(self, project_id: str) -> list[RunSummary]:
        rows = self.conn.execute(
            "SELECT * FROM runs WHERE project_id = ? ORDER BY created_at DESC",
            (project_id,),
        ).fetchall()
        return [self._run_from_row(row) for row in rows]

    @locked_storage_method
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
        # Terminal states are frozen: once a run is completed/failed/cancelled, nothing may move it
        # back to running/paused/etc. (e.g. a finalizer finishing after the user already cancelled).
        # Status is pinned to the existing terminal value; summary/plan may still be recorded.
        if current.status in _TERMINAL_RUN_STATUSES and next_status != current.status:
            next_status = current.status
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

    @locked_storage_method
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

    @locked_storage_method
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

    @locked_storage_method
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
            payload={"actionId": action_id, "type": action_type, "riskLevel": risk_level, "input": input_data},
        )
        return action_id

    @locked_storage_method
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

    @locked_storage_method
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

    @locked_storage_method
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

    @locked_storage_method
    def get_agent_task(self, task_id: str) -> AgentTaskSummary:
        row = self.conn.execute("SELECT * FROM agent_tasks WHERE id = ?", (task_id,)).fetchone()
        if row is None:
            raise KeyError(task_id)
        return self._agent_task_from_row(row)

    @locked_storage_method
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

    @locked_storage_method
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

    @locked_storage_method
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

    @locked_storage_method
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

    @locked_storage_method
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

    @locked_storage_method
    def list_pending_approvals(self) -> list[ApprovalSummary]:
        rows = self.conn.execute(
            "SELECT * FROM approvals WHERE status = 'pending' ORDER BY created_at ASC"
        ).fetchall()
        return [self.get_approval(row["id"]) for row in rows]

    @locked_storage_method
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

    @locked_storage_method
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

    @locked_storage_method
    def list_artifacts(self, *, project_id: str | None = None, run_id: str | None = None) -> list[ArtifactSummary]:
        query = "SELECT * FROM artifacts"
        clauses: list[str] = []
        params: list[Any] = []
        if project_id:
            clauses.append("project_id = ?")
            params.append(project_id)
        if run_id:
            clauses.append("run_id = ?")
            params.append(run_id)
        if clauses:
            query += " WHERE " + " AND ".join(clauses)
        query += " ORDER BY created_at DESC"
        rows = self.conn.execute(query, params).fetchall()
        return [self._artifact_from_row(row) for row in rows]

    @locked_storage_method
    def _artifact_from_row(self, row: sqlite3.Row) -> ArtifactSummary:
        return ArtifactSummary(
            id=row["id"],
            runId=row["run_id"],
            projectId=row["project_id"],
            agentId=row["agent_id"],
            actionId=row["action_id"],
            kind=row["kind"],
            title=row["title"],
            summary=row["summary"],
            path=row["path"],
            metadata=json.loads(row["metadata_json"] or "{}"),
            createdAt=row["created_at"],
        )

    @locked_storage_method
    def create_automation(
        self,
        *,
        name: str,
        task: str,
        project_id: str | None,
        permission_mode: str,
        plan_first: bool,
        schedule_kind: str,
        interval_minutes: int | None,
    ) -> "AutomationSummary":
        automation_id = new_id("auto")
        now = utc_now()
        self.conn.execute(
            """
            INSERT INTO automations (
              id, project_id, name, task, permission_mode, plan_first, enabled,
              schedule_kind, interval_minutes, created_at, updated_at, last_run_at
            )
            VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, NULL)
            """,
            (automation_id, project_id, name, task, permission_mode, 1 if plan_first else 0, schedule_kind, interval_minutes, now, now),
        )
        self.conn.commit()
        return self.get_automation(automation_id)

    @locked_storage_method
    def list_automations(self, *, project_id: str | None = None) -> list["AutomationSummary"]:
        if project_id:
            rows = self.conn.execute("SELECT * FROM automations WHERE project_id = ? ORDER BY created_at DESC", (project_id,)).fetchall()
        else:
            rows = self.conn.execute("SELECT * FROM automations ORDER BY created_at DESC").fetchall()
        return [self._automation_from_row(row) for row in rows]

    @locked_storage_method
    def get_automation(self, automation_id: str) -> "AutomationSummary":
        row = self.conn.execute("SELECT * FROM automations WHERE id = ?", (automation_id,)).fetchone()
        if row is None:
            raise KeyError(automation_id)
        return self._automation_from_row(row)

    @locked_storage_method
    def update_automation(self, automation_id: str, *, enabled: bool | None = None, name: str | None = None) -> "AutomationSummary":
        current = self.get_automation(automation_id)
        next_enabled = current.enabled if enabled is None else enabled
        next_name = current.name if name is None else name
        self.conn.execute(
            "UPDATE automations SET enabled = ?, name = ?, updated_at = ? WHERE id = ?",
            (1 if next_enabled else 0, next_name, utc_now(), automation_id),
        )
        self.conn.commit()
        return self.get_automation(automation_id)

    @locked_storage_method
    def delete_automation(self, automation_id: str) -> None:
        cursor = self.conn.execute("DELETE FROM automations WHERE id = ?", (automation_id,))
        self.conn.execute("DELETE FROM automation_runs WHERE automation_id = ?", (automation_id,))
        self.conn.commit()
        if cursor.rowcount == 0:
            raise KeyError(automation_id)

    @locked_storage_method
    def record_automation_run(self, automation_id: str, run_id: str) -> None:
        now = utc_now()
        self.conn.execute(
            "INSERT OR IGNORE INTO automation_runs (automation_id, run_id, created_at) VALUES (?, ?, ?)",
            (automation_id, run_id, now),
        )
        self.conn.execute("UPDATE automations SET last_run_at = ? WHERE id = ?", (now, automation_id))
        self.conn.commit()

    @locked_storage_method
    def list_automation_runs(self, automation_id: str) -> list[RunSummary]:
        rows = self.conn.execute(
            """
            SELECT r.* FROM automation_runs ar
            JOIN runs r ON r.id = ar.run_id
            WHERE ar.automation_id = ?
            ORDER BY ar.created_at DESC
            """,
            (automation_id,),
        ).fetchall()
        return [self._run_from_row(row) for row in rows]

    @locked_storage_method
    def automation_has_active_run(self, automation_id: str) -> bool:
        """True if this automation still has a run in a non-terminal state — used to prevent
        overlapping launches when a run takes longer than the schedule interval."""
        row = self.conn.execute(
            """
            SELECT 1 FROM automation_runs ar
            JOIN runs r ON r.id = ar.run_id
            WHERE ar.automation_id = ? AND r.status NOT IN ('completed', 'failed', 'cancelled')
            LIMIT 1
            """,
            (automation_id,),
        ).fetchone()
        return row is not None

    @locked_storage_method
    def _automation_from_row(self, row: sqlite3.Row) -> "AutomationSummary":
        return AutomationSummary(
            id=row["id"],
            projectId=row["project_id"],
            name=row["name"],
            task=row["task"],
            permissionMode=row["permission_mode"],
            planFirst=bool(row["plan_first"]),
            enabled=bool(row["enabled"]),
            scheduleKind=row["schedule_kind"],
            intervalMinutes=row["interval_minutes"],
            createdAt=row["created_at"],
            updatedAt=row["updated_at"],
            lastRunAt=row["last_run_at"],
        )

    # --- Agent profiles -------------------------------------------------

    @locked_storage_method
    def _seed_agent_profiles(self) -> None:
        existing = self.conn.execute("SELECT COUNT(*) AS n FROM agent_profiles").fetchone()["n"]
        if existing:
            return
        now = utc_now()
        for profile in DEFAULT_AGENT_PROFILES:
            self.conn.execute(
                """
                INSERT INTO agent_profiles (
                  id, name, role, prompt, personality, default_tools_json, default_permissions_json,
                  accent, behavior_mode, station, sound, motion_pack, task_priority,
                  model, reasoning, created_at, updated_at
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, 'default', ?, NULL, NULL, ?, ?)
                """,
                (
                    profile["id"],
                    profile["name"],
                    profile["role"],
                    profile.get("prompt", ""),
                    profile.get("personality", ""),
                    json.dumps(profile.get("defaultTools", [])),
                    json.dumps(profile.get("defaultPermissions", [])),
                    profile.get("accent", "#277f71"),
                    profile.get("behaviorMode", "balanced"),
                    profile["station"],
                    int(profile.get("taskPriority", 5)),
                    now,
                    now,
                ),
            )
        self.conn.commit()

    @locked_storage_method
    def list_agent_profiles(self, project_id: str | None = None) -> list[AgentProfileSummary]:
        self._ensure_project_profiles(project_id)
        if project_id is None:
            rows = self.conn.execute(
                "SELECT * FROM agent_profiles WHERE project_id IS NULL ORDER BY task_priority DESC, name"
            ).fetchall()
        else:
            rows = self.conn.execute(
                "SELECT * FROM agent_profiles WHERE project_id = ? ORDER BY task_priority DESC, name",
                (project_id,),
            ).fetchall()
        return [self._agent_profile_from_row(row) for row in rows]

    def _ensure_project_profiles(self, project_id: str | None) -> None:
        """Clone the global default team (project_id IS NULL) into a project the first time it is
        accessed. No-op for the global team or a project that already has profiles."""
        if project_id is None:
            return
        has_any = self.conn.execute(
            "SELECT 1 FROM agent_profiles WHERE project_id = ? LIMIT 1", (project_id,)
        ).fetchone()
        if has_any is not None:
            return
        # Assumes the global default team is already seeded (storage seeds it on init); if it were
        # empty, this would clone zero profiles into the project.
        globals_ = self.conn.execute("SELECT * FROM agent_profiles WHERE project_id IS NULL").fetchall()
        now = utc_now()
        for row in globals_:
            self.conn.execute(
                """
                INSERT INTO agent_profiles (
                  id, name, role, prompt, personality, default_tools_json, default_permissions_json,
                  accent, behavior_mode, station, sound, motion_pack, task_priority, project_id,
                  model, reasoning, created_at, updated_at
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    new_id("agent"), row["name"], row["role"], row["prompt"], row["personality"],
                    row["default_tools_json"], row["default_permissions_json"], row["accent"],
                    row["behavior_mode"], row["station"], row["sound"], row["motion_pack"],
                    row["task_priority"], project_id, row["model"], row["reasoning"], now, now,
                ),
            )
        self.conn.commit()

    @locked_storage_method
    def get_project_agent_profile(self, project_id: str | None, role: str) -> AgentProfileSummary | None:
        """Resolve a role to its profile within a project's team (materializing clones first), or the
        global profile when project_id is None, or None if no profile has that role."""
        self._ensure_project_profiles(project_id)
        if project_id is None:
            row = self.conn.execute(
                "SELECT * FROM agent_profiles WHERE project_id IS NULL AND role = ? LIMIT 1", (role,)
            ).fetchone()
        else:
            row = self.conn.execute(
                "SELECT * FROM agent_profiles WHERE project_id = ? AND role = ? LIMIT 1", (project_id, role)
            ).fetchone()
        return self._agent_profile_from_row(row) if row is not None else None

    @locked_storage_method
    def get_agent_profile(self, profile_id: str) -> AgentProfileSummary:
        row = self.conn.execute("SELECT * FROM agent_profiles WHERE id = ?", (profile_id,)).fetchone()
        if row is None:
            raise KeyError(profile_id)
        return self._agent_profile_from_row(row)

    @locked_storage_method
    def create_agent_profile(
        self,
        *,
        name: str,
        role: str,
        station: str,
        prompt: str,
        personality: str,
        accent: str,
        behavior_mode: str,
        task_priority: int,
        project_id: str | None = None,
    ) -> AgentProfileSummary:
        profile_id = new_id("agent")
        now = utc_now()
        self.conn.execute(
            """
            INSERT INTO agent_profiles (
              id, name, role, prompt, personality, default_tools_json, default_permissions_json,
              accent, behavior_mode, station, sound, motion_pack, task_priority, project_id,
              model, reasoning, created_at, updated_at
            )
            VALUES (?, ?, ?, ?, ?, '[]', '[]', ?, ?, ?, NULL, 'default', ?, ?, NULL, NULL, ?, ?)
            """,
            (profile_id, name, role, prompt, personality, accent, behavior_mode, station, task_priority, project_id, now, now),
        )
        self.conn.commit()
        return self.get_agent_profile(profile_id)

    @locked_storage_method
    def update_agent_profile(self, profile_id: str, patch: dict[str, Any]) -> AgentProfileSummary:
        current = self.get_agent_profile(profile_id)
        # Allow explicit lists (including empty []) to replace; filter scalar Nones.
        merged = current.model_copy(update={k: v for k, v in patch.items() if v is not None})
        self.conn.execute(
            """
            UPDATE agent_profiles SET name = ?, prompt = ?, personality = ?, accent = ?,
              behavior_mode = ?, station = ?, task_priority = ?, model = ?,
              default_tools_json = ?, updated_at = ?
            WHERE id = ?
            """,
            (
                merged.name,
                merged.prompt,
                merged.personality,
                merged.accent,
                merged.behaviorMode,
                merged.station,
                merged.taskPriority,
                merged.model,
                json.dumps(merged.defaultTools),
                utc_now(),
                profile_id,
            ),
        )
        self.conn.commit()
        return self.get_agent_profile(profile_id)

    @locked_storage_method
    def delete_agent_profile(self, profile_id: str) -> None:
        cursor = self.conn.execute("DELETE FROM agent_profiles WHERE id = ?", (profile_id,))
        self.conn.commit()
        if cursor.rowcount == 0:
            raise KeyError(profile_id)

    @locked_storage_method
    def _agent_profile_from_row(self, row: sqlite3.Row) -> AgentProfileSummary:
        return AgentProfileSummary(
            id=row["id"],
            name=row["name"],
            role=row["role"],
            prompt=row["prompt"],
            personality=row["personality"],
            defaultTools=json.loads(row["default_tools_json"] or "[]"),
            defaultPermissions=json.loads(row["default_permissions_json"] or "[]"),
            accent=row["accent"],
            behaviorMode=row["behavior_mode"],
            station=row["station"],
            sound=row["sound"],
            motionPack=row["motion_pack"],
            taskPriority=row["task_priority"],
            projectId=row["project_id"],
            model=row["model"],
            reasoning=row["reasoning"],
            createdAt=row["created_at"],
            updatedAt=row["updated_at"],
        )

    # --- Live Office state ----------------------------------------------

    @locked_storage_method
    def get_live_office_state(self, project_id: str | None) -> LiveOfficeStateSummary:
        if project_id is None:
            row = self.conn.execute("SELECT * FROM live_office_state WHERE project_id IS NULL").fetchone()
        else:
            row = self.conn.execute("SELECT * FROM live_office_state WHERE project_id = ?", (project_id,)).fetchone()
        if row is None:
            return self._default_office_state(project_id)
        return self._office_state_from_row(row)

    @locked_storage_method
    def upsert_live_office_state(self, project_id: str | None, patch: dict[str, Any]) -> LiveOfficeStateSummary:
        current = self.get_live_office_state(project_id)
        merged = current.model_copy(update={k: v for k, v in patch.items() if v is not None})
        now = utc_now()
        existing = (
            self.conn.execute("SELECT id FROM live_office_state WHERE project_id IS NULL").fetchone()
            if project_id is None
            else self.conn.execute("SELECT id FROM live_office_state WHERE project_id = ?", (project_id,)).fetchone()
        )
        furniture_json = json.dumps([item.model_dump() if hasattr(item, "model_dump") else item for item in merged.furniture])
        if existing is None:
            self.conn.execute(
                """
                INSERT INTO live_office_state (id, project_id, theme, behavior_mode, camera_mode, station_layout_json, furniture_json, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (new_id("office"), project_id, merged.theme, merged.behaviorMode, merged.cameraMode, json.dumps(merged.stationLayout), furniture_json, now),
            )
        else:
            self.conn.execute(
                "UPDATE live_office_state SET theme = ?, behavior_mode = ?, camera_mode = ?, station_layout_json = ?, furniture_json = ?, updated_at = ? WHERE id = ?",
                (merged.theme, merged.behaviorMode, merged.cameraMode, json.dumps(merged.stationLayout), furniture_json, now, existing["id"]),
            )
        self.conn.commit()
        self.append_event("liveOffice.state.updated", project_id=project_id, payload={"projectId": project_id})
        return self.get_live_office_state(project_id)

    @locked_storage_method
    def _default_office_state(self, project_id: str | None) -> LiveOfficeStateSummary:
        return LiveOfficeStateSummary(
            id=f"office_default_{project_id or 'global'}",
            projectId=project_id,
            theme="warm-light",
            behaviorMode="balanced",
            cameraMode="rear",
            stationLayout={},
            updatedAt=utc_now(),
        )

    @locked_storage_method
    def _office_state_from_row(self, row: sqlite3.Row) -> LiveOfficeStateSummary:
        return LiveOfficeStateSummary(
            id=row["id"],
            projectId=row["project_id"],
            theme=row["theme"],
            behaviorMode=row["behavior_mode"],
            cameraMode=row["camera_mode"],
            stationLayout=json.loads(row["station_layout_json"] or "{}"),
            furniture=json.loads(row["furniture_json"] or "[]"),
            updatedAt=row["updated_at"],
        )

    # --- Agent instances + 3D actors (persistent office state) -----------

    @locked_storage_method
    def ensure_agent_team(self, project_id: str | None) -> list[AgentInstanceSummary]:
        """Create a persistent AgentInstance + AgentActor3D per profile for this project/standalone."""
        self._ensure_project_profiles(project_id)
        if project_id is None:
            profiles = self.conn.execute(
                "SELECT * FROM agent_profiles WHERE project_id IS NULL ORDER BY task_priority DESC, name"
            ).fetchall()
        else:
            profiles = self.conn.execute(
                "SELECT * FROM agent_profiles WHERE project_id = ? ORDER BY task_priority DESC, name",
                (project_id,),
            ).fetchall()
        layout = self.get_live_office_state(project_id).stationLayout
        now = utc_now()
        for profile in profiles:
            existing = self.conn.execute(
                "SELECT id FROM agent_instances WHERE profile_id = ? AND project_id IS ?",
                (profile["id"], project_id),
            ).fetchone()
            if existing is not None:
                continue
            instance_id = new_id("inst")
            self.conn.execute(
                """
                INSERT INTO agent_instances (id, profile_id, project_id, status, current_task, queue_count,
                  fatigue, behavior_mode, station, accent, availability, updated_at)
                VALUES (?, ?, ?, 'idle', NULL, 0, 0, ?, ?, ?, 'available', ?)
                """,
                (instance_id, profile["id"], project_id, profile["behavior_mode"], profile["station"], profile["accent"], now),
            )
            x, z = _station_position(profile["station"], layout)
            self.conn.execute(
                """
                INSERT INTO agent_actor3d (id, instance_id, profile_id, project_id, x, z, station, animation, expression, motion_state, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, 'idle', 'neutral', 'still', ?)
                """,
                (new_id("actor"), instance_id, profile["id"], project_id, x, z, profile["station"], now),
            )
        self.conn.commit()
        return self._list_agent_instances_inner(project_id)

    @locked_storage_method
    def _list_agent_instances_inner(self, project_id: str | None) -> list[AgentInstanceSummary]:
        rows = self.conn.execute(
            """
            SELECT i.*, p.name AS profile_name, p.role AS profile_role
            FROM agent_instances i JOIN agent_profiles p ON p.id = i.profile_id
            WHERE i.project_id IS ? ORDER BY p.task_priority DESC, p.name
            """,
            (project_id,),
        ).fetchall()
        return [self._instance_from_row(row) for row in rows]

    @locked_storage_method
    def list_agent_instances(self, project_id: str | None) -> list[AgentInstanceSummary]:
        return self._list_agent_instances_inner(project_id)

    @locked_storage_method
    def list_agent_actors(self, project_id: str | None) -> list[AgentActor3DSummary]:
        rows = self.conn.execute("SELECT * FROM agent_actor3d WHERE project_id IS ? ORDER BY profile_id", (project_id,)).fetchall()
        return [self._actor_from_row(row) for row in rows]

    @locked_storage_method
    def update_agent_state(
        self,
        project_id: str | None,
        profile_id: str,
        *,
        status: str,
        current_task: str | None = None,
        queue_delta: int = 0,
        fatigue_delta: float = 0.0,
    ) -> None:
        row = self.conn.execute(
            "SELECT * FROM agent_instances WHERE profile_id = ? AND project_id IS ?",
            (profile_id, project_id),
        ).fetchone()
        if row is None:
            return
        now = utc_now()
        queue_count = max(0, int(row["queue_count"]) + queue_delta)
        fatigue = min(1.0, max(0.0, float(row["fatigue"]) + fatigue_delta))
        task = current_task if current_task is not None else (row["current_task"] if status == "working" else None)
        self.conn.execute(
            "UPDATE agent_instances SET status = ?, current_task = ?, queue_count = ?, fatigue = ?, updated_at = ? WHERE id = ?",
            (status, task, queue_count, fatigue, now, row["id"]),
        )
        animation, expression, motion = _actor_visuals(row["station"], status)
        self.conn.execute(
            "UPDATE agent_actor3d SET animation = ?, expression = ?, motion_state = ?, updated_at = ? WHERE instance_id = ?",
            (animation, expression, motion, now, row["id"]),
        )
        self.conn.commit()

    @locked_storage_method
    def _instance_from_row(self, row: sqlite3.Row) -> AgentInstanceSummary:
        return AgentInstanceSummary(
            id=row["id"],
            profileId=row["profile_id"],
            projectId=row["project_id"],
            name=row["profile_name"],
            role=row["profile_role"],
            status=row["status"],
            currentTask=row["current_task"],
            queueCount=row["queue_count"],
            fatigue=row["fatigue"],
            behaviorMode=row["behavior_mode"],
            station=row["station"],
            accent=row["accent"],
            availability=row["availability"],
            updatedAt=row["updated_at"],
        )

    @locked_storage_method
    def _actor_from_row(self, row: sqlite3.Row) -> AgentActor3DSummary:
        return AgentActor3DSummary(
            id=row["id"],
            instanceId=row["instance_id"],
            profileId=row["profile_id"],
            projectId=row["project_id"],
            x=row["x"],
            z=row["z"],
            station=row["station"],
            animation=row["animation"],
            expression=row["expression"],
            motionState=row["motion_state"],
            updatedAt=row["updated_at"],
        )

    @locked_storage_method
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

    @locked_storage_method
    def list_workshop_packs(self) -> list[WorkshopPackSummary]:
        rows = self.conn.execute("SELECT * FROM workshop_packs ORDER BY created_at DESC").fetchall()
        return [self._workshop_pack_from_row(row) for row in rows]

    @locked_storage_method
    def get_workshop_pack(self, pack_id: str) -> WorkshopPackSummary:
        row = self.conn.execute("SELECT * FROM workshop_packs WHERE id = ?", (pack_id,)).fetchone()
        if row is None:
            raise KeyError(pack_id)
        return self._workshop_pack_from_row(row)

    @locked_storage_method
    def set_workshop_pack_enabled(self, pack_id: str, enabled: bool) -> WorkshopPackSummary:
        self.get_workshop_pack(pack_id)
        self.conn.execute(
            "UPDATE workshop_packs SET enabled = ? WHERE id = ?",
            (1 if enabled else 0, pack_id),
        )
        self.conn.commit()
        return self.get_workshop_pack(pack_id)

    @locked_storage_method
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

    @locked_storage_method
    def get_setting(self, key: str) -> dict[str, Any] | None:
        row = self.conn.execute("SELECT value_json FROM settings WHERE key = ?", (key,)).fetchone()
        if row is None:
            return None
        return json.loads(row["value_json"] or "{}")

    @locked_storage_method
    def set_provider_settings(self, *, base_url: str, model: str, api_key: str | None) -> ProviderSettingsPublic:
        existing = self.get_setting("provider") or {}
        api_key_ref = existing.get("apiKeyRef")
        if api_key is not None:
            api_key_ref = self.secret_store.set_secret(PROVIDER_API_KEY_SECRET, api_key)
        next_value = {
            "baseUrl": base_url.rstrip("/"),
            "model": model,
            "apiKeyRef": api_key_ref,
        }
        # Never persist the raw key in SQLite.
        next_value.pop("apiKey", None)
        self.set_setting("provider", next_value)
        return self.get_provider_settings_public()

    @locked_storage_method
    def get_provider_settings_secret(self) -> dict[str, Any] | None:
        value = self.get_setting("provider")
        if not value or not value.get("baseUrl") or not value.get("model"):
            return None
        # The API key is optional: keyless local servers (Ollama, LM Studio, vLLM) are
        # fully usable with just an endpoint + model. Resolve the key when present.
        ref = value.get("apiKeyRef")
        api_key = self.secret_store.get_secret(ref) if ref else ""
        return {"baseUrl": value["baseUrl"], "model": value["model"], "apiKey": api_key or ""}

    @locked_storage_method
    def get_provider_settings_public(self) -> ProviderSettingsPublic:
        value = self.get_setting("provider") or {}
        return ProviderSettingsPublic(
            baseUrl=value.get("baseUrl") or "https://api.openai.com/v1",
            model=value.get("model"),
            apiKeyConfigured=bool(value.get("apiKeyRef")),
        )

    @locked_storage_method
    def _migrate_provider_api_key(self) -> None:
        """Move any legacy inline ``apiKey`` out of SQLite and into the secret store."""
        value = self.get_setting("provider")
        if not value or "apiKey" not in value:
            return
        raw_key = value.pop("apiKey")
        if raw_key:
            value["apiKeyRef"] = self.secret_store.set_secret(PROVIDER_API_KEY_SECRET, raw_key)
        self.set_setting("provider", value)
        # VACUUM purges the legacy key bytes from freed pages, and the checkpoint
        # flushes the rebuilt pages into the main database file so the raw secret
        # does not linger on disk after migration.
        self.conn.execute("VACUUM")
        self.conn.commit()
        self.conn.execute("PRAGMA wal_checkpoint(TRUNCATE)")

    @locked_storage_method
    def get_app_settings(self) -> AppSettings:
        value = self.get_setting("app") or {}
        return AppSettings(**value)

    @locked_storage_method
    def update_app_settings(self, update: AppSettingsUpdate) -> AppSettings:
        current = self.get_app_settings().model_dump()
        patch = update.model_dump(exclude_none=True)
        next_settings = AppSettings(**{**current, **patch})
        self.set_setting("app", next_settings.model_dump())
        return next_settings

    @locked_storage_method
    def _raw_ai_integrations(self) -> AiIntegrationsConfig:
        """Stored config with env values as secret refs (internal use only)."""
        value = self.get_setting("integrations") or {}
        return _with_honest_integration_statuses(AiIntegrationsConfig(**value))

    @staticmethod
    def _mask_env(env: dict[str, str]) -> dict[str, str]:
        # A stored ref (or any legacy non-empty value) reads back as the sentinel; never the secret.
        return {key: (_INTEGRATION_SECRET_SENTINEL if value else "") for key, value in env.items()}

    @locked_storage_method
    def get_ai_integrations(self) -> AiIntegrationsConfig:
        """Public read: env secrets are masked so the API never returns them."""
        config = self._raw_ai_integrations()
        for agent in config.externalAgents:
            agent.env = self._mask_env(agent.env)
        for server in config.mcpServers:
            server.env = self._mask_env(server.env)
        return config

    @locked_storage_method
    def get_ai_integrations_resolved(self) -> AiIntegrationsConfig:
        """Internal read for launching an agent: env refs resolved back to real secret values."""
        config = self._raw_ai_integrations()
        for agent in config.externalAgents:
            agent.env = self._resolve_env(agent.env)
        for server in config.mcpServers:
            server.env = self._resolve_env(server.env)
        return config

    def _resolve_env(self, env: dict[str, str]) -> dict[str, str]:
        resolved: dict[str, str] = {}
        for key, value in env.items():
            resolved[key] = (self.secret_store.get_secret(value) or "") if _is_secret_ref(value) else value
        return resolved

    def _reconcile_env(self, kind: str, entity_id: str, env: dict[str, str], prior_env: dict[str, str]) -> dict[str, str]:
        """Turn an incoming env dict into stored refs: preserve unchanged secrets (sentinel),
        clear emptied ones, and move new plaintext values into the SecretStore."""
        result: dict[str, str] = {}
        for key, value in env.items():
            prior = prior_env.get(key, "")
            if value == _INTEGRATION_SECRET_SENTINEL:
                if prior:
                    result[key] = prior  # keep existing ref
            elif value == "":
                if _is_secret_ref(prior):
                    self.secret_store.delete_secret(prior)
                result[key] = ""
            elif _is_secret_ref(value):
                result[key] = value
            else:
                name = f"integration-{kind}-{entity_id}-{key}"
                result[key] = self.secret_store.set_secret(name, value)
        return result

    @locked_storage_method
    def update_ai_integrations(self, update: AiIntegrationsUpdate) -> AiIntegrationsConfig:
        prior = self._raw_ai_integrations()
        prior_agents = {agent.id: agent.env for agent in prior.externalAgents}
        prior_servers = {server.id: server.env for server in prior.mcpServers}
        current = self.get_ai_integrations().model_dump()
        patch = update.model_dump(exclude_none=True)
        # model_copy(update=...) skips validation, so rebuild through the model instead.
        next_config = _with_honest_integration_statuses(AiIntegrationsConfig(**{**current, **patch}))
        # Move env secrets off-DB into the SecretStore; persist only refs.
        for agent in next_config.externalAgents:
            agent.env = self._reconcile_env("agent", agent.id, agent.env, prior_agents.get(agent.id, {}))
        for server in next_config.mcpServers:
            server.env = self._reconcile_env("mcp", server.id, server.env, prior_servers.get(server.id, {}))
        self.set_setting("integrations", next_config.model_dump())
        # Return the masked view (refs never leave the runtime).
        for agent in next_config.externalAgents:
            agent.env = self._mask_env(agent.env)
        for server in next_config.mcpServers:
            server.env = self._mask_env(server.env)
        return next_config

    @locked_storage_method
    def _run_from_row(self, row: sqlite3.Row) -> RunSummary:
        thread_id, parent_run_id = self._thread_for(row["id"])
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
            threadId=thread_id,
            parentRunId=parent_run_id,
        )

    @locked_storage_method
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

    @locked_storage_method
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

    @locked_storage_method
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

    @locked_storage_method
    def _project_id_for_run(self, run_id: str) -> str | None:
        row = self.conn.execute("SELECT project_id FROM runs WHERE id = ?", (run_id,)).fetchone()
        return row["project_id"] if row is not None else None

    @locked_storage_method
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
    "get_ai_integrations",
    "update_ai_integrations",
    "_project_id_for_run",
]:
    setattr(Storage, _storage_method_name, locked_storage_method(getattr(Storage, _storage_method_name)))
