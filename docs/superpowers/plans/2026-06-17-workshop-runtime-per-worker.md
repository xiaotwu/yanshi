# Runtime Adoption of Project-Scoped & Per-偃师 Config Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make run execution honor each project's own team and each 偃师's own configuration: the graph loads personas from the run's project (not the global team), and each 偃师 carries its own model/reasoning ("心智") and tool whitelist ("本事") that the executor enforces. Then flip the 造物台's Mind/Abilities sections from read-only to writable.

**Architecture:** Profiles already carry `project_id` and a `default_tools_json` whitelist; add `model`/`reasoning` columns (schema v3). Because project-cloned profiles have random ids (not the fixed `agent_manager` ids the graph keys off), add a role-based resolver `get_project_agent_profile(project_id, role)`. The graph resolves the run's `project_id`, loads personas/model/tools per role, and computes effective tools as `global_flag ∩ profile_whitelist ∩ permission_caps`. Per-call model override extends the provider. Finally the inspector's Mind/Abilities become editable.

**Tech Stack:** Python 3.12, FastAPI, sqlite3, LangGraph, httpx-based `OpenAICompatibleProvider`; TypeScript/React/Zustand frontend; pytest + Vitest.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-06-16-yanshi-workshop-redesign-design.md` (§6.2, §7, §13, §16).
- Builds on: agent profiles are project-scoped (`project_id`, lazy clone, `list_agent_profiles(project_id)`, `ensure_agent_team(project_id)`). Builds on the 造物台 UI plan (`2026-06-17-zaowutai-workshop-ui.md`) — Task 6 of THIS plan flips sections that plan created as read-only.
- Schema changes go through the `PRAGMA user_version` runner; migration steps idempotent (guard with `PRAGMA table_info`); a fresh db runs every step body.
- HONESTY: effective tools for a 偃师 = `global tool flag (settings) ∩ profile whitelist ∩ permission policy caps`. A 偃师 must NEVER be able to use a tool that is globally disabled, not installed, or not permitted — the whitelist can only ever subtract. No mocks, no fake success. Provider keys stay in SecretStore; model id / reasoning / tool names may persist in SQLite.
- `model`/`reasoning` empty on a profile means "inherit the globally configured provider model" — never silently substitute a different model.
- Worker display name "偃师"; code identifiers / DB columns English.
- Run pytest as `cd runtime/python && .venv/bin/python -m pytest -p no:cacheprovider`; frontend `cd apps/desktop && npm run lint && npx vitest run`.
- Commit messages end with: `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.

---

### Task 1: Schema v3 — per-偃师 `model` + `reasoning` columns

**Files:**
- Modify: `runtime/python/yanshi_runtime/storage.py` (declarative `agent_profiles` CREATE; `_SCHEMA_VERSION` → 3; register `3:` migration; `_seed_agent_profiles`, `_ensure_project_profiles`, `create_agent_profile` INSERTs; `_agent_profile_from_row`)
- Modify: `runtime/python/yanshi_runtime/models.py` (`AgentProfileSummary`, `UpdateAgentProfileRequest`)
- Test: `runtime/python/tests/test_runtime.py`

**Interfaces:**
- Produces: `agent_profiles` has nullable `model TEXT` and `reasoning TEXT`; `AgentProfileSummary` gains `model: str | None = None`, `reasoning: str | None = None`; the abilities whitelist reuses the EXISTING `defaultTools` field (`default_tools_json`). `_migrate_add_agent_profile_model_reasoning` is idempotent.

- [ ] **Step 1: Failing test** — fresh `Storage(tmp_path/"runtime.db","test")`: assert `model` and `reasoning` columns exist in `PRAGMA table_info(agent_profiles)` and `schema_version() == 3`; assert a seeded profile has `model is None`.
- [ ] **Step 2: Verify fail.**
- [ ] **Step 3:** Add `model TEXT` and `reasoning TEXT` to the declarative CREATE (before `created_at`). Bump `_SCHEMA_VERSION = 3`. Register `3: self._migrate_add_agent_profile_model_reasoning` and write it idempotently (mirror `_migrate_add_agent_profile_project_id`: read `PRAGMA table_info`, `ALTER TABLE ... ADD COLUMN` each missing column). Add `model`/`reasoning` to the three INSERT column lists + `_ensure_project_profiles` clone copy + `_agent_profile_from_row` (`model=row["model"]`, `reasoning=row["reasoning"]`). Add the two optional fields to `AgentProfileSummary` and to `UpdateAgentProfileRequest`.
- [ ] **Step 4: Verify pass; full suite green.**
- [ ] **Step 5: Commit** — `feat(storage): per-worker model/reasoning columns (schema v3)`.

