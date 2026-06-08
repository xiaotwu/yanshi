from __future__ import annotations

import json
import zipfile
from pathlib import Path, PurePosixPath
from typing import Any

from pydantic import BaseModel, Field

MAX_WORKSHOP_FILE_COUNT = 1_000
MAX_WORKSHOP_UPLOAD_BYTES = 25 * 1024 * 1024
MAX_WORKSHOP_UNCOMPRESSED_BYTES = 100 * 1024 * 1024
MAX_WORKSHOP_MEMBER_BYTES = 25 * 1024 * 1024


class PackValidationResult(BaseModel):
    ok: bool
    name: str | None = None
    version: str | None = None
    author: str | None = None
    contentTypes: list[str] = Field(default_factory=list)
    suggestedPermissions: list[str] = Field(default_factory=list)
    errors: list[str] = Field(default_factory=list)


class WorkshopPackValidator:
    executable_suffixes = {".app", ".bin", ".command", ".dmg", ".exe", ".py", ".sh", ".zsh"}
    allowed_roots = {
        "agents",
        "models",
        "animations",
        "themes",
        "furniture",
        "sounds",
        "profiles",
        "workflows",
        "demos",
    }

    def __init__(
        self,
        *,
        max_file_count: int = MAX_WORKSHOP_FILE_COUNT,
        max_uncompressed_bytes: int = MAX_WORKSHOP_UNCOMPRESSED_BYTES,
        max_member_bytes: int = MAX_WORKSHOP_MEMBER_BYTES,
    ) -> None:
        self.max_file_count = max_file_count
        self.max_uncompressed_bytes = max_uncompressed_bytes
        self.max_member_bytes = max_member_bytes

    def validate_zip(self, zip_path: Path) -> PackValidationResult:
        errors: list[str] = []
        if not zip_path.exists():
            return PackValidationResult(ok=False, errors=["Pack file does not exist."])

        try:
            with zipfile.ZipFile(zip_path) as archive:
                members = archive.infolist()
                names = [member.filename for member in members]
                if "manifest.json" not in names:
                    errors.append("manifest.json is required.")
                file_members = [member for member in members if not member.is_dir()]
                if len(file_members) > self.max_file_count:
                    errors.append(f"Pack contains too many files: {len(file_members)} > {self.max_file_count}.")
                total_uncompressed = sum(member.file_size for member in file_members)
                if total_uncompressed > self.max_uncompressed_bytes:
                    errors.append(
                        f"Pack uncompressed size is too large: {total_uncompressed} > {self.max_uncompressed_bytes} bytes."
                    )

                for member in members:
                    name = member.filename
                    path = safe_archive_path(name)
                    if path is None:
                        errors.append(f"Unsafe path: {name}")
                        continue
                    if member.file_size > self.max_member_bytes:
                        errors.append(f"Pack member is too large: {name}")
                    if is_zip_symlink(member):
                        errors.append(f"Symbolic links are not allowed: {name}")
                    if path.suffix.lower() in self.executable_suffixes:
                        errors.append(f"Executable files are not allowed: {name}")
                    if len(path.parts) > 1 and path.parts[0] not in self.allowed_roots and path.parts[0] != "manifest.json":
                        errors.append(f"Unsupported top-level folder: {path.parts[0]}")

                manifest: dict[str, Any] = {}
                if "manifest.json" in names:
                    manifest = json.loads(archive.read("manifest.json").decode("utf-8"))

                name = manifest.get("name")
                version = manifest.get("version")
                author = manifest.get("author")
                if not name:
                    errors.append("manifest.name is required.")
                if not version:
                    errors.append("manifest.version is required.")

                content_types = manifest.get("contentTypes") or []
                suggested_permissions = manifest.get("suggestedPermissions") or []
        except (zipfile.BadZipFile, json.JSONDecodeError, UnicodeDecodeError) as exc:
            return PackValidationResult(ok=False, errors=[f"Invalid pack: {exc}"])

        return PackValidationResult(
            ok=not errors,
            name=name,
            version=version,
            author=author,
            contentTypes=content_types,
            suggestedPermissions=suggested_permissions,
            errors=errors,
        )


def safe_archive_path(name: str) -> PurePosixPath | None:
    normalized = name.replace("\\", "/")
    path = PurePosixPath(normalized)
    if not normalized.strip() or normalized.startswith("/") or path.is_absolute():
        return None
    if path.parts and path.parts[0].endswith(":"):
        return None
    if any(part in {"", ".", ".."} for part in path.parts):
        return None
    return path


def is_zip_symlink(member: zipfile.ZipInfo) -> bool:
    file_type = (member.external_attr >> 16) & 0o170000
    return file_type == 0o120000
