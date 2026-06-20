from __future__ import annotations

import json
import logging
import time
from typing import Any, Iterator

import httpx

from yanshi_runtime.models import ChatMessage, ProviderHealth
from yanshi_runtime.net_guard import BlockedHostError, validate_outbound_url
from yanshi_runtime.providers.openai_compatible import ProviderCallError, ProviderConfig

logger = logging.getLogger(__name__)

ANTHROPIC_VERSION = "2023-06-01"
DEFAULT_MAX_TOKENS = 4096
_CHAT_TIMEOUT_SECONDS = 300.0
_HEALTH_TIMEOUT_SECONDS = 15.0
_MAX_ATTEMPTS = 3
_RETRY_STATUS = {429, 500, 502, 503, 504}
_RETRYABLE_EXC = (httpx.TimeoutException, httpx.ConnectError, httpx.RemoteProtocolError, httpx.ReadError)


def _backoff_seconds(attempt: int) -> float:
    return min(0.5 * 2**attempt, 4.0)


class AnthropicProvider:
    """Native Anthropic Messages-API provider (hand-rolled httpx). Implements the Provider surface;
    text chat + streaming only — the runtime graph orchestrates tools itself."""

    def __init__(self, config: ProviderConfig | None = None) -> None:
        self._config = config

    @property
    def configured(self) -> bool:
        return self._config is not None and bool(self._config.api_key)

    @property
    def public_base_url(self) -> str | None:
        return self._config.base_url if self._config else None

    @property
    def model(self) -> str | None:
        return self._config.model if self._config else None

    def update_config(self, config: ProviderConfig | None) -> None:
        self._config = config

    def _ensure_endpoint_allowed(self) -> None:
        assert self._config is not None
        validate_outbound_url(self._config.base_url, block_private=False)

    def _headers(self) -> dict[str, str]:
        assert self._config is not None
        return {
            "content-type": "application/json",
            "x-api-key": self._config.api_key,
            "anthropic-version": ANTHROPIC_VERSION,
        }

    @staticmethod
    def _translate(messages: list[ChatMessage]) -> tuple[str, list[dict[str, str]]]:
        system = "\n".join(m.content for m in messages if m.role == "system")
        convo = [{"role": m.role, "content": m.content} for m in messages if m.role in ("user", "assistant")]
        return system, convo

    def _payload(self, messages: list[ChatMessage], model: str | None, stream: bool) -> dict[str, Any]:
        assert self._config is not None
        system, convo = self._translate(messages)
        payload: dict[str, Any] = {
            "model": model or self._config.model,
            "max_tokens": DEFAULT_MAX_TOKENS,
            "messages": convo,
            "stream": stream,
        }
        if system:
            payload["system"] = system
        return payload

    @staticmethod
    def _sleep_before_retry(attempt: int, error: Exception) -> None:
        if attempt < _MAX_ATTEMPTS - 1:
            delay = _backoff_seconds(attempt)
            logger.warning("anthropic call transient failure (%s); retrying in %.1fs", error.__class__.__name__, delay)
            time.sleep(delay)

    @staticmethod
    def _extract_answer(body: dict[str, Any]) -> str:
        blocks = body.get("content") or []
        text = "".join(
            block.get("text", "") for block in blocks if isinstance(block, dict) and block.get("type") == "text"
        )
        if not text:
            raise ProviderCallError("Provider returned an empty assistant message.")
        return text

    def chat_completion(self, messages: list[ChatMessage], model: str | None = None) -> str:
        if self._config is None:
            raise ProviderCallError("Model provider is not configured.")
        try:
            self._ensure_endpoint_allowed()
        except BlockedHostError as exc:
            raise ProviderCallError(f"Provider endpoint is blocked: {exc}") from exc
        payload = self._payload(messages, model, stream=False)
        last_error: Exception | None = None
        for attempt in range(_MAX_ATTEMPTS):
            try:
                with httpx.Client(timeout=_CHAT_TIMEOUT_SECONDS) as client:
                    response = client.post(f"{self._config.base_url}/v1/messages", headers=self._headers(), json=payload)
                if response.status_code in _RETRY_STATUS:
                    last_error = ProviderCallError(f"Provider returned HTTP {response.status_code}.")
                    self._sleep_before_retry(attempt, last_error)
                    continue
                if response.status_code >= 400:
                    raise ProviderCallError(f"Provider chat completion failed with HTTP {response.status_code}.")
                return self._extract_answer(response.json())
            except _RETRYABLE_EXC as exc:
                last_error = exc
                self._sleep_before_retry(attempt, exc)
            except httpx.HTTPError as exc:
                raise ProviderCallError(f"Provider chat completion failed: {exc.__class__.__name__}.") from exc
        raise ProviderCallError(
            f"Provider chat completion failed after {_MAX_ATTEMPTS} attempts: {last_error.__class__.__name__ if last_error else 'error'}."
        )

    def stream_chat_completion(self, messages: list[ChatMessage], model: str | None = None) -> Iterator[str]:
        if self._config is None:
            raise ProviderCallError("Model provider is not configured.")
        try:
            self._ensure_endpoint_allowed()
        except BlockedHostError as exc:
            raise ProviderCallError(f"Provider endpoint is blocked: {exc}") from exc
        payload = self._payload(messages, model, stream=True)
        with httpx.Client(timeout=_CHAT_TIMEOUT_SECONDS) as client:
            with client.stream("POST", f"{self._config.base_url}/v1/messages", headers=self._headers(), json=payload) as response:
                if response.status_code >= 400:
                    raise ProviderCallError(f"Provider chat completion failed with HTTP {response.status_code}.")
                for line in response.iter_lines():
                    if not line or not line.startswith("data:"):
                        continue
                    data = line[len("data:"):].strip()
                    try:
                        event = json.loads(data)
                    except json.JSONDecodeError:
                        continue
                    etype = event.get("type")
                    if etype == "content_block_delta":
                        delta = event.get("delta") or {}
                        if delta.get("type") == "text_delta":
                            piece = delta.get("text")
                            if isinstance(piece, str) and piece:
                                yield piece
                    elif etype == "message_stop":
                        break

    def list_models(self) -> list[str]:
        if self._config is None:
            return []
        try:
            self._ensure_endpoint_allowed()
        except BlockedHostError:
            return []
        try:
            with httpx.Client(timeout=_HEALTH_TIMEOUT_SECONDS) as client:
                response = client.get(f"{self._config.base_url}/v1/models", headers=self._headers())
            if response.status_code >= 400:
                return []
            data = response.json()
            return sorted(entry["id"] for entry in data.get("data", []) if isinstance(entry.get("id"), str))
        except Exception:  # noqa: BLE001 — never raise, mirror healthcheck tolerance
            return []

    def healthcheck(self) -> ProviderHealth:
        if self._config is None:
            return ProviderHealth(ok=False, status="not_configured", detail="Model provider is not configured.")
        try:
            self._ensure_endpoint_allowed()
        except BlockedHostError as exc:
            return ProviderHealth(ok=False, status="failed", detail=f"Provider endpoint is blocked: {exc}", baseUrl=self._config.base_url, model=self._config.model)
        try:
            with httpx.Client(timeout=_HEALTH_TIMEOUT_SECONDS) as client:
                response = client.get(f"{self._config.base_url}/v1/models", headers=self._headers())
            ok = response.status_code < 400
            return ProviderHealth(
                ok=ok,
                status="healthy" if ok else "failed",
                detail="Anthropic provider reachable." if ok else f"Provider responded with HTTP {response.status_code}.",
                baseUrl=self._config.base_url,
                model=self._config.model,
            )
        except Exception as exc:  # noqa: BLE001
            return ProviderHealth(ok=False, status="failed", detail=f"Provider unreachable: {exc.__class__.__name__}.", baseUrl=self._config.base_url, model=self._config.model)
