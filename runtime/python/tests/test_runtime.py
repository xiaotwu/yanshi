from __future__ import annotations

import io
import json
import pytest
import subprocess
import sys
import threading
import time
import zipfile
from concurrent.futures import ThreadPoolExecutor
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

from fastapi.testclient import TestClient

from yanshi_runtime.config import RuntimeSettings
from yanshi_runtime.models import ToolResult
from yanshi_runtime.server import create_app
from yanshi_runtime.tools import BrowserTool, ComputerTool, TerminalTool
from yanshi_runtime.tools.computer_tool import DesktopHttpComputerBridge, MacosPermissionStatus
from yanshi_runtime.workshop import WorkshopPackValidator


def make_client(tmp_path: Path) -> TestClient:
    # Run inline so assertions can check terminal state right after POST (production uses the pool).
    # A fixed token + default Authorization header keeps every request authenticated.
    settings = RuntimeSettings(data_dir=tmp_path, runtime_version="test", synchronous_runs=True, api_token="test-token")
    return TestClient(create_app(settings), headers={"Authorization": "Bearer test-token"})


class FakeOpenAIHandler(BaseHTTPRequestHandler):
    received_authorization: str | None = None
    received_payload: dict[str, object] | None = None

    def do_GET(self) -> None:  # noqa: N802
        if self.path == "/v1/models":
            self._json(200, {"object": "list", "data": [{"id": "yanshi-test-model"}]})
            return
        self._json(404, {"error": "not found"})

    def do_POST(self) -> None:  # noqa: N802
        if self.path != "/v1/chat/completions":
            self._json(404, {"error": "not found"})
            return
        length = int(self.headers.get("content-length", "0"))
        FakeOpenAIHandler.received_authorization = self.headers.get("authorization")
        FakeOpenAIHandler.received_payload = json.loads(self.rfile.read(length).decode("utf-8"))
        messages = FakeOpenAIHandler.received_payload.get("messages") if FakeOpenAIHandler.received_payload else []
        system_prompt = messages[0].get("content", "") if isinstance(messages, list) and messages else ""
        if "structured multi-agent plan" in system_prompt:
            content = json.dumps(
                {
                    "steps": ["Understand request", "Assign Manager Agent", "Return verified response"],
                    "tasks": [{"agentId": "agent_manager", "task": "Produce the response with the configured provider."}],
                }
            )
        else:
            content = "Provider response from fake server."
        # The manager synthesis streams; plan generation does not. Honor the requested mode so the
        # SSE-parsing path is exercised by tests too.
        if FakeOpenAIHandler.received_payload.get("stream"):
            self._sse(content)
            return
        self._json(
            200,
            {
                "id": "chatcmpl_test",
                "object": "chat.completion",
                "created": 1,
                "model": "yanshi-test-model",
                "choices": [
                    {
                        "index": 0,
                        "message": {"role": "assistant", "content": content},
                        "finish_reason": "stop",
                    }
                ],
                "usage": {"prompt_tokens": 1, "completion_tokens": 1, "total_tokens": 2},
            },
        )

    def _sse(self, content: str) -> None:
        # Emit the content as two deltas + [DONE] in OpenAI SSE format.
        mid = max(1, len(content) // 2)
        body_lines = []
        for piece in (content[:mid], content[mid:]):
            body_lines.append("data: " + json.dumps({"choices": [{"delta": {"content": piece}}]}))
        body_lines.append("data: [DONE]")
        payload = ("\n\n".join(body_lines) + "\n\n").encode("utf-8")
        self.send_response(200)
        self.send_header("content-type", "text/event-stream")
        self.send_header("content-length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

    def log_message(self, format: str, *args: object) -> None:
        return

    def _json(self, status: int, body: dict[str, object]) -> None:
        payload = json.dumps(body).encode("utf-8")
        self.send_response(status)
        self.send_header("content-type", "application/json")
        self.send_header("content-length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)


class FakeOpenAIServer:
    def __enter__(self) -> str:
        FakeOpenAIHandler.received_authorization = None
        FakeOpenAIHandler.received_payload = None
        self.server = ThreadingHTTPServer(("127.0.0.1", 0), FakeOpenAIHandler)
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()
        return f"http://127.0.0.1:{self.server.server_port}/v1"

    def __exit__(self, exc_type, exc, tb) -> None:
        self.server.shutdown()
        self.thread.join(timeout=5)


class SequencedProvider:
    configured = True
    public_base_url = "fixture://provider"
    model = "fixture-model"

    def __init__(self, responses: list[str]) -> None:
        self.responses = responses
        self.calls: list[list[dict[str, object]]] = []

    def chat_completion(self, messages: list[object], model: str | None = None) -> str:
        self.calls.append([message.model_dump() if hasattr(message, "model_dump") else {"content": str(message)} for message in messages])
        if not self.responses:
            raise AssertionError("SequencedProvider received an unexpected chat completion call.")
        return self.responses.pop(0)

    def stream_chat_completion(self, messages: list[object], model: str | None = None):
        # Stream the next sequenced response as a single chunk (the graph joins chunks).
        yield self.chat_completion(messages)


class FakePlaywrightError(Exception):
    pass


class FakePlaywrightTimeoutError(Exception):
    pass


class FakeResponse:
    status = 200


class FakeLocator:
    def inner_text(self, timeout: int) -> str:
        return "Example body text"


class FakePage:
    url = "https://example.test/final"

    def goto(self, url: str, wait_until: str, timeout: int) -> FakeResponse:
        self.requested_url = url
        self.wait_until = wait_until
        self.timeout = timeout
        return FakeResponse()

    def title(self) -> str:
        return "Example Title"

    def locator(self, selector: str) -> FakeLocator:
        assert selector == "body"
        return FakeLocator()

    def screenshot(self, path: str, full_page: bool) -> None:
        assert full_page is True
        Path(path).write_bytes(b"png")


class FakeContext:
    def new_page(self) -> FakePage:
        return FakePage()


class FakeBrowser:
    def __init__(self) -> None:
        self.closed = False

    def new_context(self) -> FakeContext:
        return FakeContext()

    def close(self) -> None:
        self.closed = True


class FakeChromium:
    def launch(self, headless: bool) -> FakeBrowser:
        assert headless is True
        return FakeBrowser()


class FakePlaywright:
    chromium = FakeChromium()


class FakePlaywrightContext:
    def __enter__(self) -> FakePlaywright:
        return FakePlaywright()

    def __exit__(self, exc_type, exc, tb) -> None:
        return None


def fake_sync_playwright() -> FakePlaywrightContext:
    return FakePlaywrightContext()


class StaticPermissionProbe:
    def __init__(self, accessibility: str, screen_recording: str) -> None:
        self.permission_status = MacosPermissionStatus(
            accessibility=accessibility,
            screenRecording=screen_recording,
        )

    def status(self) -> MacosPermissionStatus:
        return self.permission_status


class FakeComputerBridge:
    def __init__(self, result: ToolResult | None = None, *, available: bool = True) -> None:
        self.result = result or ToolResult(
            ok=True,
            summary="Computer bridge action completed.",
            structuredOutput={"operation": "fixture"},
        )
        self.available_value = available
        self.calls: list[tuple[str, dict[str, object]]] = []

    def available(self) -> bool:
        return self.available_value

    def run(self, operation: str, payload: dict[str, object]) -> ToolResult:
        self.calls.append((operation, payload))
        return self.result


class BridgeRecordingHandler(BaseHTTPRequestHandler):
    received_authorization: str | None = None
    received_path: str | None = None
    received_payload: dict[str, object] | None = None
    status_code: int = 200

    def do_POST(self) -> None:  # noqa: N802
        length = int(self.headers.get("content-length", "0"))
        BridgeRecordingHandler.received_authorization = self.headers.get("authorization")
        BridgeRecordingHandler.received_path = self.path
        BridgeRecordingHandler.received_payload = (
            json.loads(self.rfile.read(length).decode("utf-8")) if length else {}
        )
        if BridgeRecordingHandler.status_code != 200:
            self._json(BridgeRecordingHandler.status_code, {"error": "unauthorized"})
            return
        self._json(
            200,
            {
                "ok": True,
                "summary": "Computer bridge clicked.",
                "missingRequirement": None,
                "structuredOutput": {"operation": "click"},
            },
        )

    def log_message(self, format: str, *args: object) -> None:
        return

    def _json(self, status: int, body: dict[str, object]) -> None:
        payload = json.dumps(body).encode("utf-8")
        self.send_response(status)
        self.send_header("content-type", "application/json")
        self.send_header("content-length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)


class BridgeRecordingServer:
    def __init__(self, status_code: int = 200) -> None:
        self.status_code = status_code

    def __enter__(self) -> str:
        BridgeRecordingHandler.received_authorization = None
        BridgeRecordingHandler.received_path = None
        BridgeRecordingHandler.received_payload = None
        BridgeRecordingHandler.status_code = self.status_code
        self.server = ThreadingHTTPServer(("127.0.0.1", 0), BridgeRecordingHandler)
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()
        return f"http://127.0.0.1:{self.server.server_port}"

    def __exit__(self, exc_type, exc, tb) -> None:
        self.server.shutdown()
        self.thread.join(timeout=5)


def test_desktop_bridge_sends_bearer_token_and_runs_operation() -> None:
    with BridgeRecordingServer() as base_url:
        bridge = DesktopHttpComputerBridge(base_url=base_url, token="bridge-secret")
        assert bridge.available() is True
        result = bridge.run("click", {"x": 10, "y": 20, "button": "left"})

    assert result.ok is True
    assert result.summary == "Computer bridge clicked."
    assert result.structuredOutput == {"operation": "click"}
    assert BridgeRecordingHandler.received_authorization == "Bearer bridge-secret"
    assert BridgeRecordingHandler.received_path == "/computer/click"
    assert BridgeRecordingHandler.received_payload == {"x": 10, "y": 20, "button": "left"}


def test_desktop_bridge_reports_missing_bridge_when_token_rejected() -> None:
    with BridgeRecordingServer(status_code=401) as base_url:
        bridge = DesktopHttpComputerBridge(base_url=base_url, token="wrong-token")
        result = bridge.run("click", {"x": 1, "y": 2, "button": "left"})

    assert result.ok is False
    assert result.missingRequirement == "computer_use_control_bridge"
    assert BridgeRecordingHandler.received_authorization == "Bearer wrong-token"


def test_desktop_bridge_without_url_is_not_available() -> None:
    bridge = DesktopHttpComputerBridge(base_url="", token=None)
    assert bridge.available() is False
    result = bridge.run("click", {"x": 1, "y": 2})
    assert result.ok is False
    assert result.missingRequirement == "computer_use_control_bridge"


def test_health_and_status_report_missing_model(tmp_path: Path) -> None:
    client = make_client(tmp_path)

    health = client.get("/health")
    assert health.status_code == 200
    assert health.json()["ok"] is True

    status = client.get("/runtime/status")
    assert status.status_code == 200
    assert status.json()["status"] == "degraded"
    assert "model_provider" in status.json()["missingRequirements"]


def test_create_run_persists_events_and_not_configured_state(tmp_path: Path) -> None:
    client = make_client(tmp_path)

    created = client.post("/runs", json={"task": "Summarize this project"})
    assert created.status_code == 200
    run_id = created.json()["id"]

    run = client.get(f"/runs/{run_id}").json()
    assert run["status"] == "failed"
    assert "model provider" in run["resultSummary"]

    events = client.get("/events", params={"runId": run_id}).json()
    event_types = [entry["event"]["type"] for entry in events]
    assert "run.created" in event_types
    assert "plan.created" in event_types
    assert "observation.created" in event_types
    assert "run.failed" in event_types


def test_approval_pause_and_resume(tmp_path: Path) -> None:
    client = make_client(tmp_path)

    created = client.post("/runs", json={"task": "Move files in my workspace"})
    assert created.status_code == 200
    run_id = created.json()["id"]

    run = client.get(f"/runs/{run_id}").json()
    assert run["status"] == "pending_approval"

    approvals = client.get("/approvals").json()
    assert len(approvals) == 1
    assert approvals[0]["runId"] == run_id

    decided = client.post(f"/approvals/{approvals[0]['id']}/decision", json={"decision": "approved"})
    assert decided.status_code == 200
    assert decided.json()["status"] == "approved"

    resumed = client.get(f"/runs/{run_id}").json()
    assert resumed["status"] == "failed"
    assert "model provider" in resumed["resultSummary"]


def test_approval_decision_accepts_aliases(tmp_path: Path) -> None:
    client = make_client(tmp_path)
    # `deny` alias resolves to a denied decision.
    run_id = client.post("/runs", json={"task": "Move files in my workspace"}).json()["id"]
    approval = client.get("/approvals").json()[0]
    decided = client.post(f"/approvals/{approval['id']}/decision", json={"decision": "deny"})
    assert decided.status_code == 200
    assert decided.json()["status"] == "denied"
    # `approve` alias resolves to an approved decision on a fresh run.
    run2 = client.post("/runs", json={"task": "Move files in my workspace"}).json()["id"]
    approval2 = client.get("/approvals").json()[0]
    decided2 = client.post(f"/approvals/{approval2['id']}/decision", json={"decision": "approve"})
    assert decided2.status_code == 200
    assert decided2.json()["status"] == "approved"
    assert run2  # touch to satisfy lints


def test_file_scan_uses_real_workspace(tmp_path: Path) -> None:
    workspace = tmp_path / "workspaces" / "default"
    workspace.mkdir(parents=True)
    (workspace / "notes.txt").write_text("hello", encoding="utf-8")

    client = make_client(tmp_path)
    created = client.post("/runs", json={"task": "List workspace files"})
    assert created.status_code == 200
    run_id = created.json()["id"]
    run = client.get(f"/runs/{run_id}").json()

    assert run["status"] == "completed"
    assert "scanned" in run["resultSummary"]
    assert (workspace / "latest-file-scan.json").exists()
    scan = json.loads((workspace / "latest-file-scan.json").read_text(encoding="utf-8"))
    assert any(item["name"] == "notes.txt" for item in scan["structuredOutput"]["items"])


def test_browser_tool_requires_http_url() -> None:
    result = BrowserTool().open_from_task("Use the browser")

    assert result.ok is False
    assert result.missingRequirement == "browser_url"


def test_browser_tool_executes_with_playwright_loader_fixture(tmp_path: Path) -> None:
    tool = BrowserTool(playwright_loader=lambda: (fake_sync_playwright, FakePlaywrightError, FakePlaywrightTimeoutError))

    result = tool.open_from_task("Use browser https://example.test/path.", output_dir=tmp_path)

    assert result.ok is True
    assert result.summary == "Browser Agent loaded Example Title."
    assert result.structuredOutput["requestedUrl"] == "https://example.test/path"
    assert result.structuredOutput["url"] == "https://example.test/final"
    assert result.structuredOutput["title"] == "Example Title"
    assert result.structuredOutput["status"] == 200
    assert result.structuredOutput["textSnippet"] == "Example body text"
    assert Path(result.structuredOutput["screenshotPath"]).exists()


def test_browser_run_records_real_action_observation_and_artifact(tmp_path: Path) -> None:
    client = make_client(tmp_path)
    service = client.app.state.runtime_service

    class FixtureBrowserTool:
        def open_from_task(self, task: str, *, output_dir: Path, timeout_ms: int = 12_000) -> ToolResult:
            output_dir.mkdir(parents=True, exist_ok=True)
            screenshot = output_dir / "browser-snapshot.png"
            screenshot.write_bytes(b"png")
            return ToolResult(
                ok=True,
                summary="Browser Agent loaded fixture page.",
                structuredOutput={
                    "requestedUrl": "https://example.test",
                    "url": "https://example.test",
                    "title": "Fixture",
                    "status": 200,
                    "textSnippet": "Fixture body",
                    "screenshotPath": str(screenshot),
                },
            )

    service.graph.browser_tool = FixtureBrowserTool()
    created = client.post(
        "/runs",
        json={"task": "Use browser https://example.test", "permissionMode": "auto_review"},
    )

    assert created.status_code == 200
    run_id = created.json()["id"]
    run = client.get(f"/runs/{run_id}").json()
    assert run["status"] == "completed"
    assert run["resultSummary"] == "Browser Agent loaded fixture page."

    events = client.get("/events", params={"runId": run_id}).json()
    observations = [entry["event"]["payload"] for entry in events if entry["event"]["type"] == "observation.created"]
    assert any(observation["type"] == "BrowserObservation" for observation in observations)
    assert any(entry["event"]["type"] == "artifact.created" for entry in events)


def test_browser_summary_uses_provider_after_real_page_observation(tmp_path: Path) -> None:
    client = make_client(tmp_path)
    service = client.app.state.runtime_service

    class FixtureBrowserTool:
        def open_from_task(self, task: str, *, output_dir: Path, timeout_ms: int = 12_000) -> ToolResult:
            output_dir.mkdir(parents=True, exist_ok=True)
            screenshot = output_dir / "browser-snapshot.png"
            screenshot.write_bytes(b"png")
            return ToolResult(
                ok=True,
                summary="Browser Agent loaded fixture page.",
                structuredOutput={
                    "requestedUrl": "https://example.test",
                    "url": "https://example.test",
                    "title": "Fixture",
                    "status": 200,
                    "textSnippet": "Fixture page text to summarize",
                    "screenshotPath": str(screenshot),
                },
            )

    service.graph.browser_tool = FixtureBrowserTool()
    with FakeOpenAIServer() as base_url:
        client.put(
            "/settings/provider",
            json={"baseUrl": base_url, "model": "yanshi-test-model", "apiKey": "secret-key"},
        )
        created = client.post(
            "/runs",
            json={"task": "Summarize browser https://example.test", "permissionMode": "auto_review"},
        )

    assert created.status_code == 200
    run_id = created.json()["id"]
    run = client.get(f"/runs/{run_id}").json()
    assert run["status"] == "completed"
    assert run["resultSummary"] == "Provider response from fake server."

    events = client.get("/events", params={"runId": run_id}).json()
    observations = [entry["event"]["payload"] for entry in events if entry["event"]["type"] == "observation.created"]
    assert any(observation["type"] == "BrowserObservation" for observation in observations)
    assert any(observation["type"] == "BrowserSummaryObservation" for observation in observations)
    assert any(entry["event"]["type"] == "artifact.created" for entry in events)
    assert FakeOpenAIHandler.received_payload is not None
    assert "Fixture page text to summarize" in json.dumps(FakeOpenAIHandler.received_payload)


def test_multi_agent_executor_runs_queued_browser_file_and_manager_synthesis(tmp_path: Path) -> None:
    workspace = tmp_path / "workspaces" / "default"
    workspace.mkdir(parents=True)
    (workspace / "brief.md").write_text("project notes", encoding="utf-8")

    client = make_client(tmp_path)
    service = client.app.state.runtime_service

    class FixtureBrowserTool:
        def open_from_task(self, task: str, *, output_dir: Path, timeout_ms: int = 12_000) -> ToolResult:
            output_dir.mkdir(parents=True, exist_ok=True)
            screenshot = output_dir / "browser-snapshot.png"
            screenshot.write_bytes(b"png")
            assert "https://example.test" in task
            return ToolResult(
                ok=True,
                summary="Browser Agent loaded fixture page.",
                structuredOutput={
                    "requestedUrl": "https://example.test",
                    "url": "https://example.test/final",
                    "title": "Fixture",
                    "status": 200,
                    "textSnippet": "Fixture body",
                    "screenshotPath": str(screenshot),
                },
            )

    provider = SequencedProvider(
        [
            json.dumps(
                {
                    "steps": ["Inspect page", "Scan workspace", "Synthesize final answer"],
                    "tasks": [
                        {"agentId": "agent_browser", "task": "Open the requested page and capture page state."},
                        {"agentId": "agent_file", "task": "Scan workspace files."},
                        {"agentId": "agent_manager", "task": "Synthesize Browser and File observations."},
                    ],
                }
            ),
            "Manager synthesized browser and file observations.",
        ]
    )
    service.provider = provider
    service.graph.provider = provider
    service.graph.browser_tool = FixtureBrowserTool()
    service.graph._direct_assignments_for_task = lambda task: []

    created = client.post(
        "/runs",
        json={"task": "Inspect https://example.test and scan workspace files", "permissionMode": "auto_review"},
    )

    assert created.status_code == 200
    run_id = created.json()["id"]
    run = client.get(f"/runs/{run_id}").json()
    assert run["status"] == "completed"
    assert run["resultSummary"] == "Manager synthesized browser and file observations."

    browser_tasks = service.storage.list_agent_tasks(run_id=run_id, agent_id="agent_browser")
    file_tasks = service.storage.list_agent_tasks(run_id=run_id, agent_id="agent_file")
    manager_tasks = service.storage.list_agent_tasks(run_id=run_id, agent_id="agent_manager")
    reviewer_tasks = service.storage.list_agent_tasks(run_id=run_id, agent_id="agent_reviewer")
    assert [task.status for task in browser_tasks] == ["completed"]
    assert [task.status for task in file_tasks] == ["completed"]
    assert [task.status for task in manager_tasks] == ["completed", "completed"]
    assert [task.status for task in reviewer_tasks] == ["completed"]

    events = client.get("/events", params={"runId": run_id}).json()
    event_types = [entry["event"]["type"] for entry in events]
    assert event_types.count("agent.task.started") >= 5
    observations = [entry["event"]["payload"] for entry in events if entry["event"]["type"] == "observation.created"]
    assert any(observation["type"] == "BrowserObservation" for observation in observations)
    assert any(observation["type"] == "FileObservation" for observation in observations)
    assert any(observation["type"] == "MessageObservation" for observation in observations)
    assert any(observation["type"] == "ReviewerObservation" for observation in observations)
    synthesis_payload = json.dumps(provider.calls[-1])
    assert "Browser Agent loaded fixture page." in synthesis_payload
    assert "scanned" in synthesis_payload


def test_failed_agent_task_is_reviewed_without_fake_success(tmp_path: Path) -> None:
    client = make_client(tmp_path)
    service = client.app.state.runtime_service
    provider = SequencedProvider(
        [
            json.dumps(
                {
                    "steps": ["Try browser inspection", "Synthesize result from observations"],
                    "tasks": [
                        {"agentId": "agent_browser", "task": "Open the requested page."},
                        {"agentId": "agent_manager", "task": "Explain what happened from agent observations."},
                    ],
                }
            ),
            "Manager synthesized the failed Browser Agent observation.",
        ]
    )
    service.provider = provider
    service.graph.provider = provider
    service.graph._direct_assignments_for_task = lambda task: []

    created = client.post(
        "/runs",
        json={"task": "Inspect the requested page", "permissionMode": "auto_review"},
    )

    assert created.status_code == 200
    run_id = created.json()["id"]
    run = client.get(f"/runs/{run_id}").json()
    assert run["status"] == "failed"
    assert run["resultSummary"] == "Manager synthesized the failed Browser Agent observation."

    browser_tasks = service.storage.list_agent_tasks(run_id=run_id, agent_id="agent_browser")
    manager_tasks = service.storage.list_agent_tasks(run_id=run_id, agent_id="agent_manager")
    reviewer_tasks = service.storage.list_agent_tasks(run_id=run_id, agent_id="agent_reviewer")
    assert [task.status for task in browser_tasks] == ["failed"]
    assert [task.status for task in manager_tasks] == ["completed", "completed"]
    assert [task.status for task in reviewer_tasks] == ["completed"]

    events = client.get("/events", params={"runId": run_id}).json()
    observations = [entry["event"]["payload"] for entry in events if entry["event"]["type"] == "observation.created"]
    browser_observation = next(observation for observation in observations if observation["type"] == "BrowserObservation")
    reviewer_observation = next(observation for observation in observations if observation["type"] == "ReviewerObservation")
    assert browser_observation["error"] == "browser_url"
    assert reviewer_observation["structuredOutput"]["qualityPassed"] is False
    assert reviewer_observation["structuredOutput"]["failedAgentTasks"][0]["agentId"] == "agent_browser"
    assert "fake" not in json.dumps(events).lower()


def test_computer_tool_reports_missing_macos_permissions() -> None:
    tool = ComputerTool(probe=StaticPermissionProbe(accessibility="permission_required", screen_recording="granted"))

    result = tool.status()

    assert result.ok is False
    assert result.missingRequirement == "macos_permissions"
    assert result.structuredOutput["accessibility"] == "permission_required"
    assert result.structuredOutput["screenRecording"] == "granted"
    assert result.structuredOutput["required"] == ["Accessibility"]


def test_computer_tool_reports_bridge_gap_after_permissions() -> None:
    tool = ComputerTool(probe=StaticPermissionProbe(accessibility="granted", screen_recording="granted"))

    result = tool.status()

    assert result.ok is False
    assert result.missingRequirement == "computer_use_control_bridge"
    assert result.structuredOutput["required"] == []


def test_computer_tool_requires_accessibility_before_bridge_actions() -> None:
    bridge = FakeComputerBridge()
    tool = ComputerTool(
        probe=StaticPermissionProbe(accessibility="permission_required", screen_recording="granted"),
        bridge=bridge,
    )

    result = tool.click(10, 20)

    assert result.ok is False
    assert result.missingRequirement == "macos_permissions"
    assert result.structuredOutput["required"] == ["Accessibility"]
    assert bridge.calls == []


def test_computer_tool_reports_missing_bridge_for_control_actions() -> None:
    tool = ComputerTool(
        probe=StaticPermissionProbe(accessibility="granted", screen_recording="granted"),
        bridge=FakeComputerBridge(available=False),
    )

    result = tool.click(10, 20)

    assert result.ok is False
    assert result.missingRequirement == "computer_use_control_bridge"


def test_computer_tool_runs_action_through_bridge_when_available() -> None:
    bridge = FakeComputerBridge(
        ToolResult(
            ok=True,
            summary="Computer bridge clicked.",
            structuredOutput={"operation": "click", "x": 10, "y": 20},
        )
    )
    tool = ComputerTool(
        probe=StaticPermissionProbe(accessibility="granted", screen_recording="permission_required"),
        bridge=bridge,
    )

    result = tool.click(10, 20)

    assert result.ok is True
    assert result.summary == "Computer bridge clicked."
    assert bridge.calls == [("click", {"x": 10, "y": 20, "button": "left"})]


def test_computer_tool_captures_screen_with_macos_runner(tmp_path: Path) -> None:
    def runner(
        args: list[str],
        *,
        capture_output: bool,
        text: bool,
        timeout: int,
        check: bool,
    ) -> subprocess.CompletedProcess[str]:
        assert args[:2] == ["screencapture", "-x"]
        assert capture_output is True
        assert text is True
        assert timeout == 15
        assert check is False
        Path(args[2]).write_bytes(b"png")
        return subprocess.CompletedProcess(args, 0, "", "")

    tool = ComputerTool(
        probe=StaticPermissionProbe(accessibility="granted", screen_recording="granted"),
        runner=runner,
    )

    result = tool.capture_screen(tmp_path)

    assert result.ok is True
    assert result.summary == "Computer Agent captured the screen."
    assert Path(result.structuredOutput["screenshotPath"]).exists()


def test_computer_screen_capture_run_records_artifact(tmp_path: Path) -> None:
    def runner(
        args: list[str],
        *,
        capture_output: bool,
        text: bool,
        timeout: int,
        check: bool,
    ) -> subprocess.CompletedProcess[str]:
        Path(args[2]).write_bytes(b"png")
        return subprocess.CompletedProcess(args, 0, "", "")

    client = make_client(tmp_path)
    service = client.app.state.runtime_service
    service.graph.computer_tool = ComputerTool(
        probe=StaticPermissionProbe(accessibility="granted", screen_recording="granted"),
        runner=runner,
    )

    created = client.post(
        "/runs",
        json={"task": "Take a computer screenshot", "permissionMode": "auto_review"},
    )

    assert created.status_code == 200
    run_id = created.json()["id"]
    run = client.get(f"/runs/{run_id}").json()
    assert run["status"] == "completed"
    assert run["resultSummary"] == "Computer Agent captured the screen."

    events = client.get("/events", params={"runId": run_id}).json()
    observations = [entry["event"]["payload"] for entry in events if entry["event"]["type"] == "observation.created"]
    computer_observation = next(observation for observation in observations if observation["type"] == "ComputerObservation")
    assert Path(computer_observation["structuredOutput"]["screenshotPath"]).exists()
    assert any(entry["event"]["type"] == "artifact.created" for entry in events)


def test_computer_click_run_persists_bridge_action_observation(tmp_path: Path) -> None:
    bridge = FakeComputerBridge(
        ToolResult(
            ok=True,
            summary="Computer bridge clicked.",
            structuredOutput={"operation": "click", "x": 10, "y": 20},
        )
    )
    client = make_client(tmp_path)
    service = client.app.state.runtime_service
    service.graph.computer_tool = ComputerTool(
        probe=StaticPermissionProbe(accessibility="granted", screen_recording="permission_required"),
        bridge=bridge,
    )

    created = client.post(
        "/runs",
        json={"task": "Click 10, 20 on the computer", "permissionMode": "auto_review"},
    )

    assert created.status_code == 200
    run_id = created.json()["id"]
    run = client.get(f"/runs/{run_id}").json()
    assert run["status"] == "completed"
    assert run["resultSummary"] == "Computer bridge clicked."
    assert bridge.calls == [("click", {"x": 10.0, "y": 20.0, "button": "left"})]

    events = client.get("/events", params={"runId": run_id}).json()
    observations = [entry["event"]["payload"] for entry in events if entry["event"]["type"] == "observation.created"]
    computer_observation = next(observation for observation in observations if observation["type"] == "ComputerObservation")
    assert computer_observation["structuredOutput"]["operation"] == "click"
    computer_tasks = service.storage.list_agent_tasks(run_id=run_id, agent_id="agent_computer")
    assert [task.status for task in computer_tasks] == ["completed"]


def test_terminal_tool_runs_read_only_command_in_workspace(tmp_path: Path) -> None:
    (tmp_path / "note.txt").write_text("hello", encoding="utf-8")

    result = TerminalTool().run_from_task("Run command `ls` in terminal", workspace_root=tmp_path)

    assert result.ok is True
    assert result.structuredOutput["returnCode"] == 0
    assert "note.txt" in result.structuredOutput["stdout"]
    assert result.structuredOutput["cwd"] == str(tmp_path.resolve())


def test_terminal_tool_blocks_unsafe_commands_and_paths(tmp_path: Path) -> None:
    tool = TerminalTool()

    destructive = tool.run_from_task("Run command `rm note.txt` in terminal", workspace_root=tmp_path)
    assert destructive.ok is False
    assert destructive.missingRequirement == "terminal_command_not_allowed"

    outside_path = tool.run_from_task("Run command `ls ..` in terminal", workspace_root=tmp_path)
    assert outside_path.ok is False
    assert outside_path.missingRequirement == "terminal_path_outside_workspace"

    shell_pipeline = tool.run_from_task("Run command `ls | wc -l` in terminal", workspace_root=tmp_path)
    assert shell_pipeline.ok is False
    assert shell_pipeline.missingRequirement == "terminal_shell_unsupported"


def test_terminal_cancellable_run_kills_process_immediately(tmp_path: Path) -> None:
    from yanshi_runtime.tools.terminal_tool import CommandCancelled

    tool = TerminalTool()
    proc_holder: dict[str, subprocess.Popen[str]] = {}
    real_popen = subprocess.Popen

    def capturing_popen(*args, **kwargs):  # type: ignore[no-untyped-def]
        proc = real_popen(*args, **kwargs)
        proc_holder["proc"] = proc
        return proc

    started = time.monotonic()
    # A 30s sleep would block to the timeout if cancellation did nothing; cancel kills it now.
    with pytest.MonkeyPatch.context() as mp:
        mp.setattr(subprocess, "Popen", capturing_popen)
        with pytest.raises(CommandCancelled):
            tool._run_cancellable(
                ["sleep", "30"],
                cwd=tmp_path,
                env=None,
                timeout=30,
                is_cancelled=lambda: True,
                container_name=None,
            )

    elapsed = time.monotonic() - started
    assert elapsed < 5, f"cancel should return promptly, took {elapsed:.1f}s"
    proc = proc_holder["proc"]
    assert proc.poll() is not None, "child process must be dead after cancel"


def test_terminal_cancellable_run_still_times_out(tmp_path: Path) -> None:
    tool = TerminalTool()
    started = time.monotonic()
    with pytest.raises(subprocess.TimeoutExpired):
        tool._run_cancellable(
            ["sleep", "30"],
            cwd=tmp_path,
            env=None,
            timeout=1,
            is_cancelled=lambda: False,
            container_name=None,
        )
    elapsed = time.monotonic() - started
    assert elapsed < 6, f"timeout should fire near 1s, took {elapsed:.1f}s"


def test_terminal_run_records_action_observation_and_stdout(tmp_path: Path) -> None:
    workspace = tmp_path / "workspaces" / "default"
    workspace.mkdir(parents=True)
    (workspace / "terminal-note.txt").write_text("hello", encoding="utf-8")
    client = make_client(tmp_path)
    service = client.app.state.runtime_service
    client.put("/settings", json={"terminalToolEnabled": True})

    created = client.post(
        "/runs",
        json={"task": "Run command `ls` in terminal", "permissionMode": "full_access"},
    )

    assert created.status_code == 200
    run_id = created.json()["id"]
    run = client.get(f"/runs/{run_id}").json()
    assert run["status"] == "completed"
    assert run["resultSummary"] == "Terminal command completed: ls."

    events = client.get("/events", params={"runId": run_id}).json()
    observations = [entry["event"]["payload"] for entry in events if entry["event"]["type"] == "observation.created"]
    terminal_observation = next(observation for observation in observations if observation["type"] == "TerminalObservation")
    assert "terminal-note.txt" in terminal_observation["structuredOutput"]["stdout"]
    terminal_tasks = service.storage.list_agent_tasks(run_id=run_id, agent_id="agent_terminal")
    assert len(terminal_tasks) == 1
    assert terminal_tasks[0].status == "completed"


def test_docker_tool_runs_command_with_workspace_mount(tmp_path: Path) -> None:
    calls: list[list[str]] = []

    def runner(
        args: list[str],
        *,
        cwd: Path | None = None,
        env: dict[str, str] | None = None,
        capture_output: bool,
        text: bool,
        timeout: int,
        check: bool,
    ) -> subprocess.CompletedProcess[str]:
        calls.append(args)
        assert capture_output is True
        assert text is True
        assert check is False
        if args == ["docker", "info"]:
            return subprocess.CompletedProcess(args, 0, "ready", "")
        assert args[:3] == ["docker", "run", "--rm"]
        assert "--network" in args and args[args.index("--network") + 1] == "none"
        name_index = args.index("--name")
        assert args[name_index + 1].startswith("yanshi-run-")
        assert "--memory" in args
        assert "--cpus" in args
        assert "--pids-limit" in args
        assert f"type=bind,src={tmp_path.resolve()},dst=/workspace" in args
        assert args[-3:] == ["/bin/sh", "-lc", "echo hi > note.txt"]
        return subprocess.CompletedProcess(args, 0, "done\n", "")

    result = TerminalTool(runner=runner).run_in_docker("echo hi > note.txt", workspace_root=tmp_path)

    assert result.ok is True
    assert result.structuredOutput["stdout"] == "done\n"
    assert result.structuredOutput["network"] == "none"
    assert result.structuredOutput["resourceLock"] == "docker"
    assert [call[:2] for call in calls] == [["docker", "info"], ["docker", "run"]]


def test_docker_tool_reports_image_pull_timeout(tmp_path: Path) -> None:
    def runner(
        args: list[str],
        *,
        cwd: Path | None = None,
        env: dict[str, str] | None = None,
        capture_output: bool,
        text: bool,
        timeout: int,
        check: bool,
    ) -> subprocess.CompletedProcess[str]:
        if args == ["docker", "info"]:
            return subprocess.CompletedProcess(args, 0, "ready", "")
        raise subprocess.TimeoutExpired(args, timeout, stderr="Unable to find image 'alpine:3.20' locally\n")

    result = TerminalTool(runner=runner).run_in_docker("echo hi", workspace_root=tmp_path)

    assert result.ok is False
    assert result.missingRequirement == "docker_image_pull_timeout"
    assert "image pull timed out" in result.summary


def test_docker_run_records_terminal_log_artifact(tmp_path: Path) -> None:
    def runner(
        args: list[str],
        *,
        cwd: Path | None = None,
        env: dict[str, str] | None = None,
        capture_output: bool,
        text: bool,
        timeout: int,
        check: bool,
    ) -> subprocess.CompletedProcess[str]:
        if args == ["docker", "info"]:
            return subprocess.CompletedProcess(args, 0, "ready", "")
        return subprocess.CompletedProcess(args, 0, "container stdout\n", "")

    client = make_client(tmp_path)
    service = client.app.state.runtime_service
    service.graph.terminal_tool = TerminalTool(runner=runner)
    client.put("/settings", json={"terminalToolEnabled": True})

    created = client.post(
        "/runs",
        json={"task": "Run command `echo hi > note.txt` in Docker", "permissionMode": "full_access"},
    )

    assert created.status_code == 200
    run_id = created.json()["id"]
    run = client.get(f"/runs/{run_id}").json()
    assert run["status"] == "completed"
    assert run["resultSummary"] == "Docker sandbox command completed."
    log_path = tmp_path / "workspaces" / "default" / "terminal" / "docker-log.txt"
    assert log_path.exists()
    assert "container stdout" in log_path.read_text(encoding="utf-8")
    events = client.get("/events", params={"runId": run_id}).json()
    assert any(entry["event"]["type"] == "artifact.created" for entry in events)
    terminal_tasks = service.storage.list_agent_tasks(run_id=run_id, agent_id="agent_terminal")
    assert len(terminal_tasks) == 1
    assert terminal_tasks[0].status == "completed"


def test_missing_provider_failure_is_stated_once(tmp_path: Path) -> None:
    """A no-provider failure surfaces a single clear blocker observation — not the same
    message re-narrated by a reviewer (the duplicate that cluttered the chat)."""
    client = make_client(tmp_path)

    created = client.post("/runs", json={"task": "Summarize this project"})

    assert created.status_code == 200
    run_id = created.json()["id"]
    run = client.get(f"/runs/{run_id}").json()
    assert run["status"] == "failed"
    events = client.get("/events", params={"runId": run_id}).json()
    observations = [entry["event"]["payload"] for entry in events if entry["event"]["type"] == "observation.created"]
    # Exactly one observation carries the model-provider blocker, and it is the structured,
    # actionable ErrorObservation (the frontend localizes it + offers a Configure CTA).
    blockers = [
        observation
        for observation in observations
        if (observation.get("structuredOutput") or {}).get("missingRequirement") == "model_provider"
        or observation.get("error") == "model_not_configured"
    ]
    assert len(blockers) == 1
    assert blockers[0]["type"] == "ErrorObservation"
    # No duplicate "Reviewer identified the blocking condition: …" narration of the same text.
    assert not any("identified the blocking condition" in (obs.get("summary") or "") for obs in observations)


def test_project_crud_persists_and_emits_events(tmp_path: Path) -> None:
    client = make_client(tmp_path)

    created = client.post("/projects", json={"name": "Launch", "description": "Real work"})
    assert created.status_code == 200
    project = created.json()
    project_id = project["id"]
    workspace = Path(project["workspacePath"])
    assert project["name"] == "Launch"
    assert project["description"] == "Real work"
    assert workspace.exists()
    assert workspace.parent == tmp_path / "workspaces"

    listed = client.get("/projects")
    assert listed.status_code == 200
    assert [item["id"] for item in listed.json()] == [project_id]

    updated = client.put(
        f"/projects/{project_id}",
        json={"name": "Launch Ops", "description": "Updated", "settings": {"accent": "green"}},
    )
    assert updated.status_code == 200
    assert updated.json()["name"] == "Launch Ops"
    assert updated.json()["settings"] == {"accent": "green"}

    events = client.get("/events").json()
    event_types = [entry["event"]["type"] for entry in events]
    assert "project.created" in event_types
    assert "project.updated" in event_types

    deleted = client.delete(f"/projects/{project_id}")
    assert deleted.status_code == 204
    assert client.get(f"/projects/{project_id}").status_code == 404
    assert workspace.exists()


def test_project_run_uses_project_workspace_and_filters_runs(tmp_path: Path) -> None:
    client = make_client(tmp_path)
    service = client.app.state.runtime_service
    project = client.post("/projects", json={"name": "Research"}).json()
    workspace = Path(project["workspacePath"])
    (workspace / "brief.md").write_text("project notes", encoding="utf-8")

    standalone = client.post("/runs", json={"task": "List workspace files"})
    assert standalone.status_code == 200
    project_run = client.post("/runs", json={"task": "List workspace files", "projectId": project["id"]})
    assert project_run.status_code == 200
    run_id = project_run.json()["id"]

    run = client.get(f"/runs/{run_id}").json()
    assert run["projectId"] == project["id"]
    assert run["standalone"] is False
    assert run["status"] == "completed"

    scan_path = workspace / "latest-file-scan.json"
    assert scan_path.exists()
    default_scan_path = tmp_path / "workspaces" / "default" / "latest-file-scan.json"
    assert default_scan_path.exists()
    scan = json.loads(scan_path.read_text(encoding="utf-8"))
    assert scan["structuredOutput"]["root"] == str(workspace.resolve())
    assert any(item["name"] == "brief.md" for item in scan["structuredOutput"]["items"])

    filtered = client.get("/runs", params={"projectId": project["id"]})
    assert filtered.status_code == 200
    assert [item["id"] for item in filtered.json()] == [run_id]

    run_events = client.get("/events", params={"runId": run_id}).json()
    assert any(entry["event"]["projectId"] == project["id"] for entry in run_events)
    project_tasks = service.storage.list_agent_tasks(project_id=project["id"])
    file_tasks = service.storage.list_agent_tasks(project_id=project["id"], agent_id="agent_file")
    assert any(task.agentId == "agent_manager" and task.status == "completed" for task in project_tasks)
    assert [task.runId for task in file_tasks] == [run_id]
    assert file_tasks[0].status == "completed"
    api_tasks = client.get("/agent-tasks", params={"projectId": project["id"], "agentId": "agent_file"})
    assert api_tasks.status_code == 200
    assert [task["id"] for task in api_tasks.json()] == [file_tasks[0].id]


def test_project_run_rejects_unknown_project(tmp_path: Path) -> None:
    client = make_client(tmp_path)

    created = client.post("/runs", json={"task": "List workspace files", "projectId": "proj_missing"})

    assert created.status_code == 404
    assert "Project not found" in created.text


def test_delete_project_keeps_run_history_as_standalone(tmp_path: Path) -> None:
    client = make_client(tmp_path)
    project = client.post("/projects", json={"name": "Archive Me"}).json()
    created = client.post("/runs", json={"task": "List workspace files", "projectId": project["id"]})
    run_id = created.json()["id"]

    deleted = client.delete(f"/projects/{project['id']}")

    assert deleted.status_code == 204
    run = client.get(f"/runs/{run_id}").json()
    assert run["projectId"] is None
    assert run["standalone"] is True


def test_workshop_rejects_executable_pack(tmp_path: Path) -> None:
    client = make_client(tmp_path)
    pack_path = tmp_path / "unsafe.zip"
    with zipfile.ZipFile(pack_path, "w") as archive:
        archive.writestr("manifest.json", json.dumps({"name": "Unsafe", "version": "1.0.0"}))
        archive.writestr("scripts/install.sh", "echo nope")

    with pack_path.open("rb") as handle:
        response = client.post("/workshop/validate", files={"pack": ("unsafe.zip", handle, "application/zip")})

    assert response.status_code == 200
    body = response.json()
    assert body["ok"] is False
    assert any("Executable files" in error for error in body["errors"])


def test_workshop_import_enable_disable_persists_pack(tmp_path: Path) -> None:
    client = make_client(tmp_path)
    pack_path = tmp_path / "safe.zip"
    with zipfile.ZipFile(pack_path, "w") as archive:
        archive.writestr(
            "manifest.json",
            json.dumps(
                {
                    "name": "Safe Pack",
                    "version": "1.2.3",
                    "author": "Yanshi Tests",
                    "contentTypes": ["themes"],
                    "suggestedPermissions": ["read_workspace"],
                }
            ),
        )
        archive.writestr("themes/base.json", json.dumps({"accent": "green"}))

    with pack_path.open("rb") as handle:
        imported = client.post("/workshop/import", files={"pack": ("safe.zip", handle, "application/zip")})

    assert imported.status_code == 200
    pack = imported.json()
    pack_id = pack["id"]
    assert pack["name"] == "Safe Pack"
    assert pack["enabled"] is False
    assert pack["securityStatus"] == "validated"
    assert Path(pack["installedPath"], "manifest.json").exists()
    assert Path(pack["installedPath"], "themes", "base.json").exists()

    listed = client.get("/workshop/packs")
    assert listed.status_code == 200
    assert [item["id"] for item in listed.json()] == [pack_id]

    enabled = client.put(f"/workshop/packs/{pack_id}/enabled", json={"enabled": True})
    assert enabled.status_code == 200
    assert enabled.json()["enabled"] is True

    disabled = client.put(f"/workshop/packs/{pack_id}/enabled", json={"enabled": False})
    assert disabled.status_code == 200
    assert disabled.json()["enabled"] is False

    event_types = [entry["event"]["type"] for entry in client.get("/events").json()]
    assert "workshop.pack.imported" in event_types
    assert "workshop.pack.enabled" in event_types
    assert "workshop.pack.disabled" in event_types


def test_workshop_import_rejects_invalid_pack(tmp_path: Path) -> None:
    client = make_client(tmp_path)
    pack_path = tmp_path / "unsafe.zip"
    with zipfile.ZipFile(pack_path, "w") as archive:
        archive.writestr("manifest.json", json.dumps({"name": "Unsafe", "version": "1.0.0"}))
        archive.writestr("scripts/install.sh", "echo nope")

    with pack_path.open("rb") as handle:
        response = client.post("/workshop/import", files={"pack": ("unsafe.zip", handle, "application/zip")})

    assert response.status_code == 400
    assert "Executable files" in response.text


def test_workshop_upload_filename_uses_safe_basename(tmp_path: Path) -> None:
    client = make_client(tmp_path)
    pack_path = tmp_path / "safe.zip"
    with zipfile.ZipFile(pack_path, "w") as archive:
        archive.writestr("manifest.json", json.dumps({"name": "Safe Name", "version": "1.0.0"}))
        archive.writestr("themes/base.json", json.dumps({"accent": "green"}))

    with pack_path.open("rb") as handle:
        response = client.post("/workshop/validate", files={"pack": ("../../escape.zip", handle, "application/zip")})

    assert response.status_code == 200
    assert response.json()["ok"] is True
    assert not (tmp_path / "escape.zip").exists()
    incoming_files = list((tmp_path / "packs" / "incoming").iterdir())
    assert len(incoming_files) == 1
    assert incoming_files[0].parent == tmp_path / "packs" / "incoming"
    assert incoming_files[0].name.endswith("-escape.zip")
    assert "/" not in incoming_files[0].name
    assert ".." not in incoming_files[0].name


def test_workshop_upload_rejects_oversized_raw_upload(tmp_path: Path) -> None:
    client = make_client(tmp_path)
    service = client.app.state.runtime_service
    service.max_workshop_upload_bytes = 16

    response = client.post("/workshop/import", files={"pack": ("large.zip", b"x" * 32, "application/zip")})

    assert response.status_code == 413
    incoming_root = tmp_path / "packs" / "incoming"
    assert not incoming_root.exists() or list(incoming_root.iterdir()) == []


def test_workshop_validation_rejects_uncompressed_zip_bomb(tmp_path: Path) -> None:
    client = make_client(tmp_path)
    service = client.app.state.runtime_service
    service.pack_validator = WorkshopPackValidator(max_uncompressed_bytes=128, max_member_bytes=512)
    pack_path = tmp_path / "bomb.zip"
    with zipfile.ZipFile(pack_path, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        archive.writestr("manifest.json", json.dumps({"name": "Bomb", "version": "1.0.0"}))
        archive.writestr("themes/huge.txt", "A" * 256)

    with pack_path.open("rb") as handle:
        response = client.post("/workshop/validate", files={"pack": ("bomb.zip", handle, "application/zip")})

    assert response.status_code == 200
    body = response.json()
    assert body["ok"] is False
    assert any("uncompressed size" in error for error in body["errors"])


def test_workshop_validation_rejects_zip_file_count_limit(tmp_path: Path) -> None:
    client = make_client(tmp_path)
    service = client.app.state.runtime_service
    service.pack_validator = WorkshopPackValidator(max_file_count=2)
    pack_path = tmp_path / "too-many.zip"
    with zipfile.ZipFile(pack_path, "w") as archive:
        archive.writestr("manifest.json", json.dumps({"name": "Too Many", "version": "1.0.0"}))
        archive.writestr("themes/one.json", "{}")
        archive.writestr("themes/two.json", "{}")

    with pack_path.open("rb") as handle:
        response = client.post("/workshop/import", files={"pack": ("too-many.zip", handle, "application/zip")})

    assert response.status_code == 400
    assert "too many files" in response.text


def test_provider_settings_persist_without_returning_api_key(tmp_path: Path) -> None:
    client = make_client(tmp_path)

    response = client.put(
        "/settings/provider",
        json={"baseUrl": "http://127.0.0.1:9999/v1", "model": "yanshi-test-model", "apiKey": "secret-key"},
    )
    assert response.status_code == 200
    body = response.json()
    assert body == {
        "baseUrl": "http://127.0.0.1:9999/v1",
        "model": "yanshi-test-model",
        "apiKeyConfigured": True,
    }
    assert "secret-key" not in response.text

    persisted = client.get("/settings/provider")
    assert persisted.status_code == 200
    assert persisted.json()["apiKeyConfigured"] is True
    assert "secret-key" not in persisted.text


def test_app_settings_persist(tmp_path: Path) -> None:
    client = make_client(tmp_path)

    defaults = client.get("/settings")
    assert defaults.status_code == 200
    assert defaults.json()["developerMode"] is False
    assert defaults.json()["permissionModeDefault"] == "default"

    updated = client.put(
        "/settings",
        json={
            "developerMode": True,
            "permissionModeDefault": "auto_review",
            "terminalToolEnabled": True,
            "notificationsEnabled": False,
        },
    )
    assert updated.status_code == 200
    body = updated.json()
    assert body["developerMode"] is True
    assert body["permissionModeDefault"] == "auto_review"
    assert body["terminalToolEnabled"] is True
    assert body["notificationsEnabled"] is False
    assert body["dockerImage"] == "alpine:3.20"

    persisted = client.get("/settings")
    assert persisted.json()["developerMode"] is True
    assert persisted.json()["permissionModeDefault"] == "auto_review"


def test_gpu_and_shortcut_settings_persist(tmp_path: Path) -> None:
    client = make_client(tmp_path)

    defaults = client.get("/settings").json()
    assert defaults["gpuAcceleration"] is True
    assert defaults["shortcuts"] == {}

    updated = client.put(
        "/settings",
        json={"gpuAcceleration": False, "shortcuts": {"open-library": "Meta+L", "new-task": ""}},
    )
    assert updated.status_code == 200
    assert updated.json()["gpuAcceleration"] is False
    assert updated.json()["shortcuts"] == {"open-library": "Meta+L", "new-task": ""}

    persisted = client.get("/settings").json()
    assert persisted["gpuAcceleration"] is False
    assert persisted["shortcuts"]["open-library"] == "Meta+L"


def test_ai_integrations_config_persists_with_honest_statuses(tmp_path: Path) -> None:
    client = make_client(tmp_path)

    empty = client.get("/settings/integrations")
    assert empty.status_code == 200
    assert empty.json() == {"externalAgents": [], "mcpServers": []}

    updated = client.put(
        "/settings/integrations",
        json={
            "externalAgents": [
                {"id": "ea_1", "name": "Claude Code", "protocol": "acp", "command": "claude-code-acp", "enabled": True},
                {"id": "ea_2", "name": "Unset agent", "protocol": "acp", "enabled": False},
            ],
            "mcpServers": [
                {
                    "id": "mcp_1",
                    "name": "Filesystem",
                    "transport": "stdio",
                    "command": "npx",
                    "args": ["-y", "@modelcontextprotocol/server-filesystem"],
                    "enabled": True,
                    # A client claiming readiness/tools must be rewritten honestly by the runtime.
                    "status": "ready",
                    "tools": ["read_file"],
                },
                {"id": "mcp_2", "name": "Remote", "transport": "http", "enabled": False},
            ],
        },
    )
    assert updated.status_code == 200
    body = updated.json()
    # ACP agents with a launch command are "configured" (the stdio foundation can attempt a real
    # connection); incomplete entries are "not_configured". MCP has no client: configured entries
    # are "not_implemented" and discovered tools are never faked.
    assert body["externalAgents"][0]["status"] == "configured"
    assert body["externalAgents"][0]["capabilities"] == []
    assert body["externalAgents"][1]["status"] == "not_configured"
    assert body["mcpServers"][0]["status"] == "not_implemented"
    assert body["mcpServers"][0]["tools"] == []
    assert body["mcpServers"][1]["status"] == "not_configured"

    persisted = client.get("/settings/integrations").json()
    assert [a["id"] for a in persisted["externalAgents"]] == ["ea_1", "ea_2"]
    assert persisted["mcpServers"][0]["args"] == ["-y", "@modelcontextprotocol/server-filesystem"]
    assert persisted["mcpServers"][0]["status"] == "not_implemented"


ACP_FIXTURE_AGENT = '''
import json, sys
for line in sys.stdin:
    line = line.strip()
    if not line:
        continue
    message = json.loads(line)
    if message.get("method") == "initialize":
        response = {
            "jsonrpc": "2.0",
            "id": message["id"],
            "result": {
                "protocolVersion": 1,
                "agentCapabilities": {"loadSession": True, "promptCapabilities": {"image": True, "audio": False}},
            },
        }
        sys.stdout.write(json.dumps(response) + "\\n")
        sys.stdout.flush()
'''


def test_acp_connect_handshake_and_disconnect(tmp_path: Path) -> None:
    """The ACP foundation launches a real agent process over stdio, completes the initialize
    handshake, reports only the capabilities the agent itself declared, and tears down cleanly."""
    client = make_client(tmp_path)
    agent_script = tmp_path / "acp_agent.py"
    agent_script.write_text(ACP_FIXTURE_AGENT)

    client.put(
        "/settings/integrations",
        json={"externalAgents": [{"id": "ea_ok", "name": "Fixture agent", "protocol": "acp", "command": f"{sys.executable} {agent_script}", "enabled": True}]},
    )

    connected = client.post("/settings/integrations/agents/ea_ok/connect")
    assert connected.status_code == 200
    agent = connected.json()["externalAgents"][0]
    assert agent["status"] == "connected"
    assert agent["lastError"] is None
    assert "loadSession" in agent["capabilities"]
    assert "promptCapabilities.image" in agent["capabilities"]
    assert "promptCapabilities.audio" not in agent["capabilities"]

    # Live state is an overlay, not persistence: nothing "connected" may be stored at rest.
    raw = client.app.state.runtime_service.storage.get_setting("integrations")
    assert raw["externalAgents"][0]["status"] != "connected"

    disconnected = client.post("/settings/integrations/agents/ea_ok/disconnect")
    assert disconnected.status_code == 200
    assert disconnected.json()["externalAgents"][0]["status"] == "configured"


def test_acp_connect_reports_honest_errors(tmp_path: Path) -> None:
    client = make_client(tmp_path)
    client.put(
        "/settings/integrations",
        json={"externalAgents": [{"id": "ea_bad", "name": "Broken", "protocol": "acp", "command": "/nonexistent/acp-agent-binary", "enabled": True}]},
    )

    result = client.post("/settings/integrations/agents/ea_bad/connect")
    assert result.status_code == 200
    agent = result.json()["externalAgents"][0]
    assert agent["status"] == "error"
    assert agent["lastError"]
    assert agent["capabilities"] == []

    missing = client.post("/settings/integrations/agents/no_such_agent/connect")
    assert missing.status_code == 404

    unconfigured = client.put(
        "/settings/integrations",
        json={"externalAgents": [{"id": "ea_none", "name": "No command", "protocol": "acp", "enabled": True}]},
    )
    assert unconfigured.status_code == 200
    refused = client.post("/settings/integrations/agents/ea_none/connect")
    assert refused.status_code == 400


def test_profile_and_preferred_actions_persist(tmp_path: Path) -> None:
    client = make_client(tmp_path)

    defaults = client.get("/settings").json()
    assert defaults["profile"] == {"displayName": "", "avatarType": "preset", "avatarValue": "", "avatarBackground": None, "workspaceLabel": ""}
    assert defaults["preferredActions"] == {}

    updated = client.put(
        "/settings",
        json={
            "profile": {"displayName": "Xiaotong", "avatarType": "emoji", "avatarValue": "🦊", "avatarBackground": "#1f6f4a", "workspaceLabel": "Studio"},
            "preferredActions": {"default": "openai-compatible"},
        },
    )
    assert updated.status_code == 200
    assert updated.json()["profile"]["displayName"] == "Xiaotong"
    assert updated.json()["profile"]["avatarValue"] == "🦊"
    assert updated.json()["preferredActions"] == {"default": "openai-compatible"}

    persisted = client.get("/settings").json()
    assert persisted["profile"]["displayName"] == "Xiaotong"
    assert persisted["preferredActions"]["default"] == "openai-compatible"


def test_docker_settings_persist_in_developer_preferences(tmp_path: Path) -> None:
    client = make_client(tmp_path)

    updated = client.put(
        "/settings",
        json={
            "developerMode": True,
            "dockerImage": "python:3.12-alpine",
            "dockerMemory": "1g",
            "dockerCpus": "2",
            "dockerPidsLimit": 256,
        },
    )

    assert updated.status_code == 200
    body = updated.json()
    assert body["developerMode"] is True
    assert body["dockerImage"] == "python:3.12-alpine"
    assert body["dockerMemory"] == "1g"
    assert body["dockerCpus"] == "2"
    assert body["dockerPidsLimit"] == 256
    assert client.get("/settings").json()["dockerImage"] == "python:3.12-alpine"


def test_file_upload_copies_into_workspace_and_is_scannable(tmp_path: Path) -> None:
    client = make_client(tmp_path)

    response = client.post("/uploads", files={"files": ("../escape report.txt", b"hello upload", "text/plain")})
    assert response.status_code == 200
    saved = response.json()["files"]
    assert len(saved) == 1
    assert ".." not in saved[0]["path"]
    assert saved[0]["path"].startswith("uploads/")
    assert saved[0]["size"] == len(b"hello upload")
    # The uploaded file is a real workspace file the File Agent can scan.
    uploaded = tmp_path / "workspaces" / "default" / saved[0]["path"]
    assert uploaded.exists()
    assert uploaded.read_text(encoding="utf-8") == "hello upload"

    run = client.post("/runs", json={"task": "List workspace files"})
    run_id = run.json()["id"]
    events = client.get("/events", params={"runId": run_id}).json()
    observations = [e["event"]["payload"] for e in events if e["event"]["type"] == "observation.created"]
    file_obs = next(o for o in observations if o["type"] == "FileObservation")
    assert any(item["name"] == "uploads" for item in file_obs["structuredOutput"]["items"])


def test_file_upload_to_project_workspace(tmp_path: Path) -> None:
    client = make_client(tmp_path)
    project = client.post("/projects", json={"name": "Docs"}).json()
    response = client.post(
        f"/uploads?projectId={project['id']}",
        files={"files": ("brief.md", b"project file", "text/markdown")},
    )
    assert response.status_code == 200
    uploaded = Path(project["workspacePath"]) / "uploads" / "brief.md"
    assert uploaded.exists()


def test_agent_instances_and_actors_persist_and_update(tmp_path: Path) -> None:
    workspace = tmp_path / "workspaces" / "default"
    workspace.mkdir(parents=True)
    (workspace / "n.txt").write_text("x", encoding="utf-8")
    client = make_client(tmp_path)
    service = client.app.state.runtime_service

    instances = client.get("/agent-instances").json()
    ids = {i["profileId"] for i in instances}
    assert {"agent_manager", "agent_file"}.issubset(ids)
    actors = client.get("/agent-actors").json()
    assert len(actors) == len(instances)
    file_actor = next(a for a in actors if a["profileId"] == "agent_file")
    assert file_actor["station"] == "file"

    # A real run drives the File agent and must persist its instance/actor state.
    client.post("/runs", json={"task": "List workspace files"})
    file_instance = next(i for i in service.storage.list_agent_instances(None) if i.profileId == "agent_file")
    assert file_instance.status in {"done", "working", "failed"}
    assert file_instance.fatigue > 0
    file_actor2 = next(a for a in service.storage.list_agent_actors(None) if a.profileId == "agent_file")
    assert file_actor2.animation in {"organizing_files", "celebrating", "failed"}


def test_interrupted_runs_are_reconciled_on_restart(tmp_path: Path) -> None:
    """A run left mid-flight when the process died must be marked failed on the next start."""
    from yanshi_runtime.config import RuntimeSettings
    from yanshi_runtime.storage import Storage

    settings = RuntimeSettings(data_dir=tmp_path, runtime_version="test")
    storage = Storage(settings.database_path, "test")
    run = storage.create_run("long task")
    storage.update_run(run.id, status="running")
    storage.conn.close()

    reopened = Storage(settings.database_path, "test")
    count = reopened.reconcile_interrupted_runs()
    assert count == 1
    recovered = reopened.get_run(run.id)
    assert recovered.status == "failed"
    assert "interrupted" in (recovered.resultSummary or "").lower()
    # Idempotent: a second reconcile finds nothing.
    assert reopened.reconcile_interrupted_runs() == 0


def test_scoped_tickets_replace_the_url_token(tmp_path: Path) -> None:
    """The raw token is header-only; header-less callers use short-lived, scope-bound tickets."""
    settings = RuntimeSettings(data_dir=tmp_path, runtime_version="test", api_token="test-token", synchronous_runs=True)
    app = create_app(settings)
    authed = TestClient(app, headers={"Authorization": "Bearer test-token"})
    anon = TestClient(app)

    # The raw token in a URL no longer authorizes anything.
    assert anon.get("/preview", params={"path": "x.png", "token": "test-token"}).status_code == 401
    # Minting a ticket requires the header.
    assert anon.post("/auth/ticket", json={"scope": "preview"}).status_code == 401

    preview_ticket = authed.post("/auth/ticket", json={"scope": "preview"}).json()["ticket"]
    events_ticket = authed.post("/auth/ticket", json={"scope": "events"}).json()["ticket"]
    # Wrong scope is rejected; correct scope authorizes (then 404 for the missing file).
    assert anon.get("/preview", params={"path": "missing.png", "ticket": events_ticket}).status_code == 401
    assert anon.get("/preview", params={"path": "missing.png", "ticket": preview_ticket}).status_code == 404


def test_integration_env_secrets_stay_out_of_db_and_api(tmp_path: Path) -> None:
    """ACP/MCP env values are stored in the SecretStore (off-DB) and never returned raw; the masked
    round-trip preserves a saved secret, and connect resolves it back."""
    from yanshi_runtime.models import AiIntegrationsUpdate, ExternalAgentConfig
    from yanshi_runtime.storage import _INTEGRATION_SECRET_SENTINEL, Storage

    storage = Storage(tmp_path / "yanshi.db", "test")
    agent = ExternalAgentConfig(id="ea_1", name="Helper", command="run", env={"API_KEY": "super-secret"})
    storage.update_ai_integrations(AiIntegrationsUpdate(externalAgents=[agent]))

    # API read masks the secret.
    public = storage.get_ai_integrations()
    assert public.externalAgents[0].env["API_KEY"] == _INTEGRATION_SECRET_SENTINEL
    # The raw secret is not in the SQLite settings row.
    raw_settings = json.dumps(storage.get_setting("integrations"))
    assert "super-secret" not in raw_settings
    # Resolved read (used only for launching) returns the real value.
    assert storage.get_ai_integrations_resolved().externalAgents[0].env["API_KEY"] == "super-secret"

    # Saving the masked value back preserves the stored secret (no clobber to the sentinel).
    masked = public.externalAgents[0]
    storage.update_ai_integrations(AiIntegrationsUpdate(externalAgents=[masked]))
    assert storage.get_ai_integrations_resolved().externalAgents[0].env["API_KEY"] == "super-secret"


def test_execute_node_short_circuits_when_cancelled(tmp_path: Path) -> None:
    """Cooperative cancellation: once a run is cancelled, the executor stops launching tool steps
    and skips synthesis instead of producing a final answer."""
    from yanshi_runtime.graph import RuntimeGraph
    from yanshi_runtime.providers import OpenAICompatibleProvider
    from yanshi_runtime.storage import Storage

    storage = Storage(tmp_path / "yanshi.db", "test")
    graph = RuntimeGraph(
        storage=storage,
        checkpoint_path=tmp_path / "checkpoints.db",
        workspace_root=tmp_path / "workspaces",
        provider=OpenAICompatibleProvider(None),
    )
    graph.request_cancel("run_x")
    result = graph._execute_node(
        {"run_id": "run_x", "task": "do things", "agent_tasks": [{"agentId": "agent_terminal", "task": "x", "taskId": None}]}
    )
    assert result["result_summary"] == "Run cancelled."


def test_net_guard_blocks_internal_and_metadata_targets() -> None:
    from yanshi_runtime.net_guard import BlockedHostError, validate_outbound_url

    # Cloud metadata is blocked for everyone, even with block_private=False.
    with pytest.raises(BlockedHostError):
        validate_outbound_url("http://169.254.169.254/latest/meta-data/", block_private=False)
    with pytest.raises(BlockedHostError):
        validate_outbound_url("http://metadata.google.internal/", block_private=False)
    # Non-http(s) schemes are blocked.
    with pytest.raises(BlockedHostError):
        validate_outbound_url("file:///etc/passwd", block_private=True)
    # Browser-style guard blocks loopback/private.
    with pytest.raises(BlockedHostError):
        validate_outbound_url("http://127.0.0.1:8765/", block_private=True)
    with pytest.raises(BlockedHostError):
        validate_outbound_url("http://192.168.1.1/", block_private=True)
    # Provider-style guard allows loopback (local model servers) but never metadata.
    validate_outbound_url("http://127.0.0.1:11434/v1", block_private=False)


def test_terminal_run_status_is_frozen(tmp_path: Path) -> None:
    from yanshi_runtime.storage import Storage

    storage = Storage((tmp_path / "yanshi.db"), "test")
    run = storage.create_run("task")
    storage.update_run(run.id, status="completed", completed=True)
    # A late finalizer / stray cancel must not move it back to a non-terminal state.
    after = storage.update_run(run.id, status="running")
    assert after.status == "completed"
    # Nor flip one terminal state to another.
    assert storage.update_run(run.id, status="cancelled").status == "completed"


def test_followup_run_rejects_unknown_parent(tmp_path: Path) -> None:
    client = make_client(tmp_path)
    created = client.post("/runs", json={"task": "follow up", "parentRunId": "run_does_not_exist"})
    assert created.status_code == 400
    assert "does not exist" in created.text


def test_unexpected_errors_return_a_coded_envelope(tmp_path: Path) -> None:
    """An unhandled exception is logged server-side and surfaced as a stable coded 500, not a leaked
    traceback."""
    settings = RuntimeSettings(data_dir=tmp_path, runtime_version="test", api_token="test-token", synchronous_runs=True)
    app = create_app(settings)

    @app.get("/boom")
    def boom():
        raise RuntimeError("kaboom")

    client = TestClient(app, headers={"Authorization": "Bearer test-token"}, raise_server_exceptions=False)
    response = client.get("/boom")
    assert response.status_code == 500
    body = response.json()
    assert body["code"] == "YANSHI_RUNTIME_500"
    assert "kaboom" not in response.text  # internal detail not leaked


def test_image_preview_serves_workspace_images_safely(tmp_path: Path) -> None:
    """The preview endpoint serves a real workspace image, rejects path traversal, and rejects
    non-image types."""
    client = make_client(tmp_path)
    project = client.post("/projects", json={"name": "Pics"}).json()
    workspace = Path(project["workspacePath"])
    # A minimal valid 1x1 PNG.
    png_bytes = bytes.fromhex(
        "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4"
        "890000000a49444154789c6360000002000154a24f5f0000000049454e44ae426082"
    )
    (workspace / "shot.png").write_bytes(png_bytes)
    (workspace / "notes.txt").write_text("not an image", encoding="utf-8")

    (workspace / "vector.svg").write_text("<svg xmlns='http://www.w3.org/2000/svg'></svg>", encoding="utf-8")

    ok = client.get("/preview", params={"projectId": project["id"], "path": "shot.png"})
    assert ok.status_code == 200
    assert ok.headers["content-type"] == "image/png"
    assert ok.content == png_bytes
    # Defense-in-depth headers stop MIME sniffing and neutralize active content.
    assert ok.headers["x-content-type-options"] == "nosniff"
    assert "default-src 'none'" in ok.headers["content-security-policy"]

    # Non-image type is refused.
    assert client.get("/preview", params={"projectId": project["id"], "path": "notes.txt"}).status_code == 415
    # SVG is refused — it's an active document that could carry script.
    assert client.get("/preview", params={"projectId": project["id"], "path": "vector.svg"}).status_code == 415
    # Path traversal is refused.
    assert client.get("/preview", params={"projectId": project["id"], "path": "../../etc/hosts"}).status_code == 403
    # Missing file is a 404.
    assert client.get("/preview", params={"projectId": project["id"], "path": "missing.png"}).status_code == 404


def test_schema_version_is_stamped_and_stable(tmp_path: Path) -> None:
    """A fresh db is stamped at the current schema version, and reopening it is a no-op (the
    migration runner doesn't re-run baseline steps)."""
    from yanshi_runtime.config import RuntimeSettings
    from yanshi_runtime.storage import _SCHEMA_VERSION, Storage

    settings = RuntimeSettings(data_dir=tmp_path, runtime_version="test")
    storage = Storage(settings.database_path, "test")
    assert storage.schema_version() == _SCHEMA_VERSION
    storage.conn.close()

    reopened = Storage(settings.database_path, "test")
    assert reopened.schema_version() == _SCHEMA_VERSION


def test_concurrent_writers_do_not_corrupt_or_lose_rows(tmp_path: Path) -> None:
    """Many threads hammering create_run on the single shared connection must serialize cleanly:
    no 'database is locked', no lost writes."""
    from yanshi_runtime.config import RuntimeSettings
    from yanshi_runtime.storage import Storage

    settings = RuntimeSettings(data_dir=tmp_path, runtime_version="test")
    storage = Storage(settings.database_path, "test")
    created: list[str] = []
    lock = threading.Lock()

    def worker(n: int) -> None:
        run = storage.create_run(f"task {n}")
        with lock:
            created.append(run.id)

    with ThreadPoolExecutor(max_workers=12) as pool:
        list(pool.map(worker, range(120)))

    assert len(created) == 120
    assert len(set(created)) == 120  # unique ids, nothing clobbered
    row = storage.conn.execute("SELECT COUNT(*) AS n FROM runs").fetchone()
    assert int(row["n"]) == 120


def test_runs_execute_on_the_worker_pool(tmp_path: Path) -> None:
    """With the default (non-synchronous) config, a run is dispatched to the pool and completes
    asynchronously — the POST returns immediately and the run finishes shortly after."""
    settings = RuntimeSettings(data_dir=tmp_path, runtime_version="test", api_token="test-token")  # synchronous_runs=False
    client = TestClient(create_app(settings), headers={"Authorization": "Bearer test-token"})
    with FakeOpenAIServer() as base_url:
        client.put("/settings/provider", json={"baseUrl": base_url, "model": "yanshi-test-model"})
        created = client.post("/runs", json={"task": "Write a concise hello"})
        run_id = created.json()["id"]
        deadline = time.monotonic() + 10
        status = created.json()["status"]
        while status not in {"completed", "failed"} and time.monotonic() < deadline:
            time.sleep(0.05)
            status = client.get(f"/runs/{run_id}").json()["status"]
    assert status == "completed"


def test_requests_require_the_session_token(tmp_path: Path) -> None:
    """Every endpoint except /health rejects requests without the bearer token; /health stays open
    for liveness probes."""
    settings = RuntimeSettings(data_dir=tmp_path, runtime_version="test", api_token="test-token", synchronous_runs=True)
    app = create_app(settings)
    # No default header -> unauthenticated.
    anon = TestClient(app)
    assert anon.get("/health").status_code == 200
    assert anon.get("/runs").status_code == 401
    assert anon.post("/runs", json={"task": "hi"}).status_code == 401
    # Wrong token is also rejected.
    assert anon.get("/runs", headers={"Authorization": "Bearer nope"}).status_code == 401
    # Correct token (either header form) is accepted.
    assert anon.get("/runs", headers={"Authorization": "Bearer test-token"}).status_code == 200
    assert anon.get("/runs", headers={"X-Yanshi-Token": "test-token"}).status_code == 200


def test_provider_retries_transient_failures() -> None:
    """A transient 503 is retried with backoff and the next attempt succeeds."""
    from yanshi_runtime.providers import OpenAICompatibleProvider, ProviderConfig

    state = {"calls": 0}

    class FlakyHandler(BaseHTTPRequestHandler):
        def do_POST(self) -> None:  # noqa: N802
            state["calls"] += 1
            if state["calls"] == 1:
                self.send_response(503)
                self.send_header("content-length", "0")
                self.end_headers()
                return
            body = json.dumps({"choices": [{"message": {"role": "assistant", "content": "recovered"}}]}).encode()
            self.send_response(200)
            self.send_header("content-type", "application/json")
            self.send_header("content-length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)

        def log_message(self, *args: object) -> None:
            return

    server = ThreadingHTTPServer(("127.0.0.1", 0), FlakyHandler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        base = f"http://127.0.0.1:{server.server_port}/v1"
        provider = OpenAICompatibleProvider(ProviderConfig.from_secret_settings({"baseUrl": base, "model": "m", "apiKey": ""}))
        # Patch backoff to near-zero so the test is fast.
        import yanshi_runtime.providers.openai_compatible as mod

        original = mod._backoff_seconds
        mod._backoff_seconds = lambda attempt: 0.01
        try:
            from yanshi_runtime.models import ChatMessage

            assert provider.chat_completion([ChatMessage(role="user", content="hi")]) == "recovered"
        finally:
            mod._backoff_seconds = original
        assert state["calls"] == 2
    finally:
        server.shutdown()
        thread.join(timeout=5)


def test_storage_is_thread_safe_under_concurrency(tmp_path: Path) -> None:
    """Many threads hammering the shared connection (runs + events + reads) must not race or
    raise — the storage serializes all access behind its lock."""
    from yanshi_runtime.config import RuntimeSettings
    from yanshi_runtime.storage import Storage

    settings = RuntimeSettings(data_dir=tmp_path, runtime_version="test")
    storage = Storage(settings.database_path, "test")
    errors: list[Exception] = []

    def worker(n: int) -> None:
        try:
            for i in range(25):
                run = storage.create_run(f"task {n}-{i}")
                storage.append_event("run.started", run_id=run.id, payload={"task": run.task})
                storage.create_observation(run.id, "MessageObservation", "ok", agent_id="agent_manager")
                storage.list_events(run_id=run.id)
                storage.list_runs()
        except Exception as exc:  # noqa: BLE001
            errors.append(exc)

    threads = [threading.Thread(target=worker, args=(n,)) for n in range(8)]
    for thread in threads:
        thread.start()
    for thread in threads:
        thread.join()

    assert errors == []
    assert len(storage.list_runs()) == 8 * 25


def test_agent_office_state_survives_restart(tmp_path: Path) -> None:
    from yanshi_runtime.config import RuntimeSettings
    from yanshi_runtime.storage import Storage

    settings = RuntimeSettings(data_dir=tmp_path, runtime_version="test")
    storage = Storage(settings.database_path, "test")
    storage.ensure_agent_team(None)
    storage.update_agent_state(None, "agent_file", status="done", current_task="Scan", fatigue_delta=0.3)
    storage.conn.close()

    reopened = Storage(settings.database_path, "test")
    instance = next(i for i in reopened.list_agent_instances(None) if i.profileId == "agent_file")
    assert instance.fatigue == 0.3
    assert instance.status == "done"


def test_reasoning_level_and_profile_affect_manager_prompt(tmp_path: Path) -> None:
    client = make_client(tmp_path)
    service = client.app.state.runtime_service
    provider = SequencedProvider(
        [
            json.dumps({"steps": ["Understand", "Answer"], "tasks": [{"agentId": "agent_manager", "task": "Answer the question."}]}),
            "Final answer.",
        ]
    )
    service.provider = provider
    service.graph.provider = provider
    # Give the Manager profile a distinctive personality and pick Extra High reasoning.
    client.put("/agent-profiles/agent_manager", json={"personality": "Zephyr-coordinator-signature"})

    created = client.post("/runs", json={"task": "Write a concise hello", "reasoning": "extra_high"})
    assert created.status_code == 200
    run = client.get(f"/runs/{created.json()['id']}").json()
    assert run["status"] == "completed"

    planning_prompt = json.dumps(provider.calls[0])
    assert "Zephyr-coordinator-signature" in planning_prompt
    assert "Decompose thoroughly" in planning_prompt
    assert "extra_high" in planning_prompt


def test_agent_profile_persona_in_file_agent_execution_context(tmp_path: Path) -> None:
    workspace = tmp_path / "workspaces" / "default"
    workspace.mkdir(parents=True)
    (workspace / "n.txt").write_text("x", encoding="utf-8")
    client = make_client(tmp_path)
    client.put("/agent-profiles/agent_file", json={"personality": "Tidy-file-signature"})

    created = client.post("/runs", json={"task": "List workspace files"})
    run_id = created.json()["id"]
    events = client.get("/events", params={"runId": run_id}).json()
    actions = [e["event"]["payload"] for e in events if e["event"]["type"] == "action.created"]
    file_action = next(a for a in actions if a["type"] == "FileAction")
    assert "Tidy-file-signature" in file_action["input"]["persona"]
    # Persona is delimited as advisory (prompt-injection separation).
    assert "advisory" in file_action["input"]["persona"]


def test_agent_profile_persona_in_terminal_and_computer_context(tmp_path: Path) -> None:
    client = make_client(tmp_path)
    client.put("/settings", json={"terminalToolEnabled": True})
    client.put("/agent-profiles/agent_terminal", json={"personality": "Precise-terminal-signature"})
    client.put("/agent-profiles/agent_computer", json={"personality": "Steady-computer-signature"})

    term = client.post("/runs", json={"task": "Run command `ls` in terminal", "permissionMode": "full_access"})
    term_events = client.get("/events", params={"runId": term.json()["id"]}).json()
    term_action = next(e["event"]["payload"] for e in term_events if e["event"]["type"] == "action.created" and e["event"]["payload"]["type"] == "TerminalAction")
    assert "Precise-terminal-signature" in term_action["input"]["persona"]

    comp = client.post("/runs", json={"task": "Take a computer screenshot", "permissionMode": "auto_review"})
    comp_events = client.get("/events", params={"runId": comp.json()["id"]}).json()
    comp_action = next(e["event"]["payload"] for e in comp_events if e["event"]["type"] == "action.created" and e["event"]["payload"]["type"] == "ComputerAction")
    assert "Steady-computer-signature" in comp_action["input"]["persona"]


def test_reasoning_default_comes_from_settings(tmp_path: Path) -> None:
    client = make_client(tmp_path)
    service = client.app.state.runtime_service
    provider = SequencedProvider(
        [
            json.dumps({"steps": ["Answer"], "tasks": [{"agentId": "agent_manager", "task": "Answer."}]}),
            "Done.",
        ]
    )
    service.provider = provider
    service.graph.provider = provider
    client.put("/settings", json={"reasoning": "low"})

    created = client.post("/runs", json={"task": "Write a concise hello"})
    assert created.status_code == 200
    planning_prompt = json.dumps(provider.calls[0])
    assert "Keep the plan short and direct" in planning_prompt


def test_agent_profiles_seed_and_update(tmp_path: Path) -> None:
    client = make_client(tmp_path)

    profiles = client.get("/agent-profiles").json()
    ids = {p["id"] for p in profiles}
    assert {"agent_manager", "agent_browser", "agent_file", "agent_reviewer"}.issubset(ids)
    manager = next(p for p in profiles if p["id"] == "agent_manager")
    assert manager["station"] == "manager"
    assert manager["accent"].startswith("#")

    updated = client.put("/agent-profiles/agent_file", json={"behaviorMode": "playful", "accent": "#123456", "taskPriority": 8})
    assert updated.status_code == 200
    body = updated.json()
    assert body["behaviorMode"] == "playful"
    assert body["accent"] == "#123456"
    assert body["taskPriority"] == 8
    assert client.get("/agent-profiles").json()  # still listable
    assert next(p for p in client.get("/agent-profiles").json() if p["id"] == "agent_file")["behaviorMode"] == "playful"


def test_agent_profile_create_and_delete(tmp_path: Path) -> None:
    client = make_client(tmp_path)
    created = client.post("/agent-profiles", json={"name": "Scout", "station": "browser", "behaviorMode": "playful"})
    assert created.status_code == 200
    profile_id = created.json()["id"]
    assert created.json()["name"] == "Scout"
    assert client.delete(f"/agent-profiles/{profile_id}").status_code == 204
    assert all(p["id"] != profile_id for p in client.get("/agent-profiles").json())


def test_live_office_state_default_and_upsert(tmp_path: Path) -> None:
    client = make_client(tmp_path)
    project = client.post("/projects", json={"name": "Office"}).json()

    default = client.get("/live-office", params={"projectId": project["id"]}).json()
    assert default["theme"] == "warm-light"
    assert default["behaviorMode"] == "balanced"

    updated = client.put(
        "/live-office",
        params={"projectId": project["id"]},
        json={"behaviorMode": "playful", "cameraMode": "iso", "stationLayout": {"file": [1.0, 2.0]}},
    )
    assert updated.status_code == 200
    assert updated.json()["behaviorMode"] == "playful"
    assert updated.json()["cameraMode"] == "iso"
    assert updated.json()["stationLayout"]["file"] == [1.0, 2.0]
    # Persisted and project-scoped.
    assert client.get("/live-office", params={"projectId": project["id"]}).json()["cameraMode"] == "iso"
    assert client.get("/live-office").json()["cameraMode"] == "rear"


def test_office_furniture_persists_and_exports(tmp_path: Path) -> None:
    client = make_client(tmp_path)
    updated = client.put(
        "/live-office",
        json={"furniture": [{"id": "f1", "type": "plant", "x": 1.2, "z": -0.4}, {"id": "f2", "type": "desk", "x": -2.0, "z": 1.0}]},
    )
    assert updated.status_code == 200
    furniture = updated.json()["furniture"]
    assert len(furniture) == 2
    assert {item["type"] for item in furniture} == {"plant", "desk"}
    # Persisted.
    assert len(client.get("/live-office").json()["furniture"]) == 2
    # Included in the exported pack theme.
    export = client.post("/workshop/export")
    with zipfile.ZipFile(io.BytesIO(export.content)) as archive:
        office = json.loads(archive.read("themes/office.json"))
    assert len(office["furniture"]) == 2


def test_workshop_export_is_reimportable(tmp_path: Path) -> None:
    client = make_client(tmp_path)
    export = client.post("/workshop/export")
    assert export.status_code == 200
    assert export.headers["content-type"] == "application/zip"

    pack_bytes = export.content
    assert pack_bytes[:2] == b"PK"
    with zipfile.ZipFile(io.BytesIO(pack_bytes)) as archive:
        names = archive.namelist()
        assert "manifest.json" in names
        assert any(name.startswith("agents/") for name in names)
        assert "themes/office.json" in names

    imported = client.post("/workshop/import", files={"pack": ("yanshi-team.zip", pack_bytes, "application/zip")})
    assert imported.status_code == 200
    assert imported.json()["name"] == "Yanshi Team Export"


def test_artifacts_endpoint_lists_created_artifacts(tmp_path: Path) -> None:
    workspace = tmp_path / "workspaces" / "default"
    workspace.mkdir(parents=True)
    (workspace / "a.txt").write_text("x", encoding="utf-8")
    client = make_client(tmp_path)

    created = client.post("/runs", json={"task": "List workspace files"})
    assert created.status_code == 200
    run_id = created.json()["id"]

    artifacts = client.get("/artifacts").json()
    assert any(a["runId"] == run_id and a["kind"] == "JSON" for a in artifacts)
    by_run = client.get("/artifacts", params={"runId": run_id}).json()
    assert len(by_run) >= 1
    assert all(a["runId"] == run_id for a in by_run)


def test_automation_crud_and_manual_run(tmp_path: Path) -> None:
    workspace = tmp_path / "workspaces" / "default"
    workspace.mkdir(parents=True)
    (workspace / "note.txt").write_text("x", encoding="utf-8")
    client = make_client(tmp_path)

    created = client.post("/automations", json={"name": "Nightly scan", "task": "List workspace files"})
    assert created.status_code == 200
    automation = created.json()
    automation_id = automation["id"]
    assert automation["enabled"] is True
    assert automation["scheduleKind"] == "manual"

    listed = client.get("/automations").json()
    assert [a["id"] for a in listed] == [automation_id]

    run = client.post(f"/automations/{automation_id}/run")
    assert run.status_code == 200
    run_id = run.json()["id"]
    history = client.get(f"/automations/{automation_id}/runs").json()
    assert [r["id"] for r in history] == [run_id]
    assert client.get(f"/runs/{run_id}").json()["status"] == "completed"

    disabled = client.put(f"/automations/{automation_id}", json={"enabled": False})
    assert disabled.json()["enabled"] is False

    events = [e["event"]["type"] for e in client.get("/events").json()]
    assert "automation.created" in events
    assert "automation.started" in events

    deleted = client.delete(f"/automations/{automation_id}")
    assert deleted.status_code == 204
    assert client.get("/automations").json() == []


def test_interval_automation_is_due_and_runs(tmp_path: Path) -> None:
    from datetime import UTC, datetime, timedelta

    from yanshi_runtime.server.app import is_automation_due

    workspace = tmp_path / "workspaces" / "default"
    workspace.mkdir(parents=True)
    (workspace / "note.txt").write_text("x", encoding="utf-8")
    client = make_client(tmp_path)
    service = client.app.state.runtime_service

    created = client.post(
        "/automations",
        json={"name": "Every 15m", "task": "List workspace files", "scheduleKind": "interval", "intervalMinutes": 15},
    )
    assert created.status_code == 200
    automation_id = created.json()["id"]

    now = datetime.now(UTC)
    launched = service.run_due_automations(now)
    assert launched == 1
    assert len(service.storage.list_automation_runs(automation_id)) == 1

    # Immediately after running it is no longer due.
    assert service.run_due_automations(now) == 0
    refreshed = service.storage.get_automation(automation_id)
    assert is_automation_due(refreshed, now) is False
    # After the interval elapses it is due again.
    assert is_automation_due(refreshed, now + timedelta(minutes=16)) is True


def test_interval_automation_requires_minutes(tmp_path: Path) -> None:
    client = make_client(tmp_path)
    response = client.post("/automations", json={"name": "Bad", "task": "x", "scheduleKind": "interval"})
    assert response.status_code == 400


def test_plan_first_forces_approval_then_resumes(tmp_path: Path) -> None:
    workspace = tmp_path / "workspaces" / "default"
    workspace.mkdir(parents=True)
    (workspace / "notes.txt").write_text("hello", encoding="utf-8")
    client = make_client(tmp_path)

    created = client.post("/runs", json={"task": "List workspace files", "planFirst": True})
    assert created.status_code == 200
    run_id = created.json()["id"]

    run = client.get(f"/runs/{run_id}").json()
    assert run["status"] == "pending_approval"
    approvals = client.get("/approvals").json()
    assert len(approvals) == 1
    assert "plan" in approvals[0]["request"].lower()

    decided = client.post(f"/approvals/{approvals[0]['id']}/decision", json={"decision": "approved"})
    assert decided.status_code == 200
    resumed = client.get(f"/runs/{run_id}").json()
    assert resumed["status"] == "completed"


def test_project_files_endpoint_lists_workspace(tmp_path: Path) -> None:
    client = make_client(tmp_path)
    project = client.post("/projects", json={"name": "Files"}).json()
    workspace = Path(project["workspacePath"])
    (workspace / "report.md").write_text("draft", encoding="utf-8")

    response = client.get(f"/projects/{project['id']}/files")
    assert response.status_code == 200
    body = response.json()
    assert body["ok"] is True
    assert any(item["name"] == "report.md" for item in body["structuredOutput"]["items"])

    missing = client.get("/projects/proj_missing/files")
    assert missing.status_code == 404


def test_disabled_terminal_tool_returns_tool_disabled(tmp_path: Path) -> None:
    client = make_client(tmp_path)
    service = client.app.state.runtime_service
    # terminalToolEnabled defaults to False; leave it off.

    created = client.post(
        "/runs",
        json={"task": "Run command `ls` in terminal", "permissionMode": "full_access"},
    )

    assert created.status_code == 200
    run_id = created.json()["id"]
    run = client.get(f"/runs/{run_id}").json()
    assert run["status"] == "failed"

    events = client.get("/events", params={"runId": run_id}).json()
    observations = [entry["event"]["payload"] for entry in events if entry["event"]["type"] == "observation.created"]
    terminal_observation = next(observation for observation in observations if observation["type"] == "TerminalObservation")
    assert terminal_observation["error"] == "tool_disabled"
    assert terminal_observation["structuredOutput"]["setting"] == "terminalToolEnabled"
    terminal_tasks = service.storage.list_agent_tasks(run_id=run_id, agent_id="agent_terminal")
    assert [task.status for task in terminal_tasks] == ["failed"]


def test_disabled_browser_tool_returns_tool_disabled(tmp_path: Path) -> None:
    client = make_client(tmp_path)
    client.put("/settings", json={"browserToolEnabled": False})

    created = client.post(
        "/runs",
        json={"task": "Use browser https://example.test", "permissionMode": "auto_review"},
    )

    assert created.status_code == 200
    run_id = created.json()["id"]
    run = client.get(f"/runs/{run_id}").json()
    assert run["status"] == "failed"

    events = client.get("/events", params={"runId": run_id}).json()
    observations = [entry["event"]["payload"] for entry in events if entry["event"]["type"] == "observation.created"]
    browser_observation = next(observation for observation in observations if observation["type"] == "BrowserObservation")
    assert browser_observation["error"] == "tool_disabled"
    assert browser_observation["structuredOutput"]["setting"] == "browserToolEnabled"


def test_disabled_computer_tool_returns_tool_disabled(tmp_path: Path) -> None:
    client = make_client(tmp_path)
    client.put("/settings", json={"computerToolEnabled": False})

    created = client.post(
        "/runs",
        json={"task": "Click 10, 20 on the computer", "permissionMode": "auto_review"},
    )

    assert created.status_code == 200
    run_id = created.json()["id"]
    run = client.get(f"/runs/{run_id}").json()
    assert run["status"] == "failed"

    events = client.get("/events", params={"runId": run_id}).json()
    observations = [entry["event"]["payload"] for entry in events if entry["event"]["type"] == "observation.created"]
    computer_observation = next(observation for observation in observations if observation["type"] == "ComputerObservation")
    assert computer_observation["error"] == "tool_disabled"
    assert computer_observation["structuredOutput"]["setting"] == "computerToolEnabled"


def test_docker_config_validation_rejects_unsafe_values() -> None:
    from yanshi_runtime.tools import validate_docker_config

    assert validate_docker_config("alpine:3.20", "512m", "1", 128) is None

    bad_image = validate_docker_config("alpine; rm -rf /", "512m", "1", 128)
    assert bad_image is not None and bad_image.missingRequirement == "docker_config_invalid"
    assert "dockerImage" in bad_image.structuredOutput["invalid"]

    bad_memory = validate_docker_config("alpine:3.20", "lots", "1", 128)
    assert bad_memory is not None and "dockerMemory" in bad_memory.structuredOutput["invalid"]

    bad_cpus = validate_docker_config("alpine:3.20", "512m", "0", 128)
    assert bad_cpus is not None and "dockerCpus" in bad_cpus.structuredOutput["invalid"]

    bad_pids = validate_docker_config("alpine:3.20", "512m", "1", 0)
    assert bad_pids is not None and "dockerPidsLimit" in bad_pids.structuredOutput["invalid"]


def test_docker_run_uses_persisted_developer_settings(tmp_path: Path) -> None:
    captured: list[list[str]] = []

    def runner(
        args: list[str],
        *,
        cwd: Path | None = None,
        env: dict[str, str] | None = None,
        capture_output: bool,
        text: bool,
        timeout: int,
        check: bool,
    ) -> subprocess.CompletedProcess[str]:
        if args == ["docker", "info"]:
            return subprocess.CompletedProcess(args, 0, "ready", "")
        captured.append(args)
        return subprocess.CompletedProcess(args, 0, "done\n", "")

    client = make_client(tmp_path)
    service = client.app.state.runtime_service
    service.graph.terminal_tool = TerminalTool(runner=runner)
    client.put(
        "/settings",
        json={
            "terminalToolEnabled": True,
            "dockerImage": "python:3.12-alpine",
            "dockerMemory": "1g",
            "dockerCpus": "2",
            "dockerPidsLimit": 256,
        },
    )

    created = client.post(
        "/runs",
        json={"task": "Run command `echo hi` in Docker", "permissionMode": "full_access"},
    )

    assert created.status_code == 200
    run = client.get(f"/runs/{created.json()['id']}").json()
    assert run["status"] == "completed"
    docker_run = next(args for args in captured if args[:2] == ["docker", "run"])
    assert "python:3.12-alpine" in docker_run
    assert docker_run[docker_run.index("--memory") + 1] == "1g"
    assert docker_run[docker_run.index("--cpus") + 1] == "2"
    assert docker_run[docker_run.index("--pids-limit") + 1] == "256"


def test_docker_run_rejects_invalid_persisted_settings(tmp_path: Path) -> None:
    def runner(
        args: list[str],
        *,
        cwd: Path | None = None,
        env: dict[str, str] | None = None,
        capture_output: bool,
        text: bool,
        timeout: int,
        check: bool,
    ) -> subprocess.CompletedProcess[str]:
        raise AssertionError("Docker must not run with invalid settings.")

    client = make_client(tmp_path)
    service = client.app.state.runtime_service
    service.graph.terminal_tool = TerminalTool(runner=runner)
    client.put("/settings", json={"terminalToolEnabled": True, "dockerImage": "bad image name"})

    created = client.post(
        "/runs",
        json={"task": "Run command `echo hi` in Docker", "permissionMode": "full_access"},
    )

    assert created.status_code == 200
    run_id = created.json()["id"]
    run = client.get(f"/runs/{run_id}").json()
    assert run["status"] == "failed"
    events = client.get("/events", params={"runId": run_id}).json()
    observations = [entry["event"]["payload"] for entry in events if entry["event"]["type"] == "observation.created"]
    terminal_observation = next(observation for observation in observations if observation["type"] == "TerminalObservation")
    assert terminal_observation["error"] == "docker_config_invalid"


def test_provider_api_key_stored_outside_sqlite_via_ref(tmp_path: Path) -> None:
    client = make_client(tmp_path)
    client.put(
        "/settings/provider",
        json={"baseUrl": "http://127.0.0.1:9999/v1", "model": "yanshi-test-model", "apiKey": "top-secret-key"},
    )

    # The raw key must not be present anywhere in the SQLite database file.
    db_bytes = (tmp_path / "yanshi.db").read_bytes()
    assert b"top-secret-key" not in db_bytes
    # The persisted provider setting stores only an opaque reference.
    service = client.app.state.runtime_service
    stored = service.storage.get_setting("provider")
    assert "apiKey" not in stored
    assert stored["apiKeyRef"]
    # But the runtime can still resolve the secret for provider calls.
    secret = service.storage.get_provider_settings_secret()
    assert secret is not None and secret["apiKey"] == "top-secret-key"


def test_legacy_inline_api_key_is_migrated_out_of_sqlite(tmp_path: Path) -> None:
    from yanshi_runtime.storage import Storage

    database_path = tmp_path / "yanshi.db"
    legacy = Storage(database_path, "test")
    legacy.set_setting("provider", {"baseUrl": "http://127.0.0.1/v1", "model": "m", "apiKey": "legacy-secret"})
    legacy.conn.close()

    migrated = Storage(database_path, "test")
    stored = migrated.get_setting("provider")
    assert "apiKey" not in stored
    assert stored["apiKeyRef"]
    assert migrated.get_provider_settings_secret()["apiKey"] == "legacy-secret"
    assert b"legacy-secret" not in database_path.read_bytes()


def test_parallel_hydration_requests_do_not_misuse_sqlite_connection(tmp_path: Path) -> None:
    client = make_client(tmp_path)
    client.post("/projects", json={"name": "Concurrent"})
    client.post("/runs", json={"task": "List workspace files"})
    paths = [
        "/runtime/status",
        "/runs",
        "/approvals",
        "/settings/provider",
        "/settings",
        "/projects",
    ]

    def fetch(path: str) -> int:
        return client.get(path).status_code

    with ThreadPoolExecutor(max_workers=12) as executor:
        statuses = list(executor.map(fetch, paths * 8))

    assert statuses == [200] * len(statuses)


def test_cors_allows_localhost_development_ports(tmp_path: Path) -> None:
    client = make_client(tmp_path)

    response = client.options(
        "/workshop/packs",
        headers={
            "Origin": "http://127.0.0.1:5174",
            "Access-Control-Request-Method": "GET",
        },
    )

    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "http://127.0.0.1:5174"


def test_provider_healthcheck_uses_configured_fake_server(tmp_path: Path) -> None:
    client = make_client(tmp_path)
    with FakeOpenAIServer() as base_url:
        client.put(
            "/settings/provider",
            json={"baseUrl": base_url, "model": "yanshi-test-model", "apiKey": "secret-key"},
        )
        response = client.post("/provider/health")

    assert response.status_code == 200
    body = response.json()
    assert body["ok"] is True
    assert body["status"] == "healthy"
    assert "secret-key" not in response.text


def test_configured_provider_call_creates_message_observation(tmp_path: Path) -> None:
    client = make_client(tmp_path)
    service = client.app.state.runtime_service
    with FakeOpenAIServer() as base_url:
        client.put(
            "/settings/provider",
            json={"baseUrl": base_url, "model": "yanshi-test-model", "apiKey": "secret-key"},
        )
        created = client.post("/runs", json={"task": "Write a concise hello"})

    assert created.status_code == 200
    run_id = created.json()["id"]
    run = client.get(f"/runs/{run_id}").json()
    assert run["status"] == "completed"
    assert run["resultSummary"] == "Provider response from fake server."
    assert run["plan"] == ["Understand request", "Assign Manager Agent", "Return verified response"]
    assert FakeOpenAIHandler.received_authorization == "Bearer secret-key"
    assert FakeOpenAIHandler.received_payload is not None
    assert FakeOpenAIHandler.received_payload["model"] == "yanshi-test-model"

    events = client.get("/events", params={"runId": run_id}).json()
    observations = [
        entry["event"]["payload"]
        for entry in events
        if entry["event"]["type"] == "observation.created"
    ]
    assert any(observation["type"] == "MessageObservation" for observation in observations)
    assert "secret-key" not in json.dumps(events)
    manager_tasks = service.storage.list_agent_tasks(run_id=run_id, agent_id="agent_manager")
    assert [task.status for task in manager_tasks] == ["completed", "completed"]
    assert manager_tasks[1].metadata == {"source": "provider_plan"}


def test_strip_reasoning_handles_paired_and_dangling_think_tags() -> None:
    from yanshi_runtime.providers.openai_compatible import strip_reasoning

    # Well-formed paired block.
    assert strip_reasoning("<think>deliberation</think>\n\nFinal answer.") == "Final answer."
    # <thinking> variant.
    assert strip_reasoning("<thinking>x</thinking>Answer") == "Answer"
    # Dangling close tag: opening tag was consumed into a separate reasoning field, the
    # thought text + closing tag leaked into content ahead of the real answer.
    assert strip_reasoning("draft reasoning\n</think>\n\nReal answer.") == "Real answer."
    # Plain content is returned untouched (trimmed).
    assert strip_reasoning("  Just an answer.  ") == "Just an answer."


def test_tool_agent_only_assigned_when_task_warrants_it() -> None:
    """Plain questions must not trigger tool agents (which would fail the run); tools need an
    explicit English/Chinese signal. Manager/reviewer are always allowed."""
    from yanshi_runtime.graph.runtime_graph import RuntimeGraph

    warranted = RuntimeGraph._tool_agent_warranted
    assert warranted("agent_manager", "它在哪个城市？") is True
    assert warranted("agent_reviewer", "anything") is True
    # A pure knowledge question warrants no tools.
    assert warranted("agent_browser", "它在哪个城市？") is False
    assert warranted("agent_computer", "用一句话介绍西湖") is False
    # Explicit tool intent (either language) is honored.
    assert warranted("agent_browser", "open the browser to example.com") is True
    assert warranted("agent_browser", "帮我浏览这个网页") is True
    assert warranted("agent_file", "list the files in this workspace") is True
    assert warranted("agent_terminal", "运行命令 ls") is True


def test_keyless_local_provider_is_configured_and_sends_no_auth(tmp_path: Path) -> None:
    """Keyless local servers (Ollama/LM Studio/vLLM) are usable with just endpoint + model."""
    client = make_client(tmp_path)
    service = client.app.state.runtime_service
    with FakeOpenAIServer() as base_url:
        saved = client.put(
            "/settings/provider",
            json={"baseUrl": base_url, "model": "yanshi-test-model"},
        )
        assert saved.status_code == 200
        # No key configured, but the provider must still be considered usable.
        assert service.storage.get_provider_settings_secret() is not None
        assert service.provider.configured is True
        created = client.post("/runs", json={"task": "Write a concise hello"})

    assert created.status_code == 200
    run = client.get(f"/runs/{created.json()['id']}").json()
    assert run["status"] == "completed"
    # A keyless provider must not send an Authorization header.
    assert FakeOpenAIHandler.received_authorization is None
    # Public settings honestly report no key is configured.
    assert client.get("/settings/provider").json()["apiKeyConfigured"] is False


def test_follow_up_run_threads_and_carries_conversation_history(tmp_path: Path) -> None:
    """A follow-up turn shares the parent's thread and passes prior conversation to the model."""
    client = make_client(tmp_path)
    with FakeOpenAIServer() as base_url:
        client.put("/settings/provider", json={"baseUrl": base_url, "model": "yanshi-test-model"})
        first = client.post("/runs", json={"task": "Introduce Hangzhou"})
        first_id = first.json()["id"]
        assert client.get(f"/runs/{first_id}").json()["status"] == "completed"

        # Continue the same chat.
        second = client.post("/runs", json={"task": "Now in one sentence", "parentRunId": first_id})
        second_id = second.json()["id"]
        second_run = client.get(f"/runs/{second_id}").json()

    assert second_run["status"] == "completed"
    # Both turns share one thread, keyed by the first turn's id, and the link is recorded.
    assert second_run["threadId"] == first_id
    assert second_run["parentRunId"] == first_id
    assert client.get(f"/runs/{first_id}").json()["threadId"] == first_id
    # The follow-up's manager synthesis received the prior turn as conversation history.
    payload = FakeOpenAIHandler.received_payload
    assert payload is not None
    user_message = next(msg for msg in payload["messages"] if msg["role"] == "user")
    assert "conversationHistory" in user_message["content"]
    assert "Introduce Hangzhou" in user_message["content"]


def test_agent_profiles_table_has_project_id_column(tmp_path: Path) -> None:
    from yanshi_runtime.storage import Storage

    storage = Storage(tmp_path / "runtime.db", "test")
    cols = {row["name"] for row in storage.conn.execute("PRAGMA table_info(agent_profiles)").fetchall()}
    assert "project_id" in cols
    assert storage.schema_version() == 3
    # Seeded global profiles have NULL project_id.
    rows = storage.conn.execute("SELECT project_id FROM agent_profiles").fetchall()
    assert rows and all(row["project_id"] is None for row in rows)


def test_list_agent_profiles_clones_global_team_per_project(tmp_path: Path) -> None:
    from yanshi_runtime.storage import Storage

    storage = Storage(tmp_path / "runtime.db", "test")
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


def test_create_agent_profile_is_project_scoped(tmp_path: Path) -> None:
    from yanshi_runtime.storage import Storage

    storage = Storage(tmp_path / "runtime.db", "test")
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
    from yanshi_runtime.storage import Storage

    storage = Storage(tmp_path / "runtime.db", "test")
    instances = storage.ensure_agent_team("proj_gamma")
    project_profile_ids = {p.id for p in storage.list_agent_profiles("proj_gamma")}
    assert instances and all(inst.profileId in project_profile_ids for inst in instances)


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


def test_agent_profiles_table_has_model_and_reasoning_columns(tmp_path: Path) -> None:
    from yanshi_runtime.storage import Storage

    storage = Storage(tmp_path / "runtime.db", "test")
    cols = {row["name"] for row in storage.conn.execute("PRAGMA table_info(agent_profiles)").fetchall()}
    assert "model" in cols
    assert "reasoning" in cols
    assert storage.schema_version() == 3
    # Seeded global profiles have NULL model and reasoning.
    rows = storage.conn.execute("SELECT model, reasoning FROM agent_profiles").fetchall()
    assert rows and all(row["model"] is None for row in rows)
    assert rows and all(row["reasoning"] is None for row in rows)


def test_get_project_agent_profile_resolves_by_role(tmp_path: Path) -> None:
    from yanshi_runtime.storage import Storage

    storage = Storage(tmp_path / "runtime.db", "test")

    # Global manager: project_id None, role "manager".
    global_manager = storage.get_project_agent_profile(None, "manager")
    assert global_manager is not None
    assert global_manager.projectId is None
    assert global_manager.role == "manager"

    # Project-scoped manager: materialized clone with same role, distinct id.
    proj_manager = storage.get_project_agent_profile("proj_x", "manager")
    assert proj_manager is not None
    assert proj_manager.projectId == "proj_x"
    assert proj_manager.role == "manager"
    assert proj_manager.id != global_manager.id

    # Unknown role returns None.
    assert storage.get_project_agent_profile(None, "nope") is None
    assert storage.get_project_agent_profile("proj_x", "nope") is None


def test_agent_persona_uses_project_profile(tmp_path: Path) -> None:
    """Unit test: _agent_persona resolves to the project's persona when project_id is given."""
    from yanshi_runtime.graph import RuntimeGraph
    from yanshi_runtime.providers import OpenAICompatibleProvider
    from yanshi_runtime.storage import Storage

    storage = Storage(tmp_path / "runtime.db", "test")
    graph = RuntimeGraph(
        storage=storage,
        checkpoint_path=tmp_path / "checkpoints.db",
        workspace_root=tmp_path / "workspaces",
        provider=OpenAICompatibleProvider(None),
    )

    # Edit the project-scoped manager profile (materializes it first).
    proj_profile = storage.get_project_agent_profile("proj_unit", "manager")
    assert proj_profile is not None
    storage.update_agent_profile(proj_profile.id, {"personality": "ProjectPersona-unit-signature"})

    # _agent_persona with project_id returns the project's persona.
    persona_with_project = graph._agent_persona("agent_manager", "proj_unit")
    assert "ProjectPersona-unit-signature" in persona_with_project
    assert "advisory" in persona_with_project

    # _agent_persona with project_id=None returns the GLOBAL persona (no project signature).
    persona_global = graph._agent_persona("agent_manager", None)
    assert "ProjectPersona-unit-signature" not in persona_global

    # Ensure the global manager profile itself was NOT modified.
    global_profile = storage.get_project_agent_profile(None, "manager")
    assert global_profile is not None
    assert "ProjectPersona-unit-signature" not in (global_profile.personality or "")


def test_agent_persona_global_fallback_for_none_project(tmp_path: Path) -> None:
    """Unit test: _agent_persona with project_id=None yields the global persona (unchanged behaviour)."""
    from yanshi_runtime.graph import RuntimeGraph
    from yanshi_runtime.providers import OpenAICompatibleProvider
    from yanshi_runtime.storage import Storage

    storage = Storage(tmp_path / "runtime.db", "test")
    graph = RuntimeGraph(
        storage=storage,
        checkpoint_path=tmp_path / "checkpoints.db",
        workspace_root=tmp_path / "workspaces",
        provider=OpenAICompatibleProvider(None),
    )

    # Set a distinctive personality on the global manager.
    global_profile = storage.get_project_agent_profile(None, "manager")
    assert global_profile is not None
    storage.update_agent_profile(global_profile.id, {"personality": "GlobalManager-fallback-signature"})

    # No project_id → global profile.
    persona = graph._agent_persona("agent_manager")
    assert "GlobalManager-fallback-signature" in persona
    assert "advisory" in persona

    # Explicit None → same.
    persona_explicit_none = graph._agent_persona("agent_manager", None)
    assert "GlobalManager-fallback-signature" in persona_explicit_none


def test_project_run_uses_project_team_persona_in_file_action(tmp_path: Path) -> None:
    """Integration test: a run in a project uses the PROJECT's file-agent persona in the action input."""
    workspace = tmp_path / "workspaces" / "default"
    workspace.mkdir(parents=True)
    (workspace / "readme.txt").write_text("hello", encoding="utf-8")

    client = make_client(tmp_path)
    service = client.app.state.runtime_service

    # Create project and its file-agent workspace.
    project = client.post("/projects", json={"name": "PersonaTestProject"}).json()
    project_id = project["id"]
    proj_workspace = Path(project["workspacePath"])
    (proj_workspace / "notes.txt").write_text("project note", encoding="utf-8")

    # Edit the project-scoped file agent persona.
    proj_file_profile = service.storage.get_project_agent_profile(project_id, "file")
    assert proj_file_profile is not None
    service.storage.update_agent_profile(proj_file_profile.id, {"personality": "ProjectFile-persona-signature"})

    # Run in the project — should pick up the project's file-agent persona.
    project_run = client.post("/runs", json={"task": "List workspace files", "projectId": project_id})
    assert project_run.status_code == 200
    run_id = project_run.json()["id"]
    run = client.get(f"/runs/{run_id}").json()
    assert run["status"] == "completed"

    events = client.get("/events", params={"runId": run_id}).json()
    actions = [e["event"]["payload"] for e in events if e["event"]["type"] == "action.created"]
    file_action = next((a for a in actions if a["type"] == "FileAction"), None)
    assert file_action is not None, "Expected a FileAction in the project run"
    assert "ProjectFile-persona-signature" in file_action["input"]["persona"]

    # Standalone run should NOT use the project's persona.
    standalone_run = client.post("/runs", json={"task": "List workspace files"})
    assert standalone_run.status_code == 200
    standalone_id = standalone_run.json()["id"]
    standalone_events = client.get("/events", params={"runId": standalone_id}).json()
    standalone_actions = [e["event"]["payload"] for e in standalone_events if e["event"]["type"] == "action.created"]
    standalone_file_action = next((a for a in standalone_actions if a["type"] == "FileAction"), None)
    assert standalone_file_action is not None, "Expected a FileAction in the standalone run"
    assert "ProjectFile-persona-signature" not in standalone_file_action["input"]["persona"]


# ---------------------------------------------------------------------------
# Per-偃师 model override tests
# ---------------------------------------------------------------------------

class ModelRecordingProvider:
    """Fake provider that records the model= kwarg received on each call."""

    configured = True
    public_base_url = "fixture://provider"
    model = "fixture-model"

    def __init__(self, responses: list[str]) -> None:
        self.responses = list(responses)
        # Each entry: {"kind": "chat"|"stream", "model": str|None, "messages": [...]}
        self.recorded_calls: list[dict] = []

    def chat_completion(self, messages: list[object], model: str | None = None) -> str:
        self.recorded_calls.append({"kind": "chat", "model": model, "messages": messages})
        if not self.responses:
            raise AssertionError("ModelRecordingProvider received an unexpected call.")
        return self.responses.pop(0)

    def stream_chat_completion(self, messages: list[object], model: str | None = None):
        self.recorded_calls.append({"kind": "stream", "model": model, "messages": messages})
        if not self.responses:
            raise AssertionError("ModelRecordingProvider received an unexpected stream call.")
        yield self.responses.pop(0)


def test_per_worker_model_override_manager(tmp_path: Path) -> None:
    """A manager 偃师 with model='custom-x' causes both the planning call and the synthesis
    stream call to use model='custom-x'. A 偃师 with empty/None model passes None through
    (inherits the configured provider default — no silent substitution)."""
    client = make_client(tmp_path)
    service = client.app.state.runtime_service

    # Create a project and give its manager 偃师 a custom model.
    project = client.post("/projects", json={"name": "ModelOverrideProject"}).json()
    project_id = project["id"]

    proj_mgr_profile = service.storage.get_project_agent_profile(project_id, "manager")
    assert proj_mgr_profile is not None
    service.storage.update_agent_profile(proj_mgr_profile.id, {"model": "custom-x"})

    # Verify the model was persisted.
    refreshed = service.storage.get_project_agent_profile(project_id, "manager")
    assert refreshed is not None and refreshed.model == "custom-x"

    provider = ModelRecordingProvider(
        [
            json.dumps({"steps": ["Answer"], "tasks": [{"agentId": "agent_manager", "task": "Answer the question."}]}),
            "Final answer with custom model.",
        ]
    )
    service.provider = provider
    service.graph.provider = provider

    created = client.post("/runs", json={"task": "Write a hello", "projectId": project_id})
    assert created.status_code == 200
    run = client.get(f"/runs/{created.json()['id']}").json()
    assert run["status"] == "completed"

    # All provider calls for this project run should use the manager's custom model.
    assert len(provider.recorded_calls) >= 2, "Expected at least planning + synthesis calls"
    for call in provider.recorded_calls:
        assert call["model"] == "custom-x", (
            f"Expected model='custom-x' but got model={call['model']!r} for {call['kind']} call"
        )


def test_per_worker_model_none_inherits_default(tmp_path: Path) -> None:
    """A 偃师 with no model set passes None to the provider (inherits the configured default).
    No silent substitution — the provider receives None, not the profile's empty string."""
    client = make_client(tmp_path)
    service = client.app.state.runtime_service

    # Standalone run (no project) — global manager profile has no model set by default.
    provider = ModelRecordingProvider(
        [
            json.dumps({"steps": ["Answer"], "tasks": [{"agentId": "agent_manager", "task": "Answer."}]}),
            "Done.",
        ]
    )
    service.provider = provider
    service.graph.provider = provider

    created = client.post("/runs", json={"task": "Write a hello"})
    assert created.status_code == 200
    run = client.get(f"/runs/{created.json()['id']}").json()
    assert run["status"] == "completed"

    assert len(provider.recorded_calls) >= 2, "Expected at least planning + synthesis calls"
    for call in provider.recorded_calls:
        assert call["model"] is None, (
            f"Expected model=None (inherit default) but got model={call['model']!r} for {call['kind']} call"
        )


# ---------------------------------------------------------------------------
# Per-偃师 tool whitelist gating (Task 5)
# ---------------------------------------------------------------------------


def test_worker_whitelist_excludes_tool_blocks_with_honest_error(tmp_path: Path) -> None:
    """A 偃师 whose defaultTools excludes its own tool → blocked with tool_not_in_worker_abilities.
    Global toggle is ON so the global gate passes; the whitelist check must block it."""
    client = make_client(tmp_path)
    service = client.app.state.runtime_service

    # Create a project and enable the terminal tool globally.
    project = client.post("/projects", json={"name": "WhitelistBlockProject"}).json()
    project_id = project["id"]
    client.put("/settings", json={"terminalToolEnabled": True})

    # Set the project's terminal 偃师 defaultTools to ["docker"] — excludes "terminal".
    proj_terminal_profile = service.storage.get_project_agent_profile(project_id, "terminal")
    assert proj_terminal_profile is not None
    service.storage.update_agent_profile(proj_terminal_profile.id, {"defaultTools": ["docker"]})

    created = client.post(
        "/runs",
        json={"task": "Run command `ls` in terminal", "permissionMode": "full_access", "projectId": project_id},
    )
    assert created.status_code == 200
    run_id = created.json()["id"]
    run = client.get(f"/runs/{run_id}").json()
    assert run["status"] == "failed"

    events = client.get("/events", params={"runId": run_id}).json()
    observations = [e["event"]["payload"] for e in events if e["event"]["type"] == "observation.created"]
    terminal_obs = next((o for o in observations if o["type"] == "TerminalObservation"), None)
    assert terminal_obs is not None, "Expected a TerminalObservation"
    assert terminal_obs["error"] == "tool_not_in_worker_abilities", (
        f"Expected tool_not_in_worker_abilities but got {terminal_obs['error']!r}"
    )
    # Must NOT be a fake success.
    terminal_tasks = service.storage.list_agent_tasks(run_id=run_id, agent_id="agent_terminal")
    assert all(t.status == "failed" for t in terminal_tasks)


def test_worker_whitelist_empty_inherits_global_toggle(tmp_path: Path) -> None:
    """A 偃师 with empty defaultTools does not restrict: global toggle governs (allowed when ON).
    This is the 'empty whitelist = inherit' contract."""
    client = make_client(tmp_path)
    service = client.app.state.runtime_service

    project = client.post("/projects", json={"name": "EmptyWhitelistProject"}).json()
    project_id = project["id"]
    client.put("/settings", json={"terminalToolEnabled": True})

    # Explicitly set empty defaultTools — verifies the 'empty = inherit' rule.
    proj_terminal_profile = service.storage.get_project_agent_profile(project_id, "terminal")
    assert proj_terminal_profile is not None
    service.storage.update_agent_profile(proj_terminal_profile.id, {"defaultTools": []})
    refreshed = service.storage.get_project_agent_profile(project_id, "terminal")
    assert refreshed is not None and refreshed.defaultTools == [], "defaultTools should be empty after update"

    # Run; should NOT be blocked by whitelist (falls through to actual execution).
    created = client.post(
        "/runs",
        json={"task": "Run command `ls` in terminal", "permissionMode": "full_access", "projectId": project_id},
    )
    assert created.status_code == 200
    run_id = created.json()["id"]

    events = client.get("/events", params={"runId": run_id}).json()
    observations = [e["event"]["payload"] for e in events if e["event"]["type"] == "observation.created"]
    # Must not have a whitelist-gate error.
    terminal_obs = next((o for o in observations if o["type"] == "TerminalObservation"), None)
    if terminal_obs is not None:
        assert terminal_obs.get("error") != "tool_not_in_worker_abilities", (
            "Empty defaultTools should not block the tool"
        )


def test_global_toggle_off_blocks_regardless_of_whitelist(tmp_path: Path) -> None:
    """Global toggle OFF → blocked with tool_disabled, regardless of the 偃师's whitelist.
    Existing behavior must be preserved exactly."""
    client = make_client(tmp_path)
    service = client.app.state.runtime_service

    project = client.post("/projects", json={"name": "GlobalToggleOffProject"}).json()
    project_id = project["id"]
    # Leave terminalToolEnabled at its default (False) — global gate blocks first.

    # Give the terminal 偃师 a whitelist that INCLUDES "terminal" — should not matter.
    proj_terminal_profile = service.storage.get_project_agent_profile(project_id, "terminal")
    assert proj_terminal_profile is not None
    service.storage.update_agent_profile(proj_terminal_profile.id, {"defaultTools": ["terminal", "docker"]})

    created = client.post(
        "/runs",
        json={"task": "Run command `ls` in terminal", "permissionMode": "full_access", "projectId": project_id},
    )
    assert created.status_code == 200
    run_id = created.json()["id"]
    run = client.get(f"/runs/{run_id}").json()
    assert run["status"] == "failed"

    events = client.get("/events", params={"runId": run_id}).json()
    observations = [e["event"]["payload"] for e in events if e["event"]["type"] == "observation.created"]
    terminal_obs = next((o for o in observations if o["type"] == "TerminalObservation"), None)
    assert terminal_obs is not None, "Expected a TerminalObservation"
    assert terminal_obs["error"] == "tool_disabled", (
        f"Expected tool_disabled (global gate) but got {terminal_obs['error']!r}"
    )
