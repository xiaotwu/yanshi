# Agent Profile Project-Scoping Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make agent profiles (the "偃师") belong to a project — each project gets its own independently-editable team, lazily cloned from a global default team — exposed through the storage layer, the HTTP API, and the TS client/store.

**Architecture:** Add a nullable `project_id` to the `agent_profiles` table (`NULL` = global default team). Reading profiles for a project lazily clones the global set into that project the first time. The `/agent-profiles` endpoints gain a `projectId` query param mirroring the existing `/live-office` pattern. The TS store loads the active project's team. This is the foundation for the 造物台 UI redesign; it does **not** rewire the execution graph or agent-instance team to project-scoped profiles — that stays on the global team and is tracked for the runtime sub-project.

**Tech Stack:** Python 3.12, FastAPI, synchronous `sqlite3` (single shared connection, `@locked_storage_method` serialization), Pydantic v2; TypeScript, React, Zustand; Vitest; pytest.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-06-16-yanshi-workshop-redesign-design.md` §6.1.
- Schema changes go through the `PRAGMA user_version` runner in `storage.py` (`_run_migrations`); migration steps must be **idempotent** (a fresh db runs every registered step body, so guard with `PRAGMA table_info`).
- Worker display name in UI is "偃师"; code identifiers, i18n keys, and DB columns stay English (`agent`, `project_id`, `agent-profiles`).
- No mocks, no fake success states. The execution graph and `ensure_agent_team` adoption of per-project identity in **runs** is OUT OF SCOPE here; do not fake it — runs continue to use the global team until the runtime sub-project lands.
- No secrets in SQLite/logs/API. `project_id`, model ids, and tool names are not secrets; provider keys remain in SecretStore (untouched here).
- Python venv is `runtime/python/.venv/bin/python`. Run pytest as `.venv/bin/python -m pytest -p no:cacheprovider`.
- Commit messages end with: `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.

---

### Task 1: Schema v2 — add `project_id` to `agent_profiles`

**Files:**
- Modify: `runtime/python/yanshi_runtime/storage.py` (declarative `CREATE TABLE agent_profiles` ~L306-322; `_SCHEMA_VERSION` L124; `_run_migrations` migrations dict L423)
- Test: `runtime/python/tests/test_runtime.py`

**Interfaces:**
- Consumes: existing `_run_migrations`, `schema_version()`.
- Produces: `agent_profiles` table has a nullable `project_id TEXT` column on both fresh and upgraded dbs; `schema_version()` returns `2`.

- [ ] **Step 1: Write the failing test**

```python
# runtime/python/tests/test_runtime.py
def test_agent_profiles_table_has_project_id_column(tmp_path: Path) -> None:
    from yanshi_runtime.storage import RuntimeStorage

    storage = RuntimeStorage(tmp_path / "runtime.db")
    cols = {row["name"] for row in storage.conn.execute("PRAGMA table_info(agent_profiles)").fetchall()}
    assert "project_id" in cols
    assert storage.schema_version() == 2
    # Seeded global profiles have NULL project_id.
    rows = storage.conn.execute("SELECT project_id FROM agent_profiles").fetchall()
    assert rows and all(row["project_id"] is None for row in rows)
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd runtime/python && .venv/bin/python -m pytest -p no:cacheprovider tests/test_runtime.py::test_agent_profiles_table_has_project_id_column -q`
Expected: FAIL — `schema_version()` returns `1` and/or `project_id` not in columns.

- [ ] **Step 3: Add the column to the declarative schema (fresh dbs)**

In the `CREATE TABLE IF NOT EXISTS agent_profiles (...)` block, add the column right after `task_priority INTEGER NOT NULL DEFAULT 5,`:

```sql
              task_priority INTEGER NOT NULL DEFAULT 5,
              project_id TEXT,
              created_at TEXT NOT NULL,
              updated_at TEXT NOT NULL
```

- [ ] **Step 4: Bump the schema version and register an idempotent migration step (upgraded dbs)**

Change `_SCHEMA_VERSION = 1` to `_SCHEMA_VERSION = 2`. In `_run_migrations`, register the step and add the method. The step is idempotent because a fresh db (where the column already exists from Step 3) also runs it:

