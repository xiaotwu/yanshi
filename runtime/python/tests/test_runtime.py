from __future__ import annotations

import io
import json
import subprocess
import threading
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
    settings = RuntimeSettings(data_dir=tmp_path, runtime_version="test")
    return TestClient(create_app(settings))


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

    def chat_completion(self, messages: list[object]) -> str:
        self.calls.append([message.model_dump() if hasattr(message, "model_dump") else {"content": str(message)} for message in messages])
        if not self.responses:
            raise AssertionError("SequencedProvider received an unexpected chat completion call.")
        return self.responses.pop(0)


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
        assert args[:5] == ["docker", "run", "--rm", "--network", "none"]
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


def test_reviewer_queue_explains_failed_runs(tmp_path: Path) -> None:
    client = make_client(tmp_path)
    service = client.app.state.runtime_service

    created = client.post("/runs", json={"task": "Summarize this project"})

    assert created.status_code == 200
    run_id = created.json()["id"]
    run = client.get(f"/runs/{run_id}").json()
    assert run["status"] == "failed"
    reviewer_tasks = service.storage.list_agent_tasks(run_id=run_id, agent_id="agent_reviewer")
    assert len(reviewer_tasks) == 1
    assert reviewer_tasks[0].status == "completed"
    events = client.get("/events", params={"runId": run_id}).json()
    observations = [entry["event"]["payload"] for entry in events if entry["event"]["type"] == "observation.created"]
    assert any(observation["type"] == "ReviewerObservation" for observation in observations)


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
