from __future__ import annotations

import os
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class RuntimeSettings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="YANSHI_", extra="ignore")

    host: str = "127.0.0.1"
    port: int = 8765
    data_dir: Path = Path.home() / ".yanshi"
    runtime_version: str = "0.1.0"
    model_provider: str | None = None
    model_api_key: str | None = None
    permission_mode: str = "default"

    @property
    def database_path(self) -> Path:
        return self.data_dir / "yanshi.db"

    @property
    def checkpoint_path(self) -> Path:
        return self.data_dir / "langgraph-checkpoints.db"

    @property
    def workspace_root(self) -> Path:
        return self.data_dir / "workspaces"

    @property
    def artifacts_root(self) -> Path:
        return self.data_dir / "artifacts"

    @property
    def packs_root(self) -> Path:
        return self.data_dir / "packs"

    def ensure_dirs(self) -> None:
        for path in [self.data_dir, self.workspace_root, self.artifacts_root, self.packs_root]:
            path.mkdir(parents=True, exist_ok=True)


def settings_from_env(data_dir: str | None = None) -> RuntimeSettings:
    if data_dir:
        os.environ["YANSHI_DATA_DIR"] = data_dir
    settings = RuntimeSettings()
    settings.ensure_dirs()
    return settings
