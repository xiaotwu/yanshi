"""Minimal real ACP (Agent Client Protocol) foundation.

Scope — and only this scope — is implemented:
- launch a configured agent process and speak JSON-RPC 2.0 over stdio (newline-delimited),
- perform the ACP ``initialize`` handshake and record the capabilities the agent reports,
- expose an honest connection lifecycle: configured -> starting -> connected | error.

Not implemented (and never faked): prompt routing, tool/permission events, session management,
endpoint (non-stdio) transports. Capabilities come exclusively from a live handshake response;
nothing is invented and nothing live is persisted.
"""

from __future__ import annotations

import json
import os
import shlex
import subprocess
import threading
from dataclasses import dataclass, field

from .models import ExternalAgentConfig, IntegrationStatus

ACP_PROTOCOL_VERSION = 1
HANDSHAKE_TIMEOUT_SECONDS = 15.0


def _flatten_capabilities(value: object, prefix: str = "") -> list[str]:
    """Flatten the agent's reported capability object into readable badge strings.

    ``{"loadSession": true, "promptCapabilities": {"image": true, "audio": false}}`` becomes
    ``["loadSession", "promptCapabilities.image"]`` — only truthy leaves are listed.
    """
    found: list[str] = []
    if isinstance(value, dict):
        for key, sub in value.items():
            path = f"{prefix}.{key}" if prefix else str(key)
            found.extend(_flatten_capabilities(sub, path))
    elif value:
        found.append(prefix)
    return found


@dataclass
class AcpConnection:
    """One launched ACP agent process with a completed (or failed) initialize handshake."""

    process: subprocess.Popen[str] | None
    status: IntegrationStatus = "starting"
    capabilities: list[str] = field(default_factory=list)
    protocol_version: int | None = None
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
                raise ConnectionError("The agent process is not running.")
            self.process.stdin.write(message + "\n")
            self.process.stdin.flush()

            result: dict[str, object] = {}
            failure: list[str] = []

            stdout = self.process.stdout

            def read_response() -> None:
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
                        # Agents may write logs to stdout before speaking JSON-RPC; skip those lines.
                        continue
                    if payload.get("id") == request_id:
                        result.update(payload)
                        return
                    # Notifications or unrelated responses are ignored by this minimal client.

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
                raise ConnectionError(f"Agent returned an error for {method}: {detail}")
            value = result.get("result")
            return value if isinstance(value, dict) else {}

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


class AcpManager:
    """Holds live ACP connections keyed by external-agent id. Live state is never persisted."""

    def __init__(self) -> None:
        self._connections: dict[str, AcpConnection] = {}
        self._lock = threading.Lock()

    def connect(self, agent: ExternalAgentConfig) -> AcpConnection:
        """Launch the agent and run the initialize handshake. Raises ValueError for configs the
        foundation cannot serve (no command / non-ACP protocol) — honest, not silent."""
        if agent.protocol != "acp":
            raise ValueError("Only ACP-protocol agents can be connected.")
        if not agent.command:
            raise ValueError("The agent has no launch command configured.")

        self.disconnect(agent.id)

        env = {**os.environ, **agent.env}
        try:
            argv = shlex.split(agent.command) + list(agent.args)
            if not argv:
                raise ValueError("Empty launch command.")
            process = subprocess.Popen(
                argv,
                stdin=subprocess.PIPE,
                stdout=subprocess.PIPE,
                stderr=subprocess.DEVNULL,
                text=True,
                env=env,
            )
        except (OSError, ValueError) as exc:
            connection = AcpConnection(process=None, status="error", error=f"Could not launch: {exc}")
            with self._lock:
                self._connections[agent.id] = connection
            return connection

        connection = AcpConnection(process=process)
        with self._lock:
            self._connections[agent.id] = connection
        try:
            result = connection.request(
                "initialize",
                {
                    "protocolVersion": ACP_PROTOCOL_VERSION,
                    "clientCapabilities": {"fs": {"readTextFile": False, "writeTextFile": False}},
                },
                timeout=HANDSHAKE_TIMEOUT_SECONDS,
            )
            version = result.get("protocolVersion")
            connection.protocol_version = version if isinstance(version, int) else None
            connection.capabilities = _flatten_capabilities(result.get("agentCapabilities", {}))
            connection.status = "connected"
        except (TimeoutError, ConnectionError, OSError, BrokenPipeError) as exc:
            connection.status = "error"
            connection.error = str(exc)
            connection.close()
        return connection

    def disconnect(self, agent_id: str) -> None:
        with self._lock:
            connection = self._connections.pop(agent_id, None)
        if connection:
            connection.close()

    def live_state(self, agent_id: str) -> AcpConnection | None:
        with self._lock:
            connection = self._connections.get(agent_id)
        if connection is None:
            return None
        # A process that died after connecting is an error, not a stale "connected".
        if connection.status == "connected" and (connection.process is None or connection.process.poll() is not None):
            connection.status = "error"
            connection.error = "The agent process exited."
        return connection

    def shutdown(self) -> None:
        with self._lock:
            connections = list(self._connections.values())
            self._connections.clear()
        for connection in connections:
            connection.close()
