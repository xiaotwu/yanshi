# ACP Task Routing (Layer 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a run be routed entirely to a connected external ACP agent — `session/new` + `session/prompt`, collecting the agent's `agent_message_chunk` text as the run's answer — bypassing the internal graph.

**Architecture:** Add `new_session`/`prompt` to `AcpConnection` (the prompt collects `session/update` notifications). A run created with `externalAgentId` is dispatched to `_run_via_external_agent` instead of the graph; it writes the agent's reply as the run's `result_summary` + completion event (the same artifacts the graph finalizer writes). A "Run a task" affordance on connected agents creates such a run. No tool/permission call-back (layer 2).

**Tech Stack:** Python 3.12 stdlib (`subprocess`/`json`/`threading`), FastAPI; TypeScript/React/Zustand/Vitest; pytest.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-06-19-acp-task-routing-design.md`.
- **Mirror `acp.py`'s existing `AcpConnection.request`** (single-flight `_lock`, daemon reader thread + `join(timeout)`, skip non-JSON lines, match by `id`). `prompt` is the same loop but ALSO collects `session/update`/`agent_message_chunk` text instead of discarding notifications.
- **Connected-only routing.** Route to an agent only when it is (or can be) `connected`. Connect/session/prompt failure → the run **fails honestly** (`status="failed"`, real error in `result_summary`, `run.failed` event). Never fake a reply.
- **No tool/permission call-back (layer 2).** `session/update`s that aren't `agent_message_chunk` (e.g. tool_call/permission) are ignored in layer 1 — not serviced, not faked.
- Run completion uses the SAME storage as the graph finalizer: `storage.update_run(run_id, status=..., result_summary=<answer>, completed=True)` + `storage.append_event("run.completed"/"run.failed", run_id=run_id, payload={"summary": <answer>})`. Non-streaming this slice (write the full answer when `prompt` resolves).
- ACP field names (use these; if a required field is absent in the agent's reply, FAIL honestly, don't guess): `session/new` result `sessionId`; `session/prompt` params `{sessionId, prompt:[{type:"text", text}]}`; `session/update` notification params `{update:{sessionUpdate:"agent_message_chunk", content:{type:"text", text}}}`.
- env secrets stay in SecretStore (connect resolves them into the child only); never returned/logged.
- Real storage class `Storage(database_path, runtime_version)`. pytest: `cd runtime/python && .venv/bin/python -m pytest -p no:cacheprovider`. Frontend: `cd apps/desktop && npm run lint && npx vitest run`.
- Commit messages end with `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.

---

### Task 1: `AcpConnection.new_session` + `prompt` (collect agent text)

**Files:**
- Modify: `runtime/python/yanshi_runtime/acp.py`
- Test: `runtime/python/tests/test_runtime.py` (+ an `ACP_PROMPT_FIXTURE_AGENT` extending the existing `ACP_FIXTURE_AGENT`)

**Interfaces:**
- Consumes: existing `AcpConnection` (`.process`, `.request`, `._lock`, `._next_id`).
- Produces:
  - module function `_agent_chunk_text(payload: dict) -> str | None` (returns the text of a `session/update`/`agent_message_chunk`, else None)
  - `AcpConnection.new_session(self, timeout: float, cwd: str | None = None) -> str`
  - `AcpConnection.prompt(self, session_id: str, text: str, timeout: float) -> str`

- [ ] **Step 1: Add the extended fixture + failing tests** in `test_runtime.py`:

