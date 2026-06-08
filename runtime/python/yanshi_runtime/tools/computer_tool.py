from __future__ import annotations

import ctypes
import os
import platform
import re
import subprocess
from dataclasses import dataclass
from pathlib import Path
from typing import Protocol

import httpx

from yanshi_runtime.models import ToolResult


@dataclass(frozen=True)
class MacosPermissionStatus:
    accessibility: str
    screenRecording: str
    requiredAction: str = "System Settings > Privacy & Security"

    @property
    def granted(self) -> bool:
        return self.accessibility == "granted" and self.screenRecording == "granted"

    @property
    def accessibility_granted(self) -> bool:
        return self.accessibility == "granted"


class PermissionProbe(Protocol):
    def status(self) -> MacosPermissionStatus:
        pass


class CommandRunner(Protocol):
    def __call__(
        self,
        args: list[str],
        *,
        capture_output: bool,
        text: bool,
        timeout: int,
        check: bool,
    ) -> subprocess.CompletedProcess[str]:
        pass


class ComputerBridge(Protocol):
    def available(self) -> bool:
        pass

    def run(self, operation: str, payload: dict[str, object]) -> ToolResult:
        pass


class MacosPermissionProbe:
    def status(self) -> MacosPermissionStatus:
        if platform.system() != "Darwin":
            return MacosPermissionStatus(
                accessibility="unsupported",
                screenRecording="unsupported",
                requiredAction="macOS is required for Computer Use.",
            )

        try:
            app_services = ctypes.cdll.LoadLibrary("/System/Library/Frameworks/ApplicationServices.framework/ApplicationServices")
            app_services.AXIsProcessTrusted.restype = ctypes.c_ubyte
            accessibility_granted = bool(app_services.AXIsProcessTrusted())

            core_graphics = ctypes.cdll.LoadLibrary("/System/Library/Frameworks/CoreGraphics.framework/CoreGraphics")
            core_graphics.CGPreflightScreenCaptureAccess.restype = ctypes.c_bool
            screen_granted = bool(core_graphics.CGPreflightScreenCaptureAccess())
        except (AttributeError, OSError):
            return MacosPermissionStatus(
                accessibility="unknown",
                screenRecording="unknown",
                requiredAction="Restart Yanshi and check macOS Privacy & Security.",
            )

        return MacosPermissionStatus(
            accessibility="granted" if accessibility_granted else "permission_required",
            screenRecording="granted" if screen_granted else "permission_required",
        )


class DesktopHttpComputerBridge:
    def __init__(self, base_url: str | None = None, token: str | None = None) -> None:
        self.base_url = (base_url or os.environ.get("YANSHI_COMPUTER_BRIDGE_URL") or "").rstrip("/")
        self.token = token if token is not None else os.environ.get("YANSHI_COMPUTER_BRIDGE_TOKEN")

    def available(self) -> bool:
        return bool(self.base_url)

    def run(self, operation: str, payload: dict[str, object]) -> ToolResult:
        if not self.available():
            return bridge_required_result()
        headers = {"Authorization": f"Bearer {self.token}"} if self.token else {}
        try:
            response = httpx.post(
                f"{self.base_url}/computer/{operation}",
                json=payload,
                headers=headers,
                timeout=10,
            )
            response.raise_for_status()
            body = response.json()
        except httpx.HTTPError as exc:
            return ToolResult(
                ok=False,
                summary=f"Computer Use desktop bridge request failed: {exc.__class__.__name__}.",
                missingRequirement="computer_use_control_bridge",
                structuredOutput={"operation": operation},
            )
        except ValueError:
            return ToolResult(
                ok=False,
                summary="Computer Use desktop bridge returned invalid JSON.",
                missingRequirement="computer_use_control_bridge",
                structuredOutput={"operation": operation},
            )

        return ToolResult(
            ok=bool(body.get("ok")),
            summary=str(body.get("summary") or "Computer bridge returned no summary."),
            missingRequirement=body.get("missingRequirement") if isinstance(body.get("missingRequirement"), str) else None,
            structuredOutput=body.get("structuredOutput") if isinstance(body.get("structuredOutput"), dict) else {},
        )


