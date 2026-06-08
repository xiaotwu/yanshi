from __future__ import annotations

from dataclasses import dataclass
from typing import Any

import httpx

from yanshi_runtime.models import ChatMessage, ProviderHealth


class ProviderCallError(RuntimeError):
    pass


@dataclass(frozen=True)
class ProviderConfig:
    base_url: str
    model: str
    api_key: str

    @classmethod
    def from_secret_settings(cls, value: dict[str, Any] | None) -> "ProviderConfig | None":
        if not value:
            return None
        base_url = str(value.get("baseUrl") or "").rstrip("/")
        model = str(value.get("model") or "")
        api_key = str(value.get("apiKey") or "")
        if not (base_url and model and api_key):
            return None
        return cls(base_url=base_url, model=model, api_key=api_key)


class OpenAICompatibleProvider:
    def __init__(self, config: ProviderConfig | None = None) -> None:
        self._config = config

    @property
    def configured(self) -> bool:
        return self._config is not None

    @property
    def public_base_url(self) -> str | None:
        return self._config.base_url if self._config else None

    @property
    def model(self) -> str | None:
        return self._config.model if self._config else None

    def update_config(self, config: ProviderConfig | None) -> None:
        self._config = config

    def healthcheck(self) -> ProviderHealth:
        if self._config is None:
            return ProviderHealth(ok=False, status="not_configured", detail="Model provider is not configured.")
        try:
            with httpx.Client(timeout=10) as client:
                response = client.get(
                    f"{self._config.base_url}/models",
                    headers=self._headers(),
                )
            if response.status_code >= 400:
                return ProviderHealth(
                    ok=False,
                    status="failed",
                    detail=f"Provider healthcheck failed with HTTP {response.status_code}.",
                    baseUrl=self._config.base_url,
                    model=self._config.model,
                )
            return ProviderHealth(
                ok=True,
                status="healthy",
                detail="Provider responded to model listing.",
                baseUrl=self._config.base_url,
                model=self._config.model,
            )
        except httpx.HTTPError as exc:
            return ProviderHealth(
                ok=False,
                status="failed",
                detail=f"Provider healthcheck failed: {exc.__class__.__name__}.",
                baseUrl=self._config.base_url,
                model=self._config.model,
            )

    def chat_completion(self, messages: list[ChatMessage]) -> str:
        if self._config is None:
            raise ProviderCallError("Model provider is not configured.")
        payload = {
            "model": self._config.model,
            "messages": [message.model_dump() for message in messages],
            "stream": False,
        }
        try:
            with httpx.Client(timeout=60) as client:
                response = client.post(
                    f"{self._config.base_url}/chat/completions",
                    headers=self._headers(),
                    json=payload,
                )
            if response.status_code >= 400:
                raise ProviderCallError(f"Provider chat completion failed with HTTP {response.status_code}.")
            body = response.json()
            choices = body.get("choices") or []
            if not choices:
                raise ProviderCallError("Provider returned no choices.")
            message = choices[0].get("message") or {}
            content = message.get("content")
            if not isinstance(content, str) or not content.strip():
                raise ProviderCallError("Provider returned an empty assistant message.")
            return content.strip()
        except httpx.HTTPError as exc:
            raise ProviderCallError(f"Provider chat completion failed: {exc.__class__.__name__}.") from exc

    def _headers(self) -> dict[str, str]:
        assert self._config is not None
        return {
            "Authorization": f"Bearer {self._config.api_key}",
            "Content-Type": "application/json",
        }
