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