class ComputerTool:
    def __init__(
        self,
        probe: PermissionProbe | None = None,
        runner: CommandRunner | None = None,
        bridge: ComputerBridge | None = None,
    ) -> None:
        self.probe = probe or MacosPermissionProbe()
        self.runner = runner or subprocess.run
        self.bridge = bridge or DesktopHttpComputerBridge()

    def status(self) -> ToolResult:
        status = self.probe.status()
        return self._status_result(status, needs_screen_recording=True)

    def capture_screen(self, output_dir: Path, timeout_seconds: int = 15) -> ToolResult:
        status = self.probe.status()
        if not status.granted:
            return self._status_result(status)

        output_dir.mkdir(parents=True, exist_ok=True)
        screenshot_path = output_dir / "computer-screen.png"
        try:
            completed = self.runner(
                ["screencapture", "-x", str(screenshot_path)],
                capture_output=True,
                text=True,
                timeout=timeout_seconds,
                check=False,
            )
        except FileNotFoundError:
            return ToolResult(
                ok=False,
                summary="Computer Use requires the macOS screencapture tool before screen capture can run.",
                missingRequirement="macos_screencapture",
                structuredOutput=self._status_output(status) | {"screenshotPath": str(screenshot_path)},
            )
        except subprocess.TimeoutExpired:
            return ToolResult(
                ok=False,
                summary="Computer Use screen capture timed out.",
                missingRequirement="macos_screen_capture_timeout",
                structuredOutput=self._status_output(status) | {"screenshotPath": str(screenshot_path)},
            )

        if completed.returncode != 0 or not screenshot_path.exists() or screenshot_path.stat().st_size == 0:
            return ToolResult(
                ok=False,
                summary="Computer Use could not capture the screen.",
                missingRequirement="macos_screen_capture_failed",
                structuredOutput=self._status_output(status)
                | {
                    "screenshotPath": str(screenshot_path),
                    "returnCode": completed.returncode,
                    "stderr": completed.stderr.strip(),
                },
            )

        return ToolResult(
            ok=True,
            summary="Computer Agent captured the screen.",
            structuredOutput=self._status_output(status)
            | {
                "screenshotPath": str(screenshot_path),
                "returnCode": completed.returncode,
            },
        )

    def click_from_task(self, task: str) -> ToolResult:
        match = re.search(r"(-?\d+(?:\.\d+)?)\s*[,x ]\s*(-?\d+(?:\.\d+)?)", task)
        if match is None:
            return ToolResult(
                ok=False,
                summary="Computer click needs screen coordinates in the task.",
                missingRequirement="computer_click_coordinates",
                structuredOutput={"example": "Click 120, 300 on the computer"},
            )
        x = float(match.group(1))
        y = float(match.group(2))
        button = "right" if "right click" in task.lower() else "left"
        return self.click(x, y, button=button)

    def click(self, x: float, y: float, *, button: str = "left") -> ToolResult:
        status = self.probe.status()
        permission_result = self._control_permission_result(status)
        if permission_result is not None:
            return permission_result
        if not self.bridge.available():
            return bridge_required_result()
        return self.bridge.run("click", {"x": x, "y": y, "button": button})

    def type_from_task(self, task: str) -> ToolResult:
        text = self._extract_backtick_or_quoted_value(task)
        if text is None:
            lowered = task.lower()
            marker = "type "
            if marker in lowered:
                text = task[lowered.index(marker) + len(marker) :].strip()
        if not text:
            return ToolResult(
                ok=False,
                summary="Computer type needs text in backticks or quotes.",
                missingRequirement="computer_type_text",
                structuredOutput={"example": "Type `hello` on the computer"},
            )
        return self.type_text(text)

    def type_text(self, text: str) -> ToolResult:
        status = self.probe.status()
        permission_result = self._control_permission_result(status)
        if permission_result is not None:
            return permission_result
        if not self.bridge.available():
            return bridge_required_result()
        return self.bridge.run("type", {"text": text})

    def shortcut_from_task(self, task: str) -> ToolResult:
        shortcut = self._extract_backtick_or_quoted_value(task)
        if shortcut is None:
            lowered = task.lower()
            marker = "shortcut "
            if marker in lowered:
                shortcut = task[lowered.index(marker) + len(marker) :].strip()
        keys = [key.strip() for key in re.split(r"\s*\+\s*|\s*,\s*", shortcut or "") if key.strip()]
        if not keys:
            return ToolResult(
                ok=False,
                summary="Computer shortcut needs keys such as `Command+Y`.",
                missingRequirement="computer_shortcut_keys",
                structuredOutput={"example": "Use shortcut `Command+Y` on the computer"},
            )
        return self.shortcut(keys)

    def shortcut(self, keys: list[str]) -> ToolResult:
        status = self.probe.status()
        permission_result = self._control_permission_result(status)
        if permission_result is not None:
            return permission_result
        if not self.bridge.available():
            return bridge_required_result()
        return self.bridge.run("shortcut", {"keys": keys})

    def open_app_from_task(self, task: str) -> ToolResult:
        app_name = self._extract_backtick_or_quoted_value(task)
        if app_name is None:
            match = re.search(r"open (?:the )?(?:app|application)\s+([A-Za-z0-9 ._-]+)", task, re.IGNORECASE)
            if match:
                app_name = match.group(1).strip(" .")
        if not app_name:
            return ToolResult(
                ok=False,
                summary="Computer open app needs an application name.",
                missingRequirement="computer_open_app_name",
                structuredOutput={"example": "Open app `Safari`"},
            )
        return self.open_app(app_name)

    def open_app(self, app_name: str) -> ToolResult:
        if not self.bridge.available():
            return bridge_required_result()
        return self.bridge.run("open-app", {"appName": app_name})

    def _status_result(self, status: MacosPermissionStatus, *, needs_screen_recording: bool) -> ToolResult:
        required = [
            label
            for label, value in (
                ("Accessibility", status.accessibility),
                ("Screen Recording", status.screenRecording if needs_screen_recording else "granted"),
            )
            if value != "granted"
        ]
        output = self._status_output(status) | {"required": required}

        if status.granted and needs_screen_recording:
            if self.bridge.available():
                return ToolResult(ok=True, summary="Computer Use permissions and bridge are available.", structuredOutput=output)
            return bridge_required_result(output)

        if status.accessibility == "unsupported" and status.screenRecording == "unsupported":
            return ToolResult(
                ok=False,
                summary="Computer Use requires macOS before actions can run.",
                missingRequirement="macos_required",
                structuredOutput=output,
            )

        return ToolResult(
            ok=False,
            summary=f"Computer Use requires macOS {_format_required(required)} permission before actions can run.",
            missingRequirement="macos_permissions",
            structuredOutput=output,
        )

    def _control_permission_result(self, status: MacosPermissionStatus) -> ToolResult | None:
        if status.accessibility_granted:
            return None
        return self._status_result(status, needs_screen_recording=False)

    def _status_output(self, status: MacosPermissionStatus) -> dict[str, object]:
        return {
            "accessibility": status.accessibility,
            "screenRecording": status.screenRecording,
            "path": status.requiredAction,
        }

    def _extract_backtick_or_quoted_value(self, task: str) -> str | None:
        backtick = re.search(r"`([^`]+)`", task)
        if backtick:
            return backtick.group(1).strip()
        quoted = re.search(r'"([^"]+)"', task)
        if quoted:
            return quoted.group(1).strip()
        return None


def bridge_required_result(structured_output: dict[str, object] | None = None) -> ToolResult:
    return ToolResult(
        ok=False,
        summary="Computer Use control bridge is not connected.",
        missingRequirement="computer_use_control_bridge",
        structuredOutput=structured_output or {},
    )


def _format_required(required: list[str]) -> str:
    if len(required) == 1:
        return required[0]
    return f"{' and '.join(required)}"
