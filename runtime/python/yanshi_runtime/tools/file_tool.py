from __future__ import annotations

from pathlib import Path

from yanshi_runtime.models import ToolResult

from .base import SandboxViolation, resolve_inside


class FileTool:
    def __init__(self, workspace_root: Path) -> None:
        self.workspace_root = workspace_root.resolve()
        self.workspace_root.mkdir(parents=True, exist_ok=True)

    def list_files(self, requested_path: str = ".") -> ToolResult:
        try:
            target = resolve_inside(self.workspace_root, requested_path)
        except SandboxViolation as exc:
            return ToolResult(ok=False, summary=str(exc), missingRequirement="workspace_path_permission")

        if not target.exists():
            return ToolResult(ok=False, summary=f"Path does not exist: {target}", missingRequirement="existing_workspace_path")
        if not target.is_dir():
            return ToolResult(ok=False, summary=f"Path is not a folder: {target}", missingRequirement="workspace_folder")

        files = []
        for child in sorted(target.iterdir(), key=lambda p: (not p.is_dir(), p.name.lower()))[:200]:
            files.append(
                {
                    "name": child.name,
                    "path": str(child.relative_to(self.workspace_root)),
                    "type": "directory" if child.is_dir() else "file",
                    "size": child.stat().st_size if child.is_file() else None,
                }
            )
        return ToolResult(
            ok=True,
            summary=f"File Agent scanned {len(files)} items.",
            structuredOutput={"root": str(self.workspace_root), "items": files},
        )

    def write_text(self, requested_path: str, content: str) -> ToolResult:
        try:
            target = resolve_inside(self.workspace_root, requested_path)
        except SandboxViolation as exc:
            return ToolResult(ok=False, summary=str(exc), missingRequirement="workspace_path_permission")
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(content, encoding="utf-8")
        return ToolResult(
            ok=True,
            summary=f"File Agent wrote {target.name}.",
            structuredOutput={"path": str(target.relative_to(self.workspace_root))},
        )