```python
ACP_PROMPT_FIXTURE_AGENT = '''
import json, sys
for line in sys.stdin:
    line = line.strip()
    if not line:
        continue
    msg = json.loads(line)
    method = msg.get("method")
    if method == "initialize":
        sys.stdout.write(json.dumps({"jsonrpc":"2.0","id":msg["id"],"result":{"protocolVersion":1,"agentCapabilities":{}}}) + "\\n")
    elif method == "session/new":
        sys.stdout.write(json.dumps({"jsonrpc":"2.0","id":msg["id"],"result":{"sessionId":"s1"}}) + "\\n")
    elif method == "session/prompt":
        text = msg["params"]["prompt"][0]["text"]
        # stream one agent_message_chunk notification, then resolve the prompt request
        sys.stdout.write(json.dumps({"jsonrpc":"2.0","method":"session/update","params":{"sessionId":"s1","update":{"sessionUpdate":"agent_message_chunk","content":{"type":"text","text":"Echo: " + text}}}}) + "\\n")
        sys.stdout.write(json.dumps({"jsonrpc":"2.0","id":msg["id"],"result":{"stopReason":"end_turn"}}) + "\\n")
    sys.stdout.flush()
'''


def test_agent_chunk_text_extracts_only_message_chunks() -> None:
    from yanshi_runtime.acp import _agent_chunk_text
    assert _agent_chunk_text({"method": "session/update", "params": {"update": {"sessionUpdate": "agent_message_chunk", "content": {"type": "text", "text": "hi"}}}}) == "hi"
    assert _agent_chunk_text({"method": "session/update", "params": {"update": {"sessionUpdate": "tool_call", "content": {}}}}) is None
    assert _agent_chunk_text({"id": 1, "result": {}}) is None


def test_acp_new_session_and_prompt_collect_text(tmp_path: Path) -> None:
    from yanshi_runtime.acp import AcpManager
    from yanshi_runtime.models import ExternalAgentConfig
    agent_script = tmp_path / "acp_prompt_agent.py"
    agent_script.write_text(ACP_PROMPT_FIXTURE_AGENT)
    manager = AcpManager()
    try:
        conn = manager.connect(ExternalAgentConfig(id="ea", name="x", protocol="acp", command=f"{sys.executable} {agent_script}", enabled=True))
        assert conn.status == "connected"
        session_id = conn.new_session(timeout=5)
        assert session_id == "s1"
        assert conn.prompt(session_id, "hello", timeout=5) == "Echo: hello"
    finally:
        manager.shutdown()
```

- [ ] **Step 2: Run to verify they fail** — `cd runtime/python && .venv/bin/python -m pytest -p no:cacheprovider tests/test_runtime.py -k "agent_chunk_text or new_session_and_prompt" -q` → FAIL.

- [ ] **Step 3: Implement in `acp.py`** — add the module function + the two methods (mirror `AcpConnection.request`; `prompt` collects chunks). Add `import os` if not present.

```python
def _agent_chunk_text(payload: dict) -> str | None:
    """Return the text of a session/update agent_message_chunk, else None (ignores tool/permission updates)."""
    if payload.get("method") != "session/update":
        return None
    update = (payload.get("params") or {}).get("update") or {}
    if update.get("sessionUpdate") != "agent_message_chunk":
        return None
    content = update.get("content") or {}
    text = content.get("text")
    return text if isinstance(text, str) and text else None
```

Add to `AcpConnection`:

```python
    def new_session(self, timeout: float, cwd: str | None = None) -> str:
        result = self.request("session/new", {"cwd": cwd or os.getcwd(), "mcpServers": []}, timeout)
        session_id = result.get("sessionId")
        if not isinstance(session_id, str) or not session_id:
            raise ConnectionError("The agent did not return a session id.")
        return session_id

    def prompt(self, session_id: str, text: str, timeout: float) -> str:
        """Send session/prompt and collect agent_message_chunk text until the prompt resolves."""
        with self._lock:
            request_id = self._next_id
            self._next_id += 1
            message = json.dumps({
                "jsonrpc": "2.0", "id": request_id, "method": "session/prompt",
                "params": {"sessionId": session_id, "prompt": [{"type": "text", "text": text}]},
            })
            if self.process is None or self.process.stdin is None or self.process.stdout is None:
                raise ConnectionError("The agent process is not running.")
            self.process.stdin.write(message + "\n")
            self.process.stdin.flush()

            chunks: list[str] = []
            failure: list[str] = []
            stdout = self.process.stdout

            def read_loop() -> None:
                while True:
                    line = stdout.readline()
                    if not line:
                        failure.append("The agent process closed its output before responding.")
                        return
                    line = line.strip()
                    if not line:
                        continue
                    try:
                        payload = json.loads(line)
                    except json.JSONDecodeError:
                        continue
                    if payload.get("id") == request_id:
                        if "error" in payload:
                            error = payload["error"]
                            failure.append(error.get("message", str(error)) if isinstance(error, dict) else str(error))
                        return
                    piece = _agent_chunk_text(payload)
                    if piece:
                        chunks.append(piece)

            reader = threading.Thread(target=read_loop, daemon=True)
            reader.start()
            reader.join(timeout)
            if reader.is_alive():
                raise TimeoutError(f"No response to session/prompt within {timeout:.0f}s.")
            if failure:
                raise ConnectionError(failure[0])
            answer = "".join(chunks)
            if not answer:
                raise ConnectionError("The agent returned an empty response.")
            return answer
```

