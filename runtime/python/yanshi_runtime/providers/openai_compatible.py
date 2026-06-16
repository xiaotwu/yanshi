from __future__ import annotations

import json
import logging
import re
import time
from dataclasses import dataclass
from typing import Any

import httpx

from yanshi_runtime.models import ChatMessage, ProviderHealth

logger = logging.getLogger("yanshi.provider")

# Local models (Ollama/LM Studio/vLLM) and reasoning models can take a while to generate,
# especially on CPU and on a second/third sequential call. Keep generous timeouts so real runs
# don't fail spuriously.
_CHAT_TIMEOUT_SECONDS = 300.0
_HEALTH_TIMEOUT_SECONDS = 15.0

# Transient-failure retry policy. Only the *connection* / pre-stream phase is retried, so we never
# duplicate a partially-streamed answer.
_MAX_ATTEMPTS = 3
_RETRY_STATUS = {429, 500, 502, 503, 504}
_RETRYABLE_EXC = (httpx.TimeoutException, httpx.ConnectError, httpx.RemoteProtocolError, httpx.ReadError)


def _backoff_seconds(attempt: int) -> float:
    return min(4.0, 0.5 * (2 ** attempt))

# Some reasoning models inline their chain-of-thought in the message content using
# <think>…</think> (or <thinking>…</thinking>) tags rather than a separate field.
# Strip it so downstream parsing/display only sees the final answer.
_THINK_BLOCK = re.compile(r"<think(?:ing)?>.*?</think(?:ing)?>", re.DOTALL | re.IGNORECASE)
_THINK_CLOSE = re.compile(r"</think(?:ing)?>", re.IGNORECASE)


def strip_reasoning(content: str) -> str:
    """Remove inline reasoning from assistant content and return the final answer.

    Handles two real-world shapes from local reasoning models (e.g. via Ollama):
    well-formed ``<think>…</think>`` blocks, and a *dangling* closing tag where the opening
    tag was consumed into a separate ``reasoning`` field but the thought text and the
    closing ``</think>`` still leaked into ``content`` ahead of the answer.
    """
    text = _THINK_BLOCK.sub("", content)
    closes = list(_THINK_CLOSE.finditer(text))
    if closes:
        # Everything up to and including the last dangling close tag is reasoning.
        text = text[closes[-1].end():]
    return text.strip()


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
        # The API key is optional: local OpenAI-compatible servers (Ollama, LM Studio,
        # vLLM/SGLang) are keyless. A provider is "configured" once it has an endpoint and
        # a model; auth is only sent when a key is present.
        api_key = str(value.get("apiKey") or "")
        if not (base_url and model):
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
            with httpx.Client(timeout=_HEALTH_TIMEOUT_SECONDS) as client:
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
        last_error: Exception | None = None
        for attempt in range(_MAX_ATTEMPTS):
            try:
                with httpx.Client(timeout=_CHAT_TIMEOUT_SECONDS) as client:
                    response = client.post(
                        f"{self._config.base_url}/chat/completions",
                        headers=self._headers(),
                        json=payload,
                    )
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

    @staticmethod
    def _sleep_before_retry(attempt: int, error: Exception) -> None:
        if attempt < _MAX_ATTEMPTS - 1:
            delay = _backoff_seconds(attempt)
            logger.warning("provider call transient failure (%s); retrying in %.1fs", error.__class__.__name__, delay)
            time.sleep(delay)

    @staticmethod
    def _extract_answer(body: dict[str, Any]) -> str:
        choices = body.get("choices") or []
        if not choices:
            raise ProviderCallError("Provider returned no choices.")
        message = choices[0].get("message") or {}
        content = message.get("content")
        text = strip_reasoning(content) if isinstance(content, str) else ""
        if not text:
            # Some reasoning models put everything in the reasoning channel and leave content empty
            # for certain prompts. Fall back to the reasoning so the run still produces an answer.
            reasoning = message.get("reasoning")
            text = strip_reasoning(reasoning) if isinstance(reasoning, str) else ""
        if not text:
            raise ProviderCallError("Provider returned an empty assistant message.")
        return text

    def stream_chat_completion(self, messages: list[ChatMessage]):
        """Yield assistant *content* deltas as they arrive (OpenAI SSE format). Reasoning deltas
        are ignored. Used to stream the final answer to the UI; falls back cleanly — callers that
        want the whole string can ``"".join(...)`` the chunks."""
        if self._config is None:
            raise ProviderCallError("Model provider is not configured.")
        payload = {
            "model": self._config.model,
            "messages": [message.model_dump() for message in messages],
            "stream": True,
        }
        try:
            with httpx.Client(timeout=_CHAT_TIMEOUT_SECONDS) as client:
                with client.stream(
                    "POST",
                    f"{self._config.base_url}/chat/completions",
                    headers=self._headers(),
                    json=payload,
                ) as response:
                    if response.status_code >= 400:
                        raise ProviderCallError(
                            f"Provider chat completion failed with HTTP {response.status_code}."
                        )
                    content_seen = False
                    reasoning_parts: list[str] = []
                    for line in response.iter_lines():
                        if not line or not line.startswith("data:"):
                            continue
                        data = line[len("data:") :].strip()
                        if data == "[DONE]":
                            break
                        try:
                            chunk = json.loads(data)
                        except json.JSONDecodeError:
                            continue
                        choices = chunk.get("choices") or []
                        if not choices:
                            continue
                        delta = choices[0].get("delta") or {}
                        piece = delta.get("content")
                        if isinstance(piece, str) and piece:
                            content_seen = True
                            yield piece
                        reasoning = delta.get("reasoning")
                        if isinstance(reasoning, str) and reasoning:
                            reasoning_parts.append(reasoning)
                    # Degenerate reasoning-only response (empty content): surface the reasoning as
                    # the answer so the turn still completes instead of failing empty.
                    if not content_seen and reasoning_parts:
                        yield strip_reasoning("".join(reasoning_parts))
        except httpx.HTTPError as exc:
            raise ProviderCallError(f"Provider chat completion failed: {exc.__class__.__name__}.") from exc

    def _headers(self) -> dict[str, str]:
        assert self._config is not None
        headers = {"Content-Type": "application/json"}
        # Only attach bearer auth when a key is configured. Keyless local servers
        # (Ollama, LM Studio, vLLM) reject or don't expect an empty bearer token.
        if self._config.api_key:
            headers["Authorization"] = f"Bearer {self._config.api_key}"
        return headers