```python
        migrations: dict[int, Callable[[], None]] = {
            2: self._migrate_add_agent_profile_project_id,
        }
```

Add the method near `_add_missing_columns`:

```python
    def _migrate_add_agent_profile_project_id(self) -> None:
        """v2: agent profiles become project-scoped. Idempotent — a fresh db already has the
        column from the declarative schema, so guard before ALTER."""
        existing = {row["name"] for row in self.conn.execute("PRAGMA table_info(agent_profiles)").fetchall()}
        if "project_id" not in existing:
            self.conn.execute("ALTER TABLE agent_profiles ADD COLUMN project_id TEXT")
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd runtime/python && .venv/bin/python -m pytest -p no:cacheprovider tests/test_runtime.py::test_agent_profiles_table_has_project_id_column -q`
Expected: PASS

- [ ] **Step 6: Run the full suite to confirm no regressions**

Run: `cd runtime/python && .venv/bin/python -m pytest -p no:cacheprovider -p no:warnings -q 2>/dev/null | tail -3`
Expected: all tests pass (100+ as baseline).

- [ ] **Step 7: Commit**

```bash
git add runtime/python/yanshi_runtime/storage.py runtime/python/tests/test_runtime.py
git commit -m "$(printf 'feat(storage): add project_id column to agent_profiles (schema v2)\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>')"
```

---

### Task 2: Project-scoped listing with lazy clone-from-global

**Files:**
- Modify: `runtime/python/yanshi_runtime/models.py` (`AgentProfileSummary` ~L150)
- Modify: `runtime/python/yanshi_runtime/storage.py` (`list_agent_profiles` L1205; `_agent_profile_from_row` L1277)
- Test: `runtime/python/tests/test_runtime.py`

**Interfaces:**
- Consumes: `AgentProfileSummary`, `new_id`, `utc_now` (already imported in storage.py).
- Produces:
  - `AgentProfileSummary.projectId: str | None = None`
  - `RuntimeStorage.list_agent_profiles(project_id: str | None = None) -> list[AgentProfileSummary]` — `None` returns the global team (`project_id IS NULL`); a project id returns that project's team, cloning the global team into it on first access.
  - `RuntimeStorage._ensure_project_profiles(project_id: str | None) -> None` — clones global → project when the project has no profiles.

- [ ] **Step 1: Write the failing test**

```python
# runtime/python/tests/test_runtime.py
def test_list_agent_profiles_clones_global_team_per_project(tmp_path: Path) -> None:
    from yanshi_runtime.storage import RuntimeStorage

    storage = RuntimeStorage(tmp_path / "runtime.db")
    global_team = storage.list_agent_profiles()
    assert global_team and all(p.projectId is None for p in global_team)

    proj_team = storage.list_agent_profiles("proj_alpha")
    # Same size, freshly cloned with distinct ids, all tagged to the project.
    assert len(proj_team) == len(global_team)
    assert all(p.projectId == "proj_alpha" for p in proj_team)
    assert {p.id for p in proj_team}.isdisjoint({p.id for p in global_team})
    assert {p.station for p in proj_team} == {p.station for p in global_team}

    # Idempotent: a second read does not re-clone (ids stable).
    again = storage.list_agent_profiles("proj_alpha")
    assert {p.id for p in again} == {p.id for p in proj_team}
    # The global team is untouched by project access.
    assert {p.id for p in storage.list_agent_profiles()} == {p.id for p in global_team}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd runtime/python && .venv/bin/python -m pytest -p no:cacheprovider tests/test_runtime.py::test_list_agent_profiles_clones_global_team_per_project -q`
Expected: FAIL — `list_agent_profiles()` takes no argument / `projectId` attribute missing.

- [ ] **Step 3: Add `projectId` to the model**

In `runtime/python/yanshi_runtime/models.py`, add to `AgentProfileSummary` (after `motionPack`):

```python
    motionPack: str = "default"
    taskPriority: int = 5
    projectId: str | None = None
    createdAt: str
    updatedAt: str
```