- [ ] **Step 4: Run the tests → PASS; then full suite green.**
- [ ] **Step 5: Commit**

```bash
git add runtime/python/yanshi_runtime/acp.py runtime/python/tests/test_runtime.py
git commit -m "$(printf 'feat(acp): session/new + session/prompt with agent_message_chunk collection\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>')"
```

---

### Task 2: Route a run to an external agent

**Files:**
- Modify: `runtime/python/yanshi_runtime/models.py` (`CreateRunRequest.externalAgentId`)
- Modify: `runtime/python/yanshi_runtime/server/app.py` (`create_run` passthrough; `_dispatch_run`/queue/`_run_worker`/`start_run` carry `external_agent_id`; add `_run_via_external_agent` + `_fail_run`)
- Test: `runtime/python/tests/test_runtime.py`

**Interfaces:**
- Consumes: `AcpConnection.new_session`/`prompt` (Task 1); `self.acp.live_state`/`connect`; `storage.get_ai_integrations_resolved()`; `storage.update_run`/`append_event`.
- Produces:
  - `CreateRunRequest.externalAgentId: str | None = None`
  - `RuntimeService._run_via_external_agent(self, run_id: str, task: str, agent_id: str) -> None`
  - `RuntimeService._fail_run(self, run_id: str, message: str, error: str) -> None`
  - `start_run(..., external_agent_id: str | None = None)` routes to the agent when set.

- [ ] **Step 1: Write the failing test**

```python
def test_run_routes_to_external_agent(tmp_path: Path) -> None:
    client = make_client(tmp_path)  # synchronous_runs=True in the test settings
    agent_script = tmp_path / "acp_prompt_agent.py"
    agent_script.write_text(ACP_PROMPT_FIXTURE_AGENT)
    client.put("/settings/integrations", json={"externalAgents": [{"id": "ea_ok", "name": "Fixture", "protocol": "acp", "command": f"{sys.executable} {agent_script}", "enabled": True}]})
    client.post("/settings/integrations/agents/ea_ok/connect")

    run = client.post("/runs", json={"task": "hello", "externalAgentId": "ea_ok"}).json()
    fetched = client.get(f"/runs/{run['id']}").json()
    assert fetched["status"] == "completed"
    assert fetched["resultSummary"] == "Echo: hello"


def test_run_via_unknown_external_agent_fails_honestly(tmp_path: Path) -> None:
    client = make_client(tmp_path)
    run = client.post("/runs", json={"task": "hello", "externalAgentId": "nope"}).json()
    fetched = client.get(f"/runs/{run['id']}").json()
    assert fetched["status"] == "failed"
```

(Confirm `make_client` uses `synchronous_runs=True` so the run finishes within the request; the existing run tests rely on this. Confirm the run summary field name on `GET /runs/{id}` is `resultSummary` — match the existing run-fetch tests.)

