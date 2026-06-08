from __future__ import annotations

from pathlib import Path


class SandboxViolation(ValueError):
    pass


def resolve_inside(root: Path, requested: str | Path) -> Path:
    root = root.resolve()
    candidate = (root / requested).resolve() if not Path(requested).is_absolute() else Path(requested).resolve()
    if candidate != root and root not in candidate.parents:
        raise SandboxViolation(f"Path is outside the Yanshi workspace: {candidate}")
    return candidate