- [ ] **Step 4: Implement project-scoped listing + lazy clone**

In `storage.py`, replace `list_agent_profiles` and add the clone helper:

```python
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
        globals_ = self.conn.execute("SELECT * FROM agent_profiles WHERE project_id IS NULL").fetchall()
        now = utc_now()
        for row in globals_:
            self.conn.execute(
                """
                INSERT INTO agent_profiles (
                  id, name, role, prompt, personality, default_tools_json, default_permissions_json,
                  accent, behavior_mode, station, sound, motion_pack, task_priority, project_id, created_at, updated_at
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    new_id("agent"), row["name"], row["role"], row["prompt"], row["personality"],
                    row["default_tools_json"], row["default_permissions_json"], row["accent"],
                    row["behavior_mode"], row["station"], row["sound"], row["motion_pack"],
                    row["task_priority"], project_id, now, now,
                ),
            )
        self.conn.commit()
```

Note: `_ensure_project_profiles` is a plain method (no `@locked_storage_method`) because it is only ever called from already-locked methods; the re-entrant `RLock` would allow it either way, but keeping it unlocked avoids implying it is a public entry point.

- [ ] **Step 5: Tag rows in `_agent_profile_from_row`**

In `_agent_profile_from_row`, add `projectId` (the column exists after Task 1):

```python
            taskPriority=row["task_priority"],
            projectId=row["project_id"],
            createdAt=row["created_at"],
```

- [ ] **Step 6: Run test to verify it passes**

Run: `cd runtime/python && .venv/bin/python -m pytest -p no:cacheprovider tests/test_runtime.py::test_list_agent_profiles_clones_global_team_per_project -q`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add runtime/python/yanshi_runtime/models.py runtime/python/yanshi_runtime/storage.py runtime/python/tests/test_runtime.py
git commit -m "$(printf 'feat(storage): project-scoped agent profiles with lazy clone-from-global\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>')"
```

---

### Task 3: Project-scoped create + scope `ensure_agent_team`

**Files:**
- Modify: `runtime/python/yanshi_runtime/storage.py` (`create_agent_profile` L1217; `ensure_agent_team` L1364-1367)
- Test: `runtime/python/tests/test_runtime.py`

**Interfaces:**
- Consumes: `list_agent_profiles(project_id)` from Task 2.
- Produces:
  - `create_agent_profile(..., project_id: str | None = None) -> AgentProfileSummary` — the new profile belongs to `project_id`.
  - `ensure_agent_team(project_id)` builds instances from **that project's** profiles only (so cloning a project's team no longer leaks the global team into its instances).

- [ ] **Step 1: Write the failing test**

```python
# runtime/python/tests/test_runtime.py
def test_create_agent_profile_is_project_scoped(tmp_path: Path) -> None:
    from yanshi_runtime.storage import RuntimeStorage

    storage = RuntimeStorage(tmp_path / "runtime.db")
    created = storage.create_agent_profile(
        name="勘探偃师", role="browser", station="browser", prompt="", personality="",
        accent="#777777", behavior_mode="balanced", task_priority=5, project_id="proj_beta",
    )
    assert created.projectId == "proj_beta"
    beta_ids = {p.id for p in storage.list_agent_profiles("proj_beta")}
    assert created.id in beta_ids
    # The new偃师 must not appear in the global team.
    assert created.id not in {p.id for p in storage.list_agent_profiles()}