- [ ] **Step 2: Run to verify it fails.**
- [ ] **Step 3: Model** — add `externalAgentId: str | None = None` to `CreateRunRequest`.
- [ ] **Step 4: Thread the id through dispatch** — in `app.py`:
  - `create_run`: change the dispatch call to `self._dispatch_run(run.id, request.task.strip(), request.permissionMode, request.planFirst, reasoning, request.externalAgentId)`.
  - `_dispatch_run(self, run_id, task, permission_mode, plan_first, reasoning="medium", external_agent_id: str | None = None)`: sync path `self.start_run(run_id, task, permission_mode, plan_first, reasoning, external_agent_id)`; queue path `self._run_queue.put((run_id, task, permission_mode, plan_first, reasoning, external_agent_id))`.
  - `_run_worker`: unpack `run_id, task, permission_mode, plan_first, reasoning, external_agent_id = item` and call `self.start_run(run_id, task, permission_mode, plan_first, reasoning, external_agent_id)`.
  - `start_run(self, run_id, task, permission_mode, plan_first=False, reasoning="medium", external_agent_id: str | None = None)`: at the top of the `try`, branch:

```python
        try:
            if external_agent_id:
                self._run_via_external_agent(run_id, task, external_agent_id)
            else:
                self.graph.start(run_id, task, permission_mode, plan_first, reasoning)
            logger.info("run %s finished in %.1fs", run_id, time.monotonic() - started)
        except Exception:  # noqa: BLE001
            ...  # existing crash handling unchanged
```

- [ ] **Step 5: Implement the routing** in `RuntimeService`:

```python
    _ACP_SESSION_TIMEOUT = 30.0
    _ACP_PROMPT_TIMEOUT = 300.0

    def _fail_run(self, run_id: str, message: str, error: str) -> None:
        self.storage.update_run(run_id, status="failed", result_summary=message, completed=True)
        self.storage.append_event("run.failed", run_id=run_id, payload={"summary": message, "error": error})

    def _run_via_external_agent(self, run_id: str, task: str, agent_id: str) -> None:
        connection = self.acp.live_state(agent_id)
        if connection is None or connection.status != "connected":
            resolved = self.storage.get_ai_integrations_resolved()
            agent = next((item for item in resolved.externalAgents if item.id == agent_id), None)
            if agent is None:
                self._fail_run(run_id, "External agent not found.", "external_agent_not_found")
                return
            try:
                connection = self.acp.connect(agent)
            except ValueError as exc:
                self._fail_run(run_id, str(exc), "external_agent_failed")
                return
        if connection.status != "connected":
            self._fail_run(run_id, connection.error or "External agent failed to connect.", "external_agent_failed")
            return
        try:
            session_id = connection.new_session(timeout=self._ACP_SESSION_TIMEOUT)
            answer = connection.prompt(session_id, task, timeout=self._ACP_PROMPT_TIMEOUT)
        except (TimeoutError, ConnectionError, OSError) as exc:
            self._fail_run(run_id, f"External agent error: {exc}", "external_agent_failed")
            return
        self.storage.update_run(run_id, status="completed", result_summary=answer, completed=True)
        self.storage.append_event("run.completed", run_id=run_id, payload={"summary": answer, "executor": f"external_agent:{agent_id}"})
```

- [ ] **Step 6: Run the two tests → PASS; full suite green.**
- [ ] **Step 7: Commit**

```bash
git add runtime/python/yanshi_runtime/models.py runtime/python/yanshi_runtime/server/app.py runtime/python/tests/test_runtime.py
git commit -m "$(printf 'feat(runtime): route a run to a connected external ACP agent\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>')"
```

---

### Task 3: Frontend — "Run a task" on a connected agent

**Files:**
- Modify: `apps/desktop/src/api/client.ts` (`createRun` body includes `externalAgentId`)
- Modify: `apps/desktop/src/stores/runtimeStore.ts` (`createRun` signature carries `externalAgentId`)
- Modify: `apps/desktop/src/features/ai-integrations.tsx` (connected External Agent → "Run a task" → prompt → createRun)
- Modify: `apps/desktop/src/i18n/en.ts` + `zh.ts`
- Test: `apps/desktop/src/features/ai-integrations.test.tsx`

