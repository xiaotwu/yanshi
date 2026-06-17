from __future__ import annotations

import os
import re
import shlex
import shutil
import signal
import subprocess
import time
import uuid
from dataclasses import dataclass
from pathlib import Path
from threading import Lock
from typing import Callable, Protocol

from yanshi_runtime.models import ToolResult


COMMAND_RE = re.compile(r"`([^`]+)`")

# Polling cadence for the cancellable execution path: small enough that Stop feels
# immediate, large enough not to busy-spin while a command runs to completion.
_CANCEL_POLL_SECONDS = 0.1
# Grace period after SIGTERM (and after `docker rm -f`) before we escalate to SIGKILL.
_TERM_GRACE_SECONDS = 3.0


class CommandCancelled(Exception):
    """Raised by the cancellable runner when the run was cancelled mid-command and the
    process group (and any Docker container) was killed."""
READ_ONLY_COMMANDS = {"pwd", "ls", "find", "cat", "head", "tail", "wc", "stat", "du", "grep", "rg"}
SHELL_TOKENS = ("|", "&", ";", ">", "<", "$", "\n")
DOCKER_LOCK = Lock()

DOCKER_IMAGE_RE = re.compile(r"^[a-zA-Z0-9][a-zA-Z0-9_./:@-]*$")
DOCKER_MEMORY_RE = re.compile(r"^\d+(?:\.\d+)?[bkmgBKMG]?$")
DOCKER_CPUS_RE = re.compile(r"^\d+(?:\.\d+)?$")


@dataclass(frozen=True)
class DockerConfig:
    image: str = "alpine:3.20"
    memory: str = "512m"
    cpus: str = "1"
    pids_limit: int = 128


def validate_docker_config(image: str, memory: str, cpus: str, pids_limit: int) -> ToolResult | None:
    """Return a ``docker_config_invalid`` ToolResult when any value is unsafe, else None."""
    invalid: dict[str, str] = {}
    if not isinstance(image, str) or not DOCKER_IMAGE_RE.match(image) or len(image) > 200:
        invalid["dockerImage"] = str(image)
    if not isinstance(memory, str) or not DOCKER_MEMORY_RE.match(memory):
        invalid["dockerMemory"] = str(memory)
    if not isinstance(cpus, str) or not DOCKER_CPUS_RE.match(cpus) or float(cpus or 0) <= 0:
        invalid["dockerCpus"] = str(cpus)
    if not isinstance(pids_limit, int) or isinstance(pids_limit, bool) or pids_limit < 1 or pids_limit > 100_000:
        invalid["dockerPidsLimit"] = str(pids_limit)
    if invalid:
        return ToolResult(
            ok=False,
            summary="Docker sandbox settings are invalid. Check the Developer Mode sandbox configuration.",
            missingRequirement="docker_config_invalid",
            structuredOutput={"invalid": invalid},
        )
    return None


class CommandRunner(Protocol):
    def __call__(
        self,
        args: list[str],
        *,
        cwd: Path | None = None,
        env: dict[str, str] | None = None,
        capture_output: bool,
        text: bool,
        timeout: int,
        check: bool,
    ) -> subprocess.CompletedProcess[str]:
        pass