---

### Task 2: Role-based profile resolution for a project

**Files:**
- Modify: `runtime/python/yanshi_runtime/storage.py`
- Test: `runtime/python/tests/test_runtime.py`

**Interfaces:**
- Consumes: `list_agent_profiles(project_id)` / `_ensure_project_profiles`.
- Produces: `get_project_agent_profile(self, project_id: str | None, role: str) -> AgentProfileSummary | None` — returns the profile for `role` within the project's team (materializing clones first via `_ensure_project_profiles`), or the global one when `project_id is None`, or `None` if no profile has that role. Needed because the graph keys agents by role (`manager`, `browser`, …) but project clones have random ids.

  > Confirm the column that holds the role: the graph's fixed ids are `agent_<role>` and the seed sets both `id` and `role`/`station`. Resolve by `role` (fall back to `station` if the codebase uses `station` as the canonical key — check `_seed_agent_profiles` / `DEFAULT_AGENT_PROFILES` and the graph's `_agent_persona` lookup before finalizing the column).

- [ ] **Step 1: Failing test** — seed; `get_project_agent_profile(None, "manager")` returns the global manager; `get_project_agent_profile("proj_x", "manager")` returns a profile with `projectId=="proj_x"` and the same role, distinct id; an unknown role returns `None`.
- [ ] **Step 2: Verify fail.**
- [ ] **Step 3:** Implement (decorated `@locked_storage_method`): ensure clones, then `SELECT * FROM agent_profiles WHERE project_id IS ? AND role = ? LIMIT 1` (use `IS ?` to match NULL); return `_agent_profile_from_row(row)` or `None`.
- [ ] **Step 4: Verify pass; full suite green.**
- [ ] **Step 5: Commit** — `feat(storage): resolve agent profile by (project, role)`.

---

### Task 3: Graph loads personas from the run's project

**Files:**
- Modify: `runtime/python/yanshi_runtime/graph/runtime_graph.py` (`_agent_persona` ~L197-212; callers pass run context)
- Test: `runtime/python/tests/test_runtime.py`