def test_ensure_agent_team_uses_project_scoped_profiles(tmp_path: Path) -> None:
    from yanshi_runtime.storage import RuntimeStorage

    storage = RuntimeStorage(tmp_path / "runtime.db")
    instances = storage.ensure_agent_team("proj_gamma")
    project_profile_ids = {p.id for p in storage.list_agent_profiles("proj_gamma")}
    assert instances and all(inst.profileId in project_profile_ids for inst in instances)
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd runtime/python && .venv/bin/python -m pytest -p no:cacheprovider tests/test_runtime.py -k "project_scoped or ensure_agent_team_uses" -q`
Expected: FAIL — `create_agent_profile` has no `project_id` param; `ensure_agent_team` builds from the global team.

- [ ] **Step 3: Add `project_id` to `create_agent_profile`**

Update the signature and INSERT (the INSERT currently hardcodes 14 columns; add `project_id`):

```python
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
              accent, behavior_mode, station, sound, motion_pack, task_priority, project_id, created_at, updated_at
            )
            VALUES (?, ?, ?, ?, ?, '[]', '[]', ?, ?, ?, NULL, 'default', ?, ?, ?, ?)
            """,
            (profile_id, name, role, prompt, personality, accent, behavior_mode, station, task_priority, project_id, now, now),
        )
        self.conn.commit()
        return self.get_agent_profile(profile_id)
```

- [ ] **Step 4: Scope `ensure_agent_team`'s profile read to the project**

In `ensure_agent_team`, replace the global profiles query (L1366) with a project-scoped one that also materializes clones first:

```python
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
```

(Leave the rest of `ensure_agent_team` unchanged.)

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd runtime/python && .venv/bin/python -m pytest -p no:cacheprovider tests/test_runtime.py -k "project_scoped or ensure_agent_team_uses" -q`
Expected: PASS

- [ ] **Step 6: Run the full suite (catch instance/team regressions)**

Run: `cd runtime/python && .venv/bin/python -m pytest -p no:cacheprovider -p no:warnings -q 2>/dev/null | tail -3`
Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add runtime/python/yanshi_runtime/storage.py runtime/python/tests/test_runtime.py
git commit -m "$(printf 'feat(storage): project-scoped create_agent_profile and ensure_agent_team\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>')"
```

---

### Task 4: `projectId` query param on the `/agent-profiles` API

**Files:**
- Modify: `runtime/python/yanshi_runtime/models.py` (`CreateAgentProfileRequest`)
- Modify: `runtime/python/yanshi_runtime/server/app.py` (`list_agent_profiles` L932; `create_agent_profile` L936)
- Test: `runtime/python/tests/test_runtime.py`

**Interfaces:**
- Consumes: `storage.list_agent_profiles(project_id)`, `storage.create_agent_profile(..., project_id=...)`.
- Produces:
  - `GET /agent-profiles?projectId=<id>` returns that project's team (cloning on first access).
  - `POST /agent-profiles?projectId=<id>` creates a profile in that project.
  - `GET /agent-profiles` (no param) still returns the global team.

- [ ] **Step 1: Write the failing test**

```python
# runtime/python/tests/test_runtime.py — uses the existing make_client(tmp_path) helper
def test_agent_profiles_api_is_project_scoped(tmp_path: Path) -> None:
    client = make_client(tmp_path)
    global_team = client.get("/agent-profiles").json()
    assert global_team and all(p["projectId"] is None for p in global_team)

    proj_team = client.get("/agent-profiles", params={"projectId": "proj_delta"}).json()
    assert len(proj_team) == len(global_team)
    assert all(p["projectId"] == "proj_delta" for p in proj_team)

    created = client.post(
        "/agent-profiles",
        params={"projectId": "proj_delta"},
        json={"name": "审校偃师", "role": "reviewer", "station": "reviewer",
              "prompt": "", "personality": "", "accent": "#888888",
              "behaviorMode": "balanced", "taskPriority": 5},
    ).json()
    assert created["projectId"] == "proj_delta"
    ids = {p["id"] for p in client.get("/agent-profiles", params={"projectId": "proj_delta"}).json()}
    assert created["id"] in ids
    assert created["id"] not in {p["id"] for p in client.get("/agent-profiles").json()}
```

(Confirm the JSON body keys against `CreateAgentProfileRequest` in `models.py`; the test above assumes `name, role, station, prompt, personality, accent, behaviorMode, taskPriority`. If a field is required without a default, include it.)

- [ ] **Step 2: Run test to verify it fails**

Run: `cd runtime/python && .venv/bin/python -m pytest -p no:cacheprovider tests/test_runtime.py::test_agent_profiles_api_is_project_scoped -q`
Expected: FAIL — endpoints ignore `projectId`; `created["projectId"]` is `None`.

- [ ] **Step 3: Thread `projectId` through the endpoints**

In `app.py`, mirror the `/live-office` query-param style:

```python
    @app.get("/agent-profiles", response_model=list[AgentProfileSummary])
    def list_agent_profiles(projectId: str | None = None, service: RuntimeService = Depends(service_dep)):
        return service.storage.list_agent_profiles(projectId)

    @app.post("/agent-profiles", response_model=AgentProfileSummary)
    def create_agent_profile(request: CreateAgentProfileRequest, projectId: str | None = None, service: RuntimeService = Depends(service_dep)):
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
            project_id=projectId,
        )
        service.storage.append_event("agent.created", agent_id=profile.id, payload=profile.model_dump())
        return profile
```

(`update`/`delete` stay keyed by `profile_id` — clones have unique ids, so no change needed.)

- [ ] **Step 4: Run test to verify it passes**

Run: `cd runtime/python && .venv/bin/python -m pytest -p no:cacheprovider tests/test_runtime.py::test_agent_profiles_api_is_project_scoped -q`
Expected: PASS

- [ ] **Step 5: Run the full suite**

Run: `cd runtime/python && .venv/bin/python -m pytest -p no:cacheprovider -p no:warnings -q 2>/dev/null | tail -3`
Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add runtime/python/yanshi_runtime/models.py runtime/python/yanshi_runtime/server/app.py runtime/python/tests/test_runtime.py
git commit -m "$(printf 'feat(api): projectId query param on /agent-profiles\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>')"
```

---

### Task 5: TS client + store load the active project's team

**Files:**
- Modify: `packages/shared/src/index.ts` (`AgentProfileSummary` L334)
- Modify: `apps/desktop/src/api/client.ts` (L195-197)
- Modify: `apps/desktop/src/stores/runtimeStore.ts` (`loadAgentProfiles` L631; bootstrap fetch L282-291; `createAgentProfile` L641)
- Test: `apps/desktop/src/stores/` (Vitest) or extend an existing store test

**Interfaces:**
- Consumes: `GET/POST /agent-profiles?projectId=...` from Task 4; `get().activeProjectId`.
- Produces:
  - `AgentProfileSummary.projectId?: string | null` (TS)
  - `runtimeApi.agentProfiles(projectId?: string | null)`
  - `runtimeApi.createAgentProfile(body, projectId?: string | null)`
  - `store.loadAgentProfiles()` loads for `activeProjectId`; `store.createAgentProfile(body)` creates under `activeProjectId`.

- [ ] **Step 1: Write the failing test**

```typescript
// apps/desktop/src/stores/agent-profiles-scope.test.ts
import { describe, expect, it, vi, beforeEach } from "vitest";
import { runtimeApi } from "../api/client";

describe("agentProfiles project scoping", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("passes projectId as a query param", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("[]", { status: 200, headers: { "content-type": "application/json" } }),
    );
    await runtimeApi.agentProfiles("proj_x");
    const url = String(fetchMock.mock.calls[0]?.[0]);
    expect(url).toContain("/agent-profiles");
    expect(url).toContain("projectId=proj_x");
  });

  it("omits projectId when none is given", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("[]", { status: 200, headers: { "content-type": "application/json" } }),
    );
    await runtimeApi.agentProfiles();
    const url = String(fetchMock.mock.calls[0]?.[0]);
    expect(url).not.toContain("projectId");
  });
});
```

(If `request()` in `client.ts` builds URLs in a way that needs a base/host, follow the pattern already used by `eventsUrl`/other tests in the repo. Confirm by reading an existing client test before finalizing the assertion on the URL shape.)

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/desktop && npx vitest run src/stores/agent-profiles-scope.test.ts`
Expected: FAIL — `agentProfiles` ignores its argument; no `projectId` in URL.

- [ ] **Step 3: Add `projectId` to the shared type**

In `packages/shared/src/index.ts`, add to `AgentProfileSummary` (mirror the Pydantic field):

```typescript
  taskPriority: number;
  projectId?: string | null;
  createdAt: string;
  updatedAt: string;
```

- [ ] **Step 4: Thread `projectId` through the client**

In `apps/desktop/src/api/client.ts`:

```typescript
  agentProfiles: (projectId?: string | null) =>
    request<AgentProfileSummary[]>(`/agent-profiles${projectId ? `?projectId=${encodeURIComponent(projectId)}` : ""}`),
  createAgentProfile: (
    body: { name: string; role?: string; station?: string; behaviorMode?: BehaviorMode; accent?: string; taskPriority?: number },
    projectId?: string | null,
  ) =>
    request<AgentProfileSummary>(`/agent-profiles${projectId ? `?projectId=${encodeURIComponent(projectId)}` : ""}`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
```

- [ ] **Step 5: Load/create for the active project in the store**

In `apps/desktop/src/stores/runtimeStore.ts`:

- Bootstrap fetch (~L291): change `runtimeApi.agentProfiles()` to `runtimeApi.agentProfiles(currentProjectId)` (the bootstrap already reads `const currentProjectId = get().activeProjectId;`).
- `loadAgentProfiles` (L631-634):

```typescript
  loadAgentProfiles: async () => {
    const agentProfiles = await runtimeApi.agentProfiles(get().activeProjectId);
    set((state) => ({ agentProfiles, liveAgents: computeAgents(agentProfiles, state.events, state.officeState?.behaviorMode ?? "balanced", state.agentInstances) }));
  },
```

- `createAgentProfile` (L641-644):

```typescript
  createAgentProfile: async (body) => {
    await runtimeApi.createAgentProfile(body, get().activeProjectId);
    await get().loadAgentProfiles();
  },
```

- [ ] **Step 6: Run the new test, then typecheck + full frontend suite**

Run: `cd apps/desktop && npx vitest run src/stores/agent-profiles-scope.test.ts`
Expected: PASS

Run: `cd apps/desktop && npm run lint && npx vitest run 2>&1 | tail -4`
Expected: `tsc` clean; all vitest pass.

- [ ] **Step 7: Commit**

```bash
git add packages/shared/src/index.ts apps/desktop/src/api/client.ts apps/desktop/src/stores/runtimeStore.ts apps/desktop/src/stores/agent-profiles-scope.test.ts
git commit -m "$(printf 'feat(desktop): load/create agent profiles for the active project\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>')"
```

---

## Self-Review

**Spec coverage (§6.1):**
- "agent profile 增加 `project_id`(可空,NULL = 全局默认队)" → Task 1. ✅
- "迁移走现有 `PRAGMA user_version` runner...`_SCHEMA_VERSION` +1" → Task 1 (idempotent step). ✅
- "新项目首次进入造物台时,从全局默认队克隆出本项目队(惰性物化)" → Task 2 (`_ensure_project_profiles`). ✅
- "API:`GET/PUT /agents` 增加 `projectId` 维度(沿用 office 端点风格)" → Task 4 (GET/POST; PUT/DELETE key by id, unchanged by design). ✅
- "前端:`runtimeApi.agentProfiles(projectId)`;store 随 `activeProjectId` 加载" → Task 5. ✅
- §6.2 new fields (model/reasoning/tools): **out of scope for this plan** (deferred to the UI + runtime plans) — see Global Constraints. Not a gap; intentionally staged.

**Placeholder scan:** No TBD/TODO; every code step shows full code. Two steps ask the implementer to *confirm an existing pattern before finalizing an assertion* (the `CreateAgentProfileRequest` body keys in Task 4 Step 1; the `request()` URL shape in Task 5 Step 1) — these are verification instructions against real code, not missing content.

**Type consistency:** `project_id` (Python/SQL) ↔ `projectId` (Pydantic/TS/query param) used consistently. `list_agent_profiles(project_id=None)`, `create_agent_profile(..., project_id=None)`, `_ensure_project_profiles(project_id)`, `runtimeApi.agentProfiles(projectId?)`, `createAgentProfile(body, projectId?)` — names match across tasks.

**Scope boundary (honesty):** The execution graph and per-run identity continue to use the global team; this plan does not pretend otherwise. The 造物台 UI and the runtime adoption of project-scoped/per-偃师 model+tools are separate follow-on plans.