class TerminalTool:
    def __init__(
        self,
        runner: CommandRunner | None = None,
        docker_image: str = "alpine:3.20",
        docker_config: DockerConfig | None = None,
    ) -> None:
        self.runner = runner or subprocess.run
        self._runner_provided = runner is not None
        self.docker_config = docker_config or DockerConfig(image=docker_image)

    @property
    def docker_image(self) -> str:
        return self.docker_config.image

    def docker_status(self) -> ToolResult:
        if not self._runner_provided and shutil.which("docker") is None:
            return ToolResult(
                ok=False,
                summary="Docker sandbox needs Docker installed.",
                missingRequirement="docker_cli",
            )
        completed = self.runner(["docker", "info"], capture_output=True, text=True, timeout=6, check=False)
        if completed.returncode != 0:
            return ToolResult(
                ok=False,
                summary="Docker sandbox needs Docker Desktop running.",
                missingRequirement="docker_daemon",
                structuredOutput={"stderr": completed.stderr[-800:]},
            )
        return ToolResult(ok=True, summary="Docker sandbox is available.")

    def run_in_docker_from_task(
        self,
        task: str,
        *,
        workspace_root: Path,
        timeout_seconds: int = 30,
        config: DockerConfig | None = None,
        is_cancelled: Callable[[], bool] | None = None,
    ) -> ToolResult:
        command = self.extract_command(task)
        if command is None:
            return ToolResult(
                ok=False,
                summary="Docker sandbox needs a command in backticks.",
                missingRequirement="terminal_command",
                structuredOutput={"example": "Run command `python --version` in Docker"},
            )
        return self.run_in_docker(
            command,
            workspace_root=workspace_root,
            timeout_seconds=timeout_seconds,
            config=config,
            is_cancelled=is_cancelled,
        )

    def run_in_docker(
        self,
        command: str,
        *,
        workspace_root: Path,
        timeout_seconds: int = 30,
        config: DockerConfig | None = None,
        is_cancelled: Callable[[], bool] | None = None,
    ) -> ToolResult:
        config = config or self.docker_config
        invalid = validate_docker_config(config.image, config.memory, config.cpus, config.pids_limit)
        if invalid is not None:
            return invalid

        status = self.docker_status()
        if not status.ok:
            return status

        workspace_root.mkdir(parents=True, exist_ok=True)
        # Name the container so a cancel can stop it with `docker rm -f`: killing the
        # `docker run` client alone leaves the container running on the daemon.
        container_name = f"yanshi-run-{uuid.uuid4().hex[:12]}"
        args = [
            "docker",
            "run",
            "--rm",
            "--name",
            container_name,
            "--network",
            "none",
            "--memory",
            config.memory,
            "--cpus",
            config.cpus,
            "--pids-limit",
            str(config.pids_limit),
            "--mount",
            f"type=bind,src={workspace_root.resolve()},dst=/workspace",
            "--workdir",
            "/workspace",
            config.image,
            "/bin/sh",
            "-lc",
            command,
        ]
        try:
            with DOCKER_LOCK:
                completed = self._invoke(
                    args,
                    timeout=timeout_seconds,
                    is_cancelled=is_cancelled,
                    container_name=container_name,
                )
        except CommandCancelled:
            return ToolResult(
                ok=False,
                summary="Docker sandbox command cancelled.",
                missingRequirement="docker_command_cancelled",
                structuredOutput={"command": command, "image": config.image},
            )
        except FileNotFoundError:
            return ToolResult(
                ok=False,
                summary="Docker sandbox needs Docker installed.",
                missingRequirement="docker_cli",
            )
        except subprocess.TimeoutExpired as exc:
            stderr = self._truncate(exc.stderr or "")
            missing_requirement = "docker_image_pull_timeout" if "Unable to find image" in stderr else "docker_command_timeout"
            return ToolResult(
                ok=False,
                summary=(
                    f"Docker image pull timed out after {timeout_seconds} seconds."
                    if missing_requirement == "docker_image_pull_timeout"
                    else f"Docker command timed out after {timeout_seconds} seconds."
                ),
                missingRequirement=missing_requirement,
                structuredOutput={
                    "command": command,
                    "image": config.image,
                    "workspace": str(workspace_root.resolve()),
                    "stdout": self._truncate(exc.stdout or ""),
                    "stderr": stderr,
                    "timeoutSeconds": timeout_seconds,
                },
            )

        ok = completed.returncode == 0
        return ToolResult(
            ok=ok,
            summary=(
                "Docker sandbox command completed."
                if ok
                else f"Docker sandbox command failed with exit code {completed.returncode}."
            ),
            structuredOutput={
                "command": command,
                "image": config.image,
                "workspace": str(workspace_root.resolve()),
                "returnCode": completed.returncode,
                "stdout": self._truncate(completed.stdout),
                "stderr": self._truncate(completed.stderr),
                "network": "none",
                "resourceLock": "docker",
            },
        )

    def run_from_task(
        self,
        task: str,
        *,
        workspace_root: Path,
        timeout_seconds: int = 8,
        is_cancelled: Callable[[], bool] | None = None,
    ) -> ToolResult:
        command = self.extract_command(task)
        if command is None:
            return ToolResult(
                ok=False,
                summary="Terminal Agent needs a command in backticks.",
                missingRequirement="terminal_command",
                structuredOutput={"example": "Run command `ls` in terminal"},
            )
        return self.run_command(
            command,
            workspace_root=workspace_root,
            timeout_seconds=timeout_seconds,
            is_cancelled=is_cancelled,
        )

    def run_command(
        self,
        command: str,
        *,
        workspace_root: Path,
        timeout_seconds: int = 8,
        is_cancelled: Callable[[], bool] | None = None,
    ) -> ToolResult:
        validation_error = self._validate_command_text(command)
        if validation_error:
            return validation_error
        try:
            args = shlex.split(command)
        except ValueError as exc:
            return ToolResult(
                ok=False,
                summary="Terminal Agent could not parse the command.",
                missingRequirement="terminal_command_parse",
                structuredOutput={"error": str(exc)},
            )

        validation_error = self._validate_args(args)
        if validation_error:
            return validation_error

        workspace_root.mkdir(parents=True, exist_ok=True)
        env = {
            "PATH": os.environ.get("PATH", "/usr/bin:/bin:/usr/local/bin:/opt/homebrew/bin"),
            "LANG": os.environ.get("LANG", "C.UTF-8"),
            "LC_ALL": os.environ.get("LC_ALL", "C.UTF-8"),
            "YANSHI_TERMINAL_SANDBOX": "workspace",
        }
        try:
            completed = self._invoke(
                args,
                cwd=workspace_root,
                env=env,
                timeout=timeout_seconds,
                is_cancelled=is_cancelled,
            )
        except CommandCancelled:
            return ToolResult(
                ok=False,
                summary="Terminal command cancelled.",
                missingRequirement="terminal_command_cancelled",
                structuredOutput={"command": args},
            )
        except FileNotFoundError:
            return ToolResult(
                ok=False,
                summary=f"Terminal command is not installed: {args[0]}.",
                missingRequirement="terminal_command_not_found",
                structuredOutput={"command": args},
            )
        except subprocess.TimeoutExpired as exc:
            return ToolResult(
                ok=False,
                summary=f"Terminal command timed out after {timeout_seconds} seconds.",
                missingRequirement="terminal_command_timeout",
                structuredOutput={
                    "command": args,
                    "stdout": self._truncate(exc.stdout or ""),
                    "stderr": self._truncate(exc.stderr or ""),
                    "timeoutSeconds": timeout_seconds,
                },
            )

        ok = completed.returncode == 0
        return ToolResult(
            ok=ok,
            summary=(
                f"Terminal command completed: {args[0]}."
                if ok
                else f"Terminal command failed with exit code {completed.returncode}: {args[0]}."
            ),
            structuredOutput={
                "command": args,
                "cwd": str(workspace_root.resolve()),
                "returnCode": completed.returncode,
                "stdout": self._truncate(completed.stdout),
                "stderr": self._truncate(completed.stderr),
            },
        )

    def extract_command(self, task: str) -> str | None:
        match = COMMAND_RE.search(task)
        if match:
            return match.group(1).strip()
        lowered = task.lower()
        marker = "terminal:"
        if marker in lowered:
            index = lowered.index(marker) + len(marker)
            command = task[index:].strip()
            return command or None
        return None

    def _validate_command_text(self, command: str) -> ToolResult | None:
        if any(token in command for token in SHELL_TOKENS):
            return ToolResult(
                ok=False,
                summary="Terminal Agent does not run shell pipelines or redirects yet.",
                missingRequirement="terminal_shell_unsupported",
                structuredOutput={"command": command},
            )
        return None

    def _validate_args(self, args: list[str]) -> ToolResult | None:
        if not args:
            return ToolResult(
                ok=False,
                summary="Terminal Agent needs a non-empty command.",
                missingRequirement="terminal_command",
            )
        if Path(args[0]).is_absolute() or ".." in Path(args[0]).parts:
            return ToolResult(
                ok=False,
                summary="Terminal Agent runs commands by name inside the workspace sandbox.",
                missingRequirement="terminal_executable_path_not_allowed",
                structuredOutput={"command": args},
            )
        executable = Path(args[0]).name
        if executable not in READ_ONLY_COMMANDS:
            return ToolResult(
                ok=False,
                summary=f"Terminal Agent allows only read-only workspace commands in normal mode: {executable}.",
                missingRequirement="terminal_command_not_allowed",
                structuredOutput={"allowed": sorted(READ_ONLY_COMMANDS), "command": args},
            )
        for arg in args[1:]:
            if arg.startswith("-"):
                continue
            path = Path(arg)
            if path.is_absolute() or ".." in path.parts:
                return ToolResult(
                    ok=False,
                    summary="Terminal Agent keeps command paths inside the workspace.",
                    missingRequirement="terminal_path_outside_workspace",
                    structuredOutput={"argument": arg},
                )
        return None

    def _invoke(
        self,
        args: list[str],
        *,
        timeout: int,
        cwd: Path | None = None,
        env: dict[str, str] | None = None,
        is_cancelled: Callable[[], bool] | None = None,
        container_name: str | None = None,
    ) -> subprocess.CompletedProcess[str]:
        """Run ``args`` and return a CompletedProcess.

        When an injected runner is in use (tests) or no cancellation callback is given, this
        delegates to the configured runner unchanged — behaviour is identical to the old
        ``subprocess.run`` call. When a real subprocess is used with a cancellation callback,
        it takes a Popen-based path that can kill the process group (and any Docker container)
        the moment the run is cancelled, instead of blocking until the command's own timeout.
        """
        if self._runner_provided or is_cancelled is None:
            return self.runner(
                args,
                cwd=cwd,
                env=env,
                capture_output=True,
                text=True,
                timeout=timeout,
                check=False,
            )
        return self._run_cancellable(
            args,
            cwd=cwd,
            env=env,
            timeout=timeout,
            is_cancelled=is_cancelled,
            container_name=container_name,
        )

    def _run_cancellable(
        self,
        args: list[str],
        *,
        timeout: int,
        cwd: Path | None,
        env: dict[str, str] | None,
        is_cancelled: Callable[[], bool],
        container_name: str | None,
    ) -> subprocess.CompletedProcess[str]:
        proc = subprocess.Popen(  # noqa: S603 - args are validated/explicit, no shell
            args,
            cwd=str(cwd) if cwd is not None else None,
            env=env,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            start_new_session=True,  # own process group so we can signal the whole tree
        )
        deadline = time.monotonic() + timeout
        # Repeated communicate(timeout=...) calls are loss-less per the stdlib docs: buffered
        # output is retained across TimeoutExpired, so polling does not drop stdout/stderr.
        while True:
            try:
                stdout, stderr = proc.communicate(timeout=_CANCEL_POLL_SECONDS)
                return subprocess.CompletedProcess(args, proc.returncode, stdout, stderr)
            except subprocess.TimeoutExpired:
                pass
            if is_cancelled():
                self._terminate(proc, container_name)
                raise CommandCancelled()
            if time.monotonic() >= deadline:
                self._terminate(proc, container_name)
                stdout, stderr = self._drain(proc)
                raise subprocess.TimeoutExpired(args, timeout, output=stdout, stderr=stderr)

    def _terminate(self, proc: subprocess.Popen[str], container_name: str | None) -> None:
        """Stop a running command: remove its Docker container (if any), then SIGTERM and,
        after a grace period, SIGKILL the process group."""
        if container_name is not None:
            try:
                subprocess.run(
                    ["docker", "rm", "-f", container_name],
                    capture_output=True,
                    text=True,
                    timeout=10,
                    check=False,
                )
            except (OSError, subprocess.SubprocessError):
                pass
        self._signal_group(proc, signal.SIGTERM)
        try:
            proc.wait(timeout=_TERM_GRACE_SECONDS)
            return
        except subprocess.TimeoutExpired:
            pass
        self._signal_group(proc, signal.SIGKILL)
        try:
            proc.wait(timeout=_TERM_GRACE_SECONDS)
        except subprocess.TimeoutExpired:
            pass

    @staticmethod
    def _signal_group(proc: subprocess.Popen[str], sig: int) -> None:
        try:
            os.killpg(os.getpgid(proc.pid), sig)
        except (ProcessLookupError, PermissionError, OSError):
            # Process already gone, or no process group (should not happen with
            # start_new_session): fall back to signalling the process directly.
            try:
                proc.send_signal(sig)
            except (ProcessLookupError, OSError):
                pass

    def _drain(self, proc: subprocess.Popen[str]) -> tuple[str, str]:
        try:
            return proc.communicate(timeout=_TERM_GRACE_SECONDS)
        except (subprocess.TimeoutExpired, ValueError):
            return "", ""

    def _truncate(self, value: str | bytes | None, limit: int = 8000) -> str:
        if value is None:
            return ""
        if isinstance(value, bytes):
            value = value.decode("utf-8", errors="replace")
        return value[-limit:]
