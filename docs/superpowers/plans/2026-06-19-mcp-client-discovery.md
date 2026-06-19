# MCP Client Discovery (Layer A) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give Yanshi a real MCP client that connects to a configured stdio MCP server, performs the `initialize` handshake, and discovers its tools via `tools/list` — surfacing the live connected status + discovered tools in the AI Integrations UI (turning today's config-only stub into a real "connected, N tools" state).

**Architecture:** A hand-rolled synchronous stdio JSON-RPC client mirroring `acp.py` (`McpConnection` for one connection's protocol, `McpManager` for lifecycle). The `RuntimeService` holds the manager and exposes connect/disconnect (mirroring the External Agents path); live status + discovered tools are overlaid on read and never persisted (exactly like ACP capabilities). stdio only; tool invocation, http/sse, and agent use of MCP tools are out of scope (Layer B).

**Tech Stack:** Python 3.12, stdlib `subprocess` + `json` + `threading` (no new deps), FastAPI; TypeScript/React/Zustand/Vitest frontend; pytest.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-06-19-mcp-client-discovery-design.md`.
- **Mirror `acp.py` / the External Agents path exactly** — same sync line-delimited JSON-RPC, same manager shape, same connect/disconnect service + endpoint structure, same "live state overlaid on read, never persisted" rule.
- **stdio transport only.** A non-stdio or command-less server connect raises `ValueError` → HTTP 400 (honest, not silent). HTTP/SSE stay `not_implemented`.
- **No faked tools.** Only tools the server reports via `tools/list` are surfaced. Discovered tools are LIVE-overlaid (not persisted) — shown only while connected.
- **Secrets:** `env` values are resolved from SecretStore only to inject into the child process at connect; never logged, never returned raw (`get_ai_integrations` always masks).
- The real storage class is `Storage(database_path, runtime_version)`. Run pytest as `cd runtime/python && .venv/bin/python -m pytest -p no:cacheprovider`. Frontend gate: `cd apps/desktop && npm run lint && npx vitest run`.
- Commit messages end with: `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.

---

### Task 1: `mcp_client.py` — McpConnection + McpManager (handshake + discovery)

**Files:**
- Create: `runtime/python/yanshi_runtime/mcp_client.py`
- Create: `runtime/python/tests/fixtures/fake_mcp_server.py` (a tiny real stdio MCP server for tests)
- Test: `runtime/python/tests/test_runtime.py` (or a new `tests/test_mcp_client.py`)

**Interfaces:**
- Consumes: `McpServerConfig` (`yanshi_runtime.models`); `IntegrationStatus`.
- Produces:
  - `McpToolInfo(name: str, description: str | None = None)` (dataclass)
  - `McpConnection` (dataclass): `.process`, `.status: IntegrationStatus`, `.tools: list[McpToolInfo]`, `.protocol_version: str | None`, `.error: str | None`; `.request(method, params, timeout) -> dict`, `.notify(method, params) -> None`, `.close() -> None`
  - `McpManager`: `.connect(server: McpServerConfig) -> McpConnection`, `.disconnect(server_id: str) -> None`, `.live_state(server_id: str) -> McpConnection | None`, `.shutdown() -> None`
  - module constants `MCP_PROTOCOL_VERSION = "2024-11-05"`, `MCP_CLIENT_VERSION` (reuse the runtime version string if one is imported; else `"0.1.0"`), `HANDSHAKE_TIMEOUT_SECONDS = 10.0`

- [ ] **Step 1: Write the fake MCP server fixture**

```python
# runtime/python/tests/fixtures/fake_mcp_server.py
"""Minimal stdio MCP server for tests: speaks line-delimited JSON-RPC.

initialize -> protocolVersion + serverInfo; notifications/initialized -> (no reply);
tools/list -> two tools. Run via `python fake_mcp_server.py`; reads stdin lines.
An optional arg "crash" makes it exit immediately (to exercise the failure path).
"""
import json
import sys


def main() -> None:
    if len(sys.argv) > 1 and sys.argv[1] == "crash":
        return  # exit immediately: the client sees a closed pipe
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        msg = json.loads(line)
        method = msg.get("method")
        if method == "notifications/initialized":
            continue  # notification: no response
        if method == "initialize":
            reply = {"protocolVersion": "2024-11-05", "serverInfo": {"name": "fake", "version": "0"}, "capabilities": {"tools": {}}}
        elif method == "tools/list":
            reply = {"tools": [{"name": "echo", "description": "Echo text"}, {"name": "add", "description": "Add numbers"}]}
        else:
            reply = {}
        sys.stdout.write(json.dumps({"jsonrpc": "2.0", "id": msg.get("id"), "result": reply}) + "\n")
        sys.stdout.flush()


if __name__ == "__main__":
    main()
```

- [ ] **Step 2: Write the failing test**

```python
# runtime/python/tests/test_runtime.py  (add near the other integration tests)
import sys
from pathlib import Path
from yanshi_runtime.mcp_client import McpManager
from yanshi_runtime.models import McpServerConfig

_FAKE_MCP = Path(__file__).parent / "fixtures" / "fake_mcp_server.py"


def _stdio_server(server_id: str, *extra_args: str) -> McpServerConfig:
    return McpServerConfig(
        id=server_id, name="Fake", transport="stdio",
        command=sys.executable, args=[str(_FAKE_MCP), *extra_args], enabled=True,
    )


def test_mcp_manager_connects_handshakes_and_discovers_tools() -> None:
    manager = McpManager()
    try:
        conn = manager.connect(_stdio_server("mcp_fake"))
        assert conn.status == "connected"
        assert conn.protocol_version == "2024-11-05"
        assert [t.name for t in conn.tools] == ["echo", "add"]
        assert manager.live_state("mcp_fake") is conn
    finally:
        manager.shutdown()


def test_mcp_manager_disconnect_clears_live_state() -> None:
    manager = McpManager()
    manager.connect(_stdio_server("mcp_fake2"))
    manager.disconnect("mcp_fake2")
    assert manager.live_state("mcp_fake2") is None
    manager.shutdown()


def test_mcp_connect_failure_is_honest() -> None:
    manager = McpManager()
    try:
        conn = manager.connect(_stdio_server("mcp_crash", "crash"))
        assert conn.status == "error"
        assert conn.error
        assert conn.tools == []
    finally:
        manager.shutdown()


def test_mcp_connect_rejects_non_stdio_and_commandless() -> None:
    import pytest
    manager = McpManager()
    with pytest.raises(ValueError):
        manager.connect(McpServerConfig(id="h", name="H", transport="http", url="http://x"))
    with pytest.raises(ValueError):
        manager.connect(McpServerConfig(id="n", name="N", transport="stdio", command=None))
    manager.shutdown()
```

- [ ] **Step 3: Run tests to verify they fail** — `cd runtime/python && .venv/bin/python -m pytest -p no:cacheprovider tests/test_runtime.py -k mcp -q` → FAIL (module `mcp_client` not found).

- [ ] **Step 4: Implement `mcp_client.py`** (mirror `acp.py`'s `AcpConnection.request`/`close` and `AcpManager` verbatim in structure; add `notify` + `tools/list`):

```python
# runtime/python/yanshi_runtime/mcp_client.py
from __future__ import annotations

import json
import os
import shlex
import subprocess
import threading
from dataclasses import dataclass, field

from yanshi_runtime.models import IntegrationStatus, McpServerConfig

MCP_PROTOCOL_VERSION = "2024-11-05"
MCP_CLIENT_VERSION = "0.1.0"
HANDSHAKE_TIMEOUT_SECONDS = 10.0


@dataclass
class McpToolInfo:
    name: str
    description: str | None = None


@dataclass
class McpConnection:
    """One launched stdio MCP server with a completed (or failed) handshake + tool discovery."""

    process: subprocess.Popen[str] | None
    status: IntegrationStatus = "starting"
    tools: list[McpToolInfo] = field(default_factory=list)
    protocol_version: str | None = None
    error: str | None = None
    _next_id: int = 1
    _lock: threading.Lock = field(default_factory=threading.Lock)

    def request(self, method: str, params: dict, timeout: float) -> dict:
        """Send one JSON-RPC request and block for its response (single-flight, line-delimited)."""
        with self._lock:
            request_id = self._next_id
            self._next_id += 1
            message = json.dumps({"jsonrpc": "2.0", "id": request_id, "method": method, "params": params})
            if self.process is None or self.process.stdin is None or self.process.stdout is None:
                raise ConnectionError("The MCP server process is not running.")
            self.process.stdin.write(message + "\n")
            self.process.stdin.flush()

            result: dict[str, object] = {}
            failure: list[str] = []
            stdout = self.process.stdout

            def read_response() -> None:
                while True:
                    line = stdout.readline()
                    if not line:
                        failure.append("The MCP server closed its output before responding.")
                        return
                    line = line.strip()
                    if not line:
                        continue
                    try:
                        payload = json.loads(line)
                    except json.JSONDecodeError:
                        continue  # servers may log to stdout before JSON-RPC; skip
                    if payload.get("id") == request_id:
                        result.update(payload)
                        return

            reader = threading.Thread(target=read_response, daemon=True)
            reader.start()
            reader.join(timeout)
            if reader.is_alive():
                raise TimeoutError(f"No response to {method} within {timeout:.0f}s.")
            if failure:
                raise ConnectionError(failure[0])
            if "error" in result:
                error = result["error"]
                detail = error.get("message", str(error)) if isinstance(error, dict) else str(error)
                raise ConnectionError(f"MCP server returned an error for {method}: {detail}")
            value = result.get("result")
            return value if isinstance(value, dict) else {}

    def notify(self, method: str, params: dict) -> None:
        """Send a JSON-RPC notification (no id, no response expected)."""
        with self._lock:
            if self.process is None or self.process.stdin is None:
                raise ConnectionError("The MCP server process is not running.")
            message = json.dumps({"jsonrpc": "2.0", "method": method, "params": params})
            self.process.stdin.write(message + "\n")
            self.process.stdin.flush()

    def close(self) -> None:
        if self.process is None:
            return
        try:
            if self.process.poll() is None:
                self.process.terminate()
                try:
                    self.process.wait(timeout=3)
                except subprocess.TimeoutExpired:
                    self.process.kill()
        except OSError:
            pass


def _parse_tools(result: dict) -> list[McpToolInfo]:
    tools: list[McpToolInfo] = []
    for item in result.get("tools", []):
        if isinstance(item, dict) and isinstance(item.get("name"), str):
            desc = item.get("description")
            tools.append(McpToolInfo(name=item["name"], description=desc if isinstance(desc, str) else None))
    return tools


class McpManager:
    """Holds live MCP connections keyed by server id. Live state is never persisted."""

    def __init__(self) -> None:
        self._connections: dict[str, McpConnection] = {}
        self._lock = threading.Lock()

    def connect(self, server: McpServerConfig) -> McpConnection:
        """Launch the stdio server, handshake, and list tools. Raises ValueError for configs this
        build cannot serve (non-stdio / no command) — honest, not silent."""
        if server.transport != "stdio":
            raise ValueError("Only stdio MCP servers can be connected in this build.")
        if not server.command:
            raise ValueError("The MCP server has no launch command configured.")

        self.disconnect(server.id)

        env = {**os.environ, **server.env}
        try:
            argv = shlex.split(server.command) + list(server.args)
            if not argv:
                raise ValueError("Empty launch command.")
            process = subprocess.Popen(
                argv,
                stdin=subprocess.PIPE,
                stdout=subprocess.PIPE,
                stderr=subprocess.DEVNULL,
                text=True,
                env=env,
                start_new_session=True,
            )
        except (OSError, ValueError) as exc:
            connection = McpConnection(process=None, status="error", error=f"Could not launch: {exc}")
            with self._lock:
                self._connections[server.id] = connection
            return connection

        connection = McpConnection(process=process)
        with self._lock:
            self._connections[server.id] = connection
        try:
            result = connection.request(
                "initialize",
                {
                    "protocolVersion": MCP_PROTOCOL_VERSION,
                    "capabilities": {},
                    "clientInfo": {"name": "yanshi", "version": MCP_CLIENT_VERSION},
                },
                timeout=HANDSHAKE_TIMEOUT_SECONDS,
            )
            version = result.get("protocolVersion")
            connection.protocol_version = version if isinstance(version, str) else None
            connection.notify("notifications/initialized", {})

            discovered: list[McpToolInfo] = []
            cursor: str | None = None
            for _ in range(50):  # bound pagination
                params = {"cursor": cursor} if cursor else {}
                listed = connection.request("tools/list", params, timeout=HANDSHAKE_TIMEOUT_SECONDS)
                discovered.extend(_parse_tools(listed))
                nxt = listed.get("nextCursor")
                if not isinstance(nxt, str) or not nxt:
                    break
                cursor = nxt
            connection.tools = discovered
            connection.status = "connected"
        except (TimeoutError, ConnectionError, OSError, BrokenPipeError, ValueError) as exc:
            connection.status = "error"
            connection.error = str(exc)
            connection.close()
        return connection

    def disconnect(self, server_id: str) -> None:
        with self._lock:
            connection = self._connections.pop(server_id, None)
        if connection is not None:
            connection.close()

    def live_state(self, server_id: str) -> McpConnection | None:
        with self._lock:
            return self._connections.get(server_id)

    def shutdown(self) -> None:
        with self._lock:
            connections = list(self._connections.values())
            self._connections.clear()
        for connection in connections:
            connection.close()
```

(If `IntegrationStatus` is not importable from `yanshi_runtime.models`, import it from wherever `acp.py` imports it — match `acp.py`'s imports.)

- [ ] **Step 5: Run tests to verify they pass** — `cd runtime/python && .venv/bin/python -m pytest -p no:cacheprovider tests/test_runtime.py -k mcp -q` → PASS (4 tests).
- [ ] **Step 6: Run the full suite** — `cd runtime/python && .venv/bin/python -m pytest -p no:cacheprovider -p no:warnings 2>/dev/null | grep -E "passed|failed"` → all green.
- [ ] **Step 7: Commit**

```bash
git add runtime/python/yanshi_runtime/mcp_client.py runtime/python/tests/fixtures/fake_mcp_server.py runtime/python/tests/test_runtime.py
git commit -m "$(printf 'feat(runtime): synchronous stdio MCP client with handshake + tool discovery\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>')"
```

---

### Task 2: Service connect/disconnect + honest status + endpoints

**Files:**
- Modify: `runtime/python/yanshi_runtime/server/app.py` (`RuntimeService.__init__` ~L109 holds the manager; `shutdown` ~L190 + the `shutdown_acp` on_event ~L795; add `_overlay_mcp_state`, `connect_mcp_server`, `disconnect_mcp_server`; extend `update_ai_integrations` to drop removed MCP connections and overlay MCP on read; add two endpoints near L847-851)
- Modify: `runtime/python/yanshi_runtime/storage.py` (`_with_honest_integration_statuses` MCP branch, ~L113-120)
- Test: `runtime/python/tests/test_runtime.py`

**Interfaces:**
- Consumes: `McpManager`, `McpConnection` from Task 1; `storage.get_ai_integrations_resolved()` / `get_ai_integrations()` (masked); the existing `_overlay_acp_state` as the pattern.
- Produces:
  - `RuntimeService.connect_mcp_server(server_id: str) -> AiIntegrationsConfig`
  - `RuntimeService.disconnect_mcp_server(server_id: str) -> AiIntegrationsConfig`
  - `RuntimeService._overlay_mcp_state(config) -> AiIntegrationsConfig` (overlays live `status` + tool names onto `config.mcpServers`)
  - `POST /settings/integrations/mcp/{server_id}/connect` and `/disconnect` → `AiIntegrationsConfig`
  - `ai_integrations()` and `update_ai_integrations()` now overlay BOTH acp and mcp state on read.

- [ ] **Step 1: Write the failing test**

```python
# runtime/python/tests/test_runtime.py — uses make_client(tmp_path) + the fake server
def test_mcp_connect_endpoint_discovers_tools_and_status(tmp_path: Path) -> None:
    client = make_client(tmp_path)
    # Configure one stdio MCP server pointing at the fake server.
    client.put("/settings/integrations", json={"mcpServers": [{
        "id": "mcp_fake", "name": "Fake", "transport": "stdio",
        "command": sys.executable, "args": [str(_FAKE_MCP)], "enabled": True,
    }]})
    # At rest, a command-having stdio server is "configured" (connectable), not "not_implemented".
    at_rest = client.get("/settings/integrations").json()
    assert at_rest["mcpServers"][0]["status"] == "configured"

    connected = client.post("/settings/integrations/mcp/mcp_fake/connect").json()
    server = connected["mcpServers"][0]
    assert server["status"] == "connected"
    assert server["tools"] == ["echo", "add"]

    disconnected = client.post("/settings/integrations/mcp/mcp_fake/disconnect").json()
    assert disconnected["mcpServers"][0]["status"] == "configured"
    assert disconnected["mcpServers"][0]["tools"] == []  # live tools cleared on disconnect


def test_mcp_http_server_stays_not_implemented(tmp_path: Path) -> None:
    client = make_client(tmp_path)
    client.put("/settings/integrations", json={"mcpServers": [{
        "id": "mcp_http", "name": "H", "transport": "http", "url": "https://example.com/mcp", "enabled": True,
    }]})
    at_rest = client.get("/settings/integrations").json()
    assert at_rest["mcpServers"][0]["status"] == "not_implemented"
```

(Add `import sys` and the `_FAKE_MCP` path near the top of the test module if not already present from Task 1.)

- [ ] **Step 2: Run to verify it fails** — `… -k "mcp_connect_endpoint or mcp_http_server"` → FAIL (no endpoint; status is `not_implemented` at rest).

- [ ] **Step 3: Honest status in `storage.py`** — find the MCP branch in `_with_honest_integration_statuses` (the loop over `config.mcpServers`, ~L113-120, currently sets `server.status = "not_implemented" if connectable else "not_configured"`). Change it so a stdio server WITH a command is `"configured"`, an http/sse or command-less entry stays `"not_implemented"`/`"not_configured"`:

```python
        for server in config.mcpServers:
            has_stdio_command = server.transport == "stdio" and bool(server.command)
            if has_stdio_command:
                server.status = "configured"        # connectable: a real client can launch + discover
            elif server.url or server.command:
                server.status = "not_implemented"   # http/sse or other transports have no client yet
            else:
                server.status = "not_configured"
            server.tools = []                        # discovered tools are live-only, never persisted
```

(Match the exact variable names / surrounding code in that function; keep the existing ACP branch untouched.)

- [ ] **Step 4: Service layer in `app.py`** — in `RuntimeService.__init__`, after `self.acp = AcpManager()`, add `self.mcp = McpManager()` (import `from yanshi_runtime.mcp_client import McpManager`). In `shutdown`, after `self.acp.shutdown()`, add `self.mcp.shutdown()` (and in the module-level `shutdown_acp` on_event ~L795 if it calls service shutdown, no change needed — verify). Add the overlay + connect/disconnect, mirroring `_overlay_acp_state`/`connect_external_agent`/`disconnect_external_agent`:

```python
    def _overlay_mcp_state(self, config: AiIntegrationsConfig) -> AiIntegrationsConfig:
        """Overlay live MCP connection state (never persisted) on the honest stored baseline."""
        for server in config.mcpServers:
            live = self.mcp.live_state(server.id)
            if live is not None:
                server.status = live.status
                server.tools = [tool.name for tool in live.tools]
        return config

    def connect_mcp_server(self, server_id: str) -> AiIntegrationsConfig:
        resolved = self.storage.get_ai_integrations_resolved()
        server = next((item for item in resolved.mcpServers if item.id == server_id), None)
        if server is None:
            raise HTTPException(status_code=404, detail="MCP server not found.")
        try:
            connection = self.mcp.connect(server)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        self.storage.append_event(
            "runtime.status.changed",
            payload={"status": "mcp.connection", "serverId": server_id, "result": connection.status},
        )
        return self._overlay_mcp_state(self._overlay_acp_state(self.storage.get_ai_integrations()))

    def disconnect_mcp_server(self, server_id: str) -> AiIntegrationsConfig:
        self.mcp.disconnect(server_id)
        return self._overlay_mcp_state(self._overlay_acp_state(self.storage.get_ai_integrations()))
```

Update the existing read paths so MCP is overlaid too: in `ai_integrations()` (the method returning `self._overlay_acp_state(...)` ~L452) wrap with `_overlay_mcp_state`, and in `update_ai_integrations` (the final `return self._overlay_acp_state(config)` ~L500) wrap with `_overlay_mcp_state`. Also in `update_ai_integrations`, mirror the ACP "drop removed connections" block for MCP:

```python
        if request.mcpServers is not None:
            kept_mcp = {server.id for server in request.mcpServers}
            for server in self.storage.get_ai_integrations().mcpServers:
                if server.id not in kept_mcp:
                    self.mcp.disconnect(server.id)
```

- [ ] **Step 5: Endpoints** — next to the external-agent connect/disconnect endpoints (~L847-851):

```python
    @app.post("/settings/integrations/mcp/{server_id}/connect", response_model=AiIntegrationsConfig)
    def connect_mcp_server(server_id: str, service: RuntimeService = Depends(service_dep)):
        return service.connect_mcp_server(server_id)

    @app.post("/settings/integrations/mcp/{server_id}/disconnect", response_model=AiIntegrationsConfig)
    def disconnect_mcp_server(server_id: str, service: RuntimeService = Depends(service_dep)):
        return service.disconnect_mcp_server(server_id)
```

- [ ] **Step 6: Run the two tests, then the full suite** — `… -k "mcp"` → PASS; then full suite green.
- [ ] **Step 7: Commit**

```bash
git add runtime/python/yanshi_runtime/server/app.py runtime/python/yanshi_runtime/storage.py runtime/python/tests/test_runtime.py
git commit -m "$(printf 'feat(runtime): MCP connect/disconnect endpoints with live status + tool overlay\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>')"
```

---

### Task 3: Frontend — AI Integrations MCP section (connect + discovered tools)

**Files:**
- Modify: `apps/desktop/src/api/client.ts` (add `connectMcpServer`/`disconnectMcpServer`)
- Modify: `apps/desktop/src/stores/runtimeStore.ts` (add `connectMcpServer`/`disconnectMcpServer` actions, mirroring `connectExternalAgent`/`disconnectExternalAgent`)
- Modify: `apps/desktop/src/features/ai-integrations.tsx` (MCP server rows: Connect/Disconnect button + live status + discovered tool chips)
- Test: `apps/desktop/src/features/ai-integrations.test.tsx` (or extend an existing test)

**Interfaces:**
- Consumes: `POST /settings/integrations/mcp/{id}/connect|disconnect` (Task 2); `McpServerConfig` (`@yanshi/shared`, already has `status` + `tools: string[]`).
- Produces:
  - `runtimeApi.connectMcpServer(id: string)` / `disconnectMcpServer(id: string)` → `AiIntegrationsConfig`
  - store actions `connectMcpServer(id)` / `disconnectMcpServer(id)` that set `aiIntegrations` from the response (mirror `connectExternalAgent`)
  - MCP section renders a connect/disconnect control per server + `tools` as chips.

- [ ] **Step 1: Client methods** — mirror the external-agent ones in `client.ts` (find `connectExternalAgent`):

```typescript
  connectMcpServer: (id: string) =>
    request<AiIntegrationsConfig>(`/settings/integrations/mcp/${id}/connect`, { method: "POST", body: "{}" }),
  disconnectMcpServer: (id: string) =>
    request<AiIntegrationsConfig>(`/settings/integrations/mcp/${id}/disconnect`, { method: "POST", body: "{}" }),
```

- [ ] **Step 2: Store actions** — mirror `connectExternalAgent` in `runtimeStore.ts`:

```typescript
  connectMcpServer: async (id) => {
    const aiIntegrations = await runtimeApi.connectMcpServer(id);
    set({ aiIntegrations });
  },
  disconnectMcpServer: async (id) => {
    const aiIntegrations = await runtimeApi.disconnectMcpServer(id);
    set({ aiIntegrations });
  },
```

Add their signatures to the store interface: `connectMcpServer: (id: string) => Promise<void>; disconnectMcpServer: (id: string) => Promise<void>;`.

- [ ] **Step 3: Write the failing vitest** — `apps/desktop/src/features/ai-integrations.test.tsx` (jsdom):

```tsx
// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("../i18n", () => ({ useT: () => ({ t: (k: string) => k }) }));
// Mock the store hook to return a connected MCP server with discovered tools.
vi.mock("../stores/runtimeStore", () => ({
  useRuntimeStore: () => ({
    aiIntegrations: { externalAgents: [], mcpServers: [
      { id: "m1", name: "Fake", transport: "stdio", command: "x", args: [], env: {}, enabled: true, status: "connected", tools: ["echo", "add"] },
    ] },
    loadAiIntegrations: vi.fn(), saveAiIntegrations: vi.fn(),
    connectMcpServer: vi.fn(), disconnectMcpServer: vi.fn(),
    connectExternalAgent: vi.fn(), disconnectExternalAgent: vi.fn(),
  }),
}));

import { AiIntegrationsSection } from "./ai-integrations"; // use the real exported component name

describe("MCP section", () => {
  it("renders discovered tools as chips for a connected server", () => {
    render(<AiIntegrationsSection />);
    expect(screen.getByText("echo")).toBeInTheDocument();
    expect(screen.getByText("add")).toBeInTheDocument();
  });
});
```

(Confirm the real exported component name + the store hook shape in `ai-integrations.tsx` before finalizing the mock — adjust the import/mock to match. If the component reads more store fields, add them to the mock so it renders.)

- [ ] **Step 4: Run to verify it fails** — `cd apps/desktop && npx vitest run src/features/ai-integrations.test.tsx` → FAIL (tools not rendered).

- [ ] **Step 5: Implement the MCP section UI** — in `ai-integrations.tsx`, for each `aiIntegrations.mcpServers` server, render (mirroring the External Agents rows): the name + a Connect button (`status !== "connected"`) / Disconnect button (`status === "connected"`) calling `connectMcpServer(server.id)` / `disconnectMcpServer(server.id)`, the status badge (reuse the existing `integrations.status.*` rendering), and when `server.tools.length > 0` a row of tool chips (`server.tools.map(name => <span className="flag-chip">{name}</span>)`). Only render chips from `server.tools` — never a hardcoded list. Add any new i18n keys (e.g. `integrations.mcp.connect`/`disconnect`/`tools`) to BOTH `en.ts` and `zh.ts`.

- [ ] **Step 6: Run the test + full gate** — `cd apps/desktop && npx vitest run src/features/ai-integrations.test.tsx` PASS; then `npm run lint && npx vitest run 2>&1 | tail -6` → tsc clean + all green (incl. i18n parity).

- [ ] **Step 7: Commit**

```bash
git add apps/desktop/src/api/client.ts apps/desktop/src/stores/runtimeStore.ts apps/desktop/src/features/ai-integrations.tsx apps/desktop/src/features/ai-integrations.test.tsx apps/desktop/src/i18n/en.ts apps/desktop/src/i18n/zh.ts
git commit -m "$(printf 'feat(desktop): MCP server connect/disconnect + discovered tool chips\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>')"
```

---

## Self-Review

**Spec coverage:** §4 client (McpConnection/McpManager/handshake/tools-list/pagination) → Task 1. §5 service connect/disconnect + endpoints → Task 2. §5.1 honest status (stdio+command → "configured"; url-only → "not_implemented") → Task 2 Step 3 + its test. §6 security (user-authorized stdio launch; env from resolved config, masked on return; kill on disconnect/shutdown) → Tasks 1 (close/shutdown) + 2 (resolved→connect, masked get). §7 frontend (connect + tool chips, no faked tools) → Task 3. §8 tests (fake server, lifecycle, service, honest status, vitest) → all tasks. Refinement vs spec §5/§11: discovered tools are **live-overlaid, not persisted** (consistent with ACP capabilities; tools cleared on disconnect) — the test asserts this. ✅

**Placeholder scan:** Complete code in every code step. Three steps ask the implementer to *confirm an existing name/shape before finalizing* (the `IntegrationStatus` import source in Task 1; the exact `_with_honest_integration_statuses` MCP branch in Task 2 Step 3; the real `ai-integrations.tsx` component/store shape in Task 3 Step 3) — these are verify-against-real-code instructions, not missing content.

**Type consistency:** `McpConnection`/`McpManager`/`McpToolInfo` defined in Task 1 are used with the same signatures in Task 2. `connect_mcp_server`/`disconnect_mcp_server`/`_overlay_mcp_state` defined in Task 2 are consumed by the endpoints + Task 3's client paths. `McpServerConfig.tools` is `list[str]` (names) in both the overlay (Task 2) and the UI chips (Task 3). `connectMcpServer`/`disconnectMcpServer` names match across client → store → component.

**Scope:** Single cohesive plan (Layer A: discovery). Layer B (tools/call, http/sse, agent invocation) explicitly out of scope and not referenced by any task.