**Interfaces:**
- Consumes: `storage.get_project_agent_profile(project_id, role)`, `storage.get_run(run_id)` (to read the run's `projectId`).
- Produces: persona text for an agent in a run reflects the RUN'S PROJECT team. `_agent_persona` gains the run's project context (e.g. `_agent_persona(agent_id, project_id)`), mapping `agent_<role>` → role and resolving via Task 2; falls back to the global profile when the project has none.

  > Read `_agent_persona` (L197-212) and every caller (the `persona=self._agent_persona("agent_file")` sites at L617/L831/L888/L760) first. Thread `project_id` (resolved once per run from `get_run(run_id).projectId`) to each call. Keep the global fallback so standalone runs are unchanged.

- [ ] **Step 1: Failing test** — create a project; edit that project's manager persona/personality via storage; start/execute a run in that project (use the existing run-execution test harness in `test_runtime.py`); assert the project's persona text is what the manager node used (assert against the observation/action persona field the graph records). A standalone run still uses the global persona.
- [ ] **Step 2: Verify fail.**
- [ ] **Step 3:** Thread project context into `_agent_persona` and its callers; resolve role from `agent_<role>`; use Task 2's resolver with global fallback.
- [ ] **Step 4: Verify pass; full suite green (watch run-execution tests).**
- [ ] **Step 5: Commit** — `feat(graph): load agent personas from the run's project team`.

---

### Task 4: Per-偃师 model + reasoning at execution

**Files:**
- Read first: `runtime/python/yanshi_runtime/providers/openai_compatible.py` (how `model`/`reasoning` are currently set on `self.provider`; whether `chat_completion`/`stream_chat_completion` can take a per-call model override)
- Modify: `runtime/python/yanshi_runtime/providers/openai_compatible.py` (add optional per-call `model`/`reasoning` override if not already supported) and `runtime/python/yanshi_runtime/graph/runtime_graph.py` (pass the resolved 偃师's `model`/`reasoning` when calling the provider for that agent)
- Test: `runtime/python/tests/test_runtime.py`

**Interfaces:**
- Consumes: resolved `AgentProfileSummary.model` / `.reasoning` (Task 1), per-agent project resolution (Task 3).
- Produces: when a 偃师 has a non-empty `model`, the provider call for that agent uses it; empty → inherits the globally configured provider model (never silently swapped). Effective reasoning likewise.

  > This task has a genuine design dependency: STEP 1 is to read the provider and determine whether per-call model override is feasible with the existing single-provider design, or whether a per-call `model=` argument must be added to `chat_completion`/`stream_chat_completion`. Pick the minimal change. If the provider is constructed with a fixed model and base_url and cannot accept a per-call override without significant rework, STOP and report DONE_WITH_CONCERNS describing the options (per-call arg vs. provider-per-model registry) so the controller/human can decide. Do NOT invent a multi-provider registry without that decision.

- [ ] **Step 1:** Read the provider; determine the override mechanism. Record the chosen approach in the report.
- [ ] **Step 2: Failing test** — a 偃师 with `model="custom-x"` causes the provider call for that agent to use `model="custom-x"` (assert via a fake/injected provider that records the model it was called with — follow the existing provider-injection test pattern in `test_runtime.py`); a 偃师 with empty model uses the configured default.
- [ ] **Step 3: Verify fail; implement the override; verify pass.**
- [ ] **Step 4: Full suite green.**
- [ ] **Step 5: Commit** — `feat(graph): per-worker model/reasoning override at execution`.

---

### Task 5: Effective tool gating = global ∩ whitelist ∩ permission caps

**Files:**
- Modify: `runtime/python/yanshi_runtime/graph/runtime_graph.py` (the tool-enablement check; `TOOL_TOGGLE_BY_AGENT` L21-25 maps agent→global setting)
- Test: `runtime/python/tests/test_runtime.py`

**Interfaces:**
- Consumes: the resolved 偃师's `defaultTools` whitelist (Task 1/3), the global tool toggles (settings), the permission policy.
- Produces: a single resolver `_tool_allowed(agent_id, tool, project_id, settings) -> bool` returning `True` only when the tool is globally enabled AND in the 偃师's whitelist (when the whitelist is non-empty) AND permitted by policy. An empty whitelist means "inherit global" (no extra restriction); a non-empty whitelist can only subtract. Find the current global-flag check (uses `TOOL_TOGGLE_BY_AGENT`) and route it through this resolver.

  > Read how the graph currently decides a tool is enabled (search for `TOOL_TOGGLE_BY_AGENT` usage and the `*ToolEnabled` settings reads) before changing it. Preserve the existing global-disable behavior exactly; only add the whitelist intersection.

- [ ] **Step 1: Failing test** — with a global flag ON but the 偃师's whitelist excluding that tool → tool blocked (honest missingRequirement, no fake success); whitelist empty → behaves exactly as today (global flag governs); global flag OFF → blocked regardless of whitelist.
- [ ] **Step 2: Verify fail; implement `_tool_allowed`; route the existing check through it; verify pass.**
- [ ] **Step 3: Full suite green.**
- [ ] **Step 4: Commit** — `feat(graph): per-worker tool whitelist intersected with global + policy`.

---

### Task 6: Flip 造物台 Mind/Abilities to writable

**Files:**
- Modify: `apps/desktop/src/api/client.ts` (`updateAgentProfile` Pick set + create body include `model`/`reasoning`/tools)
- Modify: `packages/shared/src/index.ts` (`AgentProfileSummary` gains `model?`, `reasoning?`)
- Modify: `apps/desktop/src/features/workshop/sections/MindSection.tsx` + `AbilitiesSection.tsx` (read-only → editable; remove the "pending runtime support" note)
- Modify: `runtime/python/yanshi_runtime/server/app.py` if `UpdateAgentProfileRequest` fields need wiring through `update_agent_profile` (the storage `update_agent_profile` patch path — confirm it persists `model`/`reasoning`/tools; extend the UPDATE statement if it only handles the original columns)
- Test: `apps/desktop/src/features/workshop/sections/*.test.tsx`; `runtime/python/tests/test_runtime.py` (update persists model/reasoning/tools)

**Interfaces:**
- Consumes: Tasks 1-5 (storage fields + runtime enforcement now real).
- Produces: MindSection edits `model`/`reasoning` (model picker source: the globally available models — confirm the source per spec §16 open question before building the picker; if unresolved, a free-text model id field is the honest minimum); AbilitiesSection toggles the `defaultTools` whitelist with tool icon switches, each capped to globally-enabled/permitted tools (dim+disable the rest with a reason `title`). The `t("workshop.pendingRuntime")` note is removed.

  > Confirm `storage.update_agent_profile` actually persists `model`/`reasoning`/`default_tools_json` — the existing UPDATE statement (`storage.py:1250-1265` pre-v3) only sets name/prompt/personality/accent/behavior/station/task_priority. EXTEND it to also set `model`, `reasoning`, and `default_tools_json` from the patch, or the writable UI will silently no-op (which would violate the honesty rule). Add a storage test for this BEFORE the UI flip.

- [ ] **Step 1: Failing storage test** — `update_agent_profile(id, {"model": "m1", "reasoning": "high", "defaultTools": ["file"]})` then `get_agent_profile(id)` reflects all three. (RED if the UPDATE drops them.)
- [ ] **Step 2:** Extend `update_agent_profile`'s UPDATE to persist `model`/`reasoning`/`default_tools_json`; verify the test passes.
- [ ] **Step 3: Failing frontend test** — MindSection renders an editable model field bound to the profile; AbilitiesSection renders tool switches that call `saveAgentProfile` with an updated `defaultTools`; neither shows `t("workshop.pendingRuntime")`.
- [ ] **Step 4:** Add `model`/`reasoning` to the shared type + client `updateAgentProfile` Pick set; make the two sections editable (tool switches capped to globally-enabled tools with disabled+reason for the rest); remove the pending note.
- [ ] **Step 5: Verify** `npm run lint && npx vitest run` + the storage suite green.
- [ ] **Step 6: Commit** — `feat(workshop): editable 心智/本事 now that the runtime honors them`.

---

## Self-Review

**Spec coverage:** §6.2 per-worker model/reasoning/tools → Tasks 1 (fields), 4 (model), 5 (tools); §7 mind/abilities become real → Task 6; §13 honesty (whitelist only subtracts; empty inherits; never swap models; no fake success) → Tasks 4, 5, 6 (incl. the storage-persist guard before the UI flip); §16 open questions (model candidate source) → flagged in Tasks 4 & 6 as a decision to confirm, with a free-text fallback so the plan stays honest. Project-scoped personas in runs → Tasks 2-3.

**Placeholder scan:** Storage tasks (1, 2, 6 storage step) carry concrete SQL + test shapes. Three tasks (3, 4, 5) legitimately begin with "read the current code at these exact line ranges first" because they integrate with graph/provider internals this plan must not guess — each names the exact symbols/lines to read and the decision to record, and Task 4 has an explicit STOP-and-escalate if per-call model override needs architectural rework. This is deliberate (avoiding invented provider internals), not vague hand-waving.

**Type consistency:** `model`/`reasoning` thread consistently: SQL columns → `AgentProfileSummary` (Py + TS) → `UpdateAgentProfileRequest` → client `updateAgentProfile`. The abilities whitelist consistently reuses the existing `defaultTools`/`default_tools_json` (no new tools column). `get_project_agent_profile(project_id, role)` defined in Task 2 is consumed in Task 3.

**Sequencing risk:** Task 6 depends on Tasks 1-5 being merged (the UI may only become writable once the runtime enforces the values). It also depends on the 造物台 UI plan having created the read-only MindSection/AbilitiesSection. Run that plan first. The Task 6 storage-persist guard (Step 1-2) must precede the UI flip, or edits would silently no-op.

**Genuine unknowns to resolve during execution (not before):** (a) per-call model override mechanism in the provider (Task 4 Step 1); (b) the model-candidate source for the picker (Task 6 — free-text fallback keeps it honest); (c) whether the canonical role key is `role` or `station` (Task 2 — confirm against the seed and `_agent_persona`).