**Interfaces:**
- Consumes: `POST /runs` now accepting `externalAgentId` (Task 2).
- Produces: `runtimeApi.createRun(..., externalAgentId?)`; store `createRun` carries `externalAgentId`; connected agents render a "Run a task" control that creates a routed run.

- [ ] **Step 1: Client + store** — find the existing `createRun` in `client.ts` (it already has `parentRunId`); add `externalAgentId?: string | null` to its body params. Mirror in `runtimeStore.ts`'s `createRun` action signature + pass-through.
- [ ] **Step 2: Write the failing vitest** — render the External Agents section with a mocked store whose `aiIntegrations.externalAgents` has a `status:"connected"` agent + `createRun` spy; assert a "Run a task" control appears for the connected agent (by `t("integrations.runTask")` accessible name), and NOT for a disconnected one. (Mirror the existing MCP/External-Agents test setup; confirm the real component + store field shape first.)
- [ ] **Step 3: Run to verify it fails.**
- [ ] **Step 4: Implement** — in the External Agents rows, when an agent is `connected`, render a "Run a task" `IconAction`/button. Clicking it opens a minimal prompt (reuse an existing small input/modal pattern in the codebase, or a window-less inline input) for the task text, then calls `createRun({ task, externalAgentId: agent.id })` and navigates to the chat view (mirror how the composer/new-task triggers a run + navigation). New i18n keys (`integrations.runTask`, plus any prompt labels) in BOTH `en.ts` and `zh.ts`.
- [ ] **Step 5: Run the test + full gate** — `npx vitest run src/features/ai-integrations.test.tsx` PASS; `npm run lint && npx vitest run` → tsc clean + all green (incl. i18n parity).
- [ ] **Step 6: Commit**

```bash
git add apps/desktop/src/api/client.ts apps/desktop/src/stores/runtimeStore.ts apps/desktop/src/features/ai-integrations.tsx apps/desktop/src/features/ai-integrations.test.tsx apps/desktop/src/i18n/en.ts apps/desktop/src/i18n/zh.ts
git commit -m "$(printf 'feat(desktop): run a task via a connected external ACP agent\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>')"
```

---

## Self-Review

**Spec coverage:** §4.1 ACP `new_session`/`prompt` + chunk collection → Task 1. §4.2 run routing (`externalAgentId`, dispatch threading, `_run_via_external_agent` writing result_summary+event, honest failure) → Task 2. §4.3 create_run passthrough → Task 2. §5 frontend "Run a task" on connected agents → Task 3. §6 honesty/security (connected-only, honest failure, ignore non-message updates, env in SecretStore) → Task 1 (`_agent_chunk_text` ignores tool updates) + Task 2 (connected-only, `_fail_run`). §7 tests (extended fake agent, prompt collection, routing, honest failure, UI) → all tasks. ✅

**Placeholder scan:** Complete code in code steps. Steps that say "confirm a real shape first" (the run-summary field name + `synchronous_runs` in Task 2 Step 1; the real component/store shape + the prompt-input pattern in Task 3) are verify-against-real-code, not missing content. Task 3 Step 4's "reuse an existing small input/modal pattern" names a concrete choice (an existing pattern) rather than inventing UI — the implementer picks the matching in-repo pattern.

**Type consistency:** `_agent_chunk_text`/`new_session`/`prompt` (Task 1) consumed by `_run_via_external_agent` (Task 2). `externalAgentId` (camelCase) consistent across `CreateRunRequest` → API → client → store → UI; `external_agent_id` (snake) consistent through `_dispatch_run`/queue/`start_run`/`_run_via_external_agent`. Completion uses `update_run(..., result_summary=, completed=True)` + `append_event("run.completed"/"run.failed", ...)` matching the graph finalizer exactly.

**Scope:** Single plan (layer 1). Tool/permission call-back, multi-turn sessions, and custom protocol are out of scope and unreferenced by any task.
