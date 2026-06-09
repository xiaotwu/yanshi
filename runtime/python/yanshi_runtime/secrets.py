from __future__ import annotations

import os
import platform
import shutil
import subprocess
from pathlib import Path
from typing import Protocol

KEYCHAIN_SERVICE = "ai.yanshi.runtime"


class SecretStore(Protocol):
    """Stores secrets outside the SQLite database and returns an opaque reference.

    The reference (``apiKeyRef``) is what we persist in SQLite; the raw secret is
    only ever read back through :meth:`get_secret` when the runtime needs it.
    """

    def set_secret(self, name: str, value: str) -> str:
        ...

    def get_secret(self, ref: str) -> str | None:
        ...

    def delete_secret(self, ref: str) -> None:
        ...


class FileSecretStore:
    """Secret store backed by 0600 files in a dedicated secrets directory.

    Keeps raw secrets out of SQLite and out of any API response or log. Files are
    created with owner-only permissions so the key is protected by the same
    filesystem boundary as the rest of the runtime data directory.
    """

    backend = "file"

    def __init__(self, secrets_dir: Path) -> None:
        self.secrets_dir = secrets_dir

    def _path_for(self, name: str) -> Path:
        safe = "".join(ch for ch in name if ch.isalnum() or ch in {"_", "-", "."}) or "secret"
        return self.secrets_dir / f"{safe}.secret"

    def set_secret(self, name: str, value: str) -> str:
        self.secrets_dir.mkdir(parents=True, exist_ok=True)
        path = self._path_for(name)
        # Write with restrictive permissions from the start to avoid a brief window
        # where the secret is world-readable.
        fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
        try:
            os.write(fd, value.encode("utf-8"))
        finally:
            os.close(fd)
        os.chmod(path, 0o600)
        return f"file:{path.name}"

    def get_secret(self, ref: str) -> str | None:
        name = ref.split(":", 1)[1] if ref.startswith("file:") else ref
        path = self.secrets_dir / name
        if not path.exists():
            return None
        return path.read_text(encoding="utf-8")

    def delete_secret(self, ref: str) -> None:
        name = ref.split(":", 1)[1] if ref.startswith("file:") else ref
        (self.secrets_dir / name).unlink(missing_ok=True)


class KeychainSecretStore:
    """Secret store backed by the macOS login keychain via the ``security`` CLI.

    Enabled opt-in (``YANSHI_SECRET_BACKEND=keychain``) so automated/headless builds
    do not trigger keychain authorization prompts. The reference encodes the account
    name; the secret never touches SQLite.
    """

    backend = "keychain"

    def __init__(self, service: str = KEYCHAIN_SERVICE) -> None:
        self.service = service

    def set_secret(self, name: str, value: str) -> str:
        subprocess.run(
            [
                "security",
                "add-generic-password",
                "-U",  # update if it already exists
                "-s",
                self.service,
                "-a",
                name,
                "-w",
                value,
            ],
            capture_output=True,
            text=True,
            check=True,
        )
        return f"keychain:{name}"

    def get_secret(self, ref: str) -> str | None:
        name = ref.split(":", 1)[1] if ref.startswith("keychain:") else ref
        completed = subprocess.run(
            ["security", "find-generic-password", "-s", self.service, "-a", name, "-w"],
            capture_output=True,
            text=True,
            check=False,
        )
        if completed.returncode != 0:
            return None
        return completed.stdout.rstrip("\n")

    def delete_secret(self, ref: str) -> None:
        name = ref.split(":", 1)[1] if ref.startswith("keychain:") else ref
        subprocess.run(
            ["security", "delete-generic-password", "-s", self.service, "-a", name],
            capture_output=True,
            text=True,
            check=False,
        )


def default_secret_store(data_dir: Path) -> SecretStore:
    """Pick a secret backend.

    Defaults to the file store (deterministic, no prompts). On macOS, setting
    ``YANSHI_SECRET_BACKEND=keychain`` opts into the login keychain when the
    ``security`` CLI is available.
    """

    backend = os.environ.get("YANSHI_SECRET_BACKEND", "").strip().lower()
    if backend == "keychain" and platform.system() == "Darwin" and shutil.which("security"):
        return KeychainSecretStore()
    return FileSecretStore(data_dir / "secrets")
