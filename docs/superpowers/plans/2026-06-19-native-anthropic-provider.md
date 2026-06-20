# Native Anthropic Provider Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a native Anthropic Messages-API provider behind a `Provider` protocol, selected by a `providerType` setting, so Yanshi can talk to Anthropic directly (text chat + streaming + health + model list) — switchable at runtime alongside the existing OpenAI-compatible provider.

**Architecture:** Extract a `Provider` Protocol (the 8-method surface the graph/app already use); `OpenAICompatibleProvider` already conforms. Add a hand-rolled httpx `AnthropicProvider` (system/messages split, content-block parsing, SSE streaming, `/v1/models`). A `build_provider(config)` factory selects by `ProviderConfig.provider_type`; switching the type at runtime rebuilds the provider and reassigns `graph.provider`. No native tool-use (the graph orchestrates tools), no new dependencies.

**Tech Stack:** Python 3.12, stdlib + `httpx` (already a dep), FastAPI; TypeScript/React/Zustand/Vitest; pytest.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-06-19-native-anthropic-provider-design.md`.
- **Mirror `openai_compatible.py`** (retry/backoff, `_headers`, `net_guard` via `_ensure_endpoint_allowed(block_private=False)`, "never raise / never fabricate" for `list_models`).
- **No faked models** — `list_models` returns `[]` on any error/unconfigured. **No native tool-use** (out of scope). Key stays in SecretStore; never returned (`ProviderSettingsPublic` has no key) or logged.
- Anthropic specifics: endpoint `POST {base}/v1/messages`, headers `x-api-key` + `anthropic-version: 2023-06-01` + `content-type: application/json`; `system` separated from `messages`; `max_tokens` default 4096; response `content[]` text blocks; streaming SSE `content_block_delta`/`text_delta`; models from `GET {base}/v1/models` (shape `{"data":[{"id":...}]}`).
- `providerType` default `"openai"` everywhere — **backward compatible** (existing configs unchanged).
- Provider unit tests use a **real loopback HTTP server** (mirror the existing `FakeModelsServer` pattern in `tests/test_runtime.py`), not network mocks.
- Real storage class is `Storage(database_path, runtime_version)`. pytest: `cd runtime/python && .venv/bin/python -m pytest -p no:cacheprovider`. Frontend gate: `cd apps/desktop && npm run lint && npx vitest run`.
- Commit messages end with: `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.

---

### Task 1: `Provider` protocol + `AnthropicProvider`

**Files:**
- Create: `runtime/python/yanshi_runtime/providers/base.py` (the `Provider` Protocol)
- Create: `runtime/python/yanshi_runtime/providers/anthropic.py` (`AnthropicProvider`)
- Modify: `runtime/python/yanshi_runtime/providers/openai_compatible.py` (`ProviderConfig` gains `provider_type`)
- Test: `runtime/python/tests/test_runtime.py` (+ a `FakeAnthropicServer` loopback fixture)

**Interfaces:**
- Consumes: `ChatMessage`, `ProviderHealth` (`yanshi_runtime.models`); `validate_outbound_url`/`BlockedHostError` (`net_guard`); `ProviderConfig`/`ProviderCallError` (`providers.openai_compatible`).
- Produces:
  - `Provider` Protocol (in `base.py`) with: `configured: bool` (property), `public_base_url: str | None`, `model: str | None`, `update_config(config) -> None`, `list_models() -> list[str]`, `healthcheck() -> ProviderHealth`, `chat_completion(messages, model=None) -> str`, `stream_chat_completion(messages, model=None) -> Iterator[str]`.
  - `ProviderConfig.provider_type: str = "openai"` (field) + `from_secret_settings` reads `value.get("providerType") or "openai"`.
  - `AnthropicProvider(config: ProviderConfig | None)` implementing `Provider`.

- [ ] **Step 1: Add `provider_type` to `ProviderConfig`** in `openai_compatible.py` (frozen dataclass + classmethod):

```python
@dataclass(frozen=True)
class ProviderConfig:
    base_url: str
    model: str
    api_key: str
    provider_type: str = "openai"

    @classmethod
    def from_secret_settings(cls, value: dict[str, Any] | None) -> "ProviderConfig | None":
        if not value:
            return None
        base_url = str(value.get("baseUrl") or "").rstrip("/")
        model = str(value.get("model") or "")
        api_key = str(value.get("apiKey") or "")
        provider_type = str(value.get("providerType") or "openai")
        if not (base_url and model):
            return None
        return cls(base_url=base_url, model=model, api_key=api_key, provider_type=provider_type)
```

- [ ] **Step 2: Create the `Provider` Protocol** `base.py`:

```python
from __future__ import annotations

from typing import Iterator, Protocol

from yanshi_runtime.models import ChatMessage, ProviderHealth


class Provider(Protocol):
    """The provider surface the runtime graph + service depend on. Both OpenAICompatibleProvider
    and AnthropicProvider implement it; the graph holds one behind this interface."""

    @property
    def configured(self) -> bool: ...
    @property
    def public_base_url(self) -> str | None: ...
    @property
    def model(self) -> str | None: ...

    def update_config(self, config: object) -> None: ...
    def list_models(self) -> list[str]: ...
    def healthcheck(self) -> ProviderHealth: ...
    def chat_completion(self, messages: list[ChatMessage], model: str | None = None) -> str: ...
    def stream_chat_completion(self, messages: list[ChatMessage], model: str | None = None) -> Iterator[str]: ...
```

- [ ] **Step 3: Write the `FakeAnthropicServer` fixture + failing tests** in `tests/test_runtime.py` (mirror the existing `FakeModelsServer` — uses the already-imported `ThreadingHTTPServer`/`BaseHTTPRequestHandler`):

```python
import json as _json
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import threading as _threading
from contextlib import contextmanager


@contextmanager
def FakeAnthropicServer(*, models=("claude-b", "claude-a"), answer="Hello from Claude", stream_text="Hi", status=200):
    class Handler(BaseHTTPRequestHandler):
        def log_message(self, *a):  # silence
            pass

        def _send(self, code, body: dict):
            payload = _json.dumps(body).encode()
            self.send_response(code)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(payload)))
            self.end_headers()
            self.wfile.write(payload)

        def do_GET(self):
            if self.path == "/v1/models":
                self._send(status, {"data": [{"id": m} for m in models]})
            else:
                self._send(404, {})

        def do_POST(self):
            length = int(self.headers.get("Content-Length", 0))
            body = _json.loads(self.rfile.read(length) or b"{}")
            if self.path != "/v1/messages":
                self._send(404, {})
                return
            if body.get("stream"):
                # Minimal Anthropic SSE: one content_block_delta then message_stop.
                self.send_response(status)
                self.send_header("Content-Type", "text/event-stream")
                self.end_headers()
                self.wfile.write(b"event: content_block_delta\n")
                self.wfile.write(("data: " + _json.dumps({"type": "content_block_delta", "delta": {"type": "text_delta", "text": stream_text}}) + "\n\n").encode())
                self.wfile.write(b"event: message_stop\n")
                self.wfile.write(("data: " + _json.dumps({"type": "message_stop"}) + "\n\n").encode())
                self.wfile.flush()
            else:
                self._send(status, {"content": [{"type": "text", "text": answer}], "role": "assistant"})

    server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
    thread = _threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        yield f"http://127.0.0.1:{server.server_address[1]}"
    finally:
        server.shutdown()


def _anthropic_cfg(base_url: str, *, key: str = "sk-test"):
    from yanshi_runtime.providers.openai_compatible import ProviderConfig
    return ProviderConfig(base_url=base_url, model="claude-a", api_key=key, provider_type="anthropic")


def test_anthropic_chat_completion_translates_and_parses() -> None:
    from yanshi_runtime.providers.anthropic import AnthropicProvider
    from yanshi_runtime.models import ChatMessage
    with FakeAnthropicServer(answer="42") as base:
        provider = AnthropicProvider(_anthropic_cfg(base))
        out = provider.chat_completion([ChatMessage(role="system", content="be terse"), ChatMessage(role="user", content="q")])
    assert out == "42"


def test_anthropic_stream_yields_text_deltas() -> None:
    from yanshi_runtime.providers.anthropic import AnthropicProvider
    from yanshi_runtime.models import ChatMessage
    with FakeAnthropicServer(stream_text="streamed") as base:
        provider = AnthropicProvider(_anthropic_cfg(base))
        chunks = list(provider.stream_chat_completion([ChatMessage(role="user", content="q")]))
    assert "".join(chunks) == "streamed"


def test_anthropic_list_models_sorted_and_honest() -> None:
    from yanshi_runtime.providers.anthropic import AnthropicProvider
    with FakeAnthropicServer(models=("claude-b", "claude-a")) as base:
        assert AnthropicProvider(_anthropic_cfg(base)).list_models() == ["claude-a", "claude-b"]
    with FakeAnthropicServer(status=500) as base:
        assert AnthropicProvider(_anthropic_cfg(base)).list_models() == []
    from yanshi_runtime.providers.anthropic import AnthropicProvider as AP
    assert AP(None).list_models() == []


def test_anthropic_configured_requires_key() -> None:
    from yanshi_runtime.providers.anthropic import AnthropicProvider
    assert AnthropicProvider(_anthropic_cfg("http://127.0.0.1:1", key="sk")).configured is True
    assert AnthropicProvider(_anthropic_cfg("http://127.0.0.1:1", key="")).configured is False
    assert AnthropicProvider(None).configured is False
```

- [ ] **Step 4: Run to verify they fail** — `cd runtime/python && .venv/bin/python -m pytest -p no:cacheprovider tests/test_runtime.py -k anthropic -q` → FAIL (module `anthropic` not found).

- [ ] **Step 5: Implement `anthropic.py`** (mirror `openai_compatible.py`'s structure):

```python
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
                    data = line[len("data:") :].strip()
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
```

- [ ] **Step 6: Run the anthropic tests, then the full suite** — `… -k anthropic` → PASS (4); then full suite green.
- [ ] **Step 7: Commit**

```bash
git add runtime/python/yanshi_runtime/providers/base.py runtime/python/yanshi_runtime/providers/anthropic.py runtime/python/yanshi_runtime/providers/openai_compatible.py runtime/python/tests/test_runtime.py
git commit -m "$(printf 'feat(providers): native Anthropic Messages-API provider + Provider protocol\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>')"
```

---

### Task 2: Settings plumbing + `build_provider` factory + runtime hot-swap

**Files:**
- Modify: `runtime/python/yanshi_runtime/models.py` (`ProviderSettingsUpdate`/`ProviderSettingsPublic` gain `providerType`)
- Modify: `runtime/python/yanshi_runtime/storage.py` (`set_provider_settings` + `get_provider_settings_secret` + `get_provider_settings_public` carry `providerType`)
- Modify: `runtime/python/yanshi_runtime/providers/__init__.py` (export `Provider`, `AnthropicProvider`, `build_provider`)
- Modify: `runtime/python/yanshi_runtime/server/app.py` (`RuntimeService.__init__` uses `build_provider`; `update_provider_settings` rebuilds + reassigns `self.provider` and `self.graph.provider`)
- Test: `runtime/python/tests/test_runtime.py`

**Interfaces:**
- Consumes: `AnthropicProvider`, `OpenAICompatibleProvider`, `ProviderConfig`, `Provider` (Task 1).
- Produces:
  - `build_provider(config: ProviderConfig | None) -> Provider` (in `providers/__init__.py`): returns `AnthropicProvider` when `config is not None and config.provider_type == "anthropic"`, else `OpenAICompatibleProvider`.
  - `ProviderSettingsUpdate.providerType: str = "openai"`, `ProviderSettingsPublic.providerType: str = "openai"`.
  - `storage.set_provider_settings(*, base_url, model, api_key, provider_type="openai")` persists `providerType`; secret + public getters return it.
  - `update_provider_settings` swaps the live provider when the type changes.

- [ ] **Step 1: Write the failing test**

```python
def test_provider_type_persists_and_rebuilds_to_anthropic(tmp_path: Path) -> None:
    client = make_client(tmp_path)  # the existing helper
    # Switch to Anthropic.
    client.put("/settings/provider", json={"providerType": "anthropic", "baseUrl": "https://api.anthropic.com", "model": "claude-a", "apiKey": "sk-test"})
    public = client.get("/settings/provider").json()
    assert public["providerType"] == "anthropic"
    # The live provider was rebuilt to the Anthropic implementation.
    service = client.app.state.runtime_service
    from yanshi_runtime.providers.anthropic import AnthropicProvider
    assert isinstance(service.provider, AnthropicProvider)
    assert service.graph.provider is service.provider  # graph got the swapped instance


def test_build_provider_selects_by_type() -> None:
    from yanshi_runtime.providers import build_provider
    from yanshi_runtime.providers.anthropic import AnthropicProvider
    from yanshi_runtime.providers.openai_compatible import OpenAICompatibleProvider, ProviderConfig
    a = build_provider(ProviderConfig(base_url="https://x", model="m", api_key="k", provider_type="anthropic"))
    o = build_provider(ProviderConfig(base_url="https://x", model="m", api_key="k", provider_type="openai"))
    assert isinstance(a, AnthropicProvider)
    assert isinstance(o, OpenAICompatibleProvider)
    assert isinstance(build_provider(None), OpenAICompatibleProvider)
```

(Confirm the provider-settings endpoint path is `/settings/provider` and `make_client` exists — both verified in the current tests.)

- [ ] **Step 2: Run to verify it fails** — `… -k "provider_type_persists or build_provider_selects"` → FAIL.

- [ ] **Step 3: Models** — add `providerType: str = "openai"` to `ProviderSettingsUpdate` and `ProviderSettingsPublic` in `models.py`.

- [ ] **Step 4: Storage** — thread `provider_type` through `set_provider_settings`/`get_provider_settings_secret`/`get_provider_settings_public` in `storage.py`:

```python
    def set_provider_settings(self, *, base_url: str, model: str, api_key: str | None, provider_type: str = "openai") -> ProviderSettingsPublic:
        existing = self.get_setting("provider") or {}
        api_key_ref = existing.get("apiKeyRef")
        if api_key is not None:
            api_key_ref = self.secret_store.set_secret(PROVIDER_API_KEY_SECRET, api_key)
        next_value = {"baseUrl": base_url.rstrip("/"), "model": model, "apiKeyRef": api_key_ref, "providerType": provider_type}
        next_value.pop("apiKey", None)
        self.set_setting("provider", next_value)
        return self.get_provider_settings_public()
```

In `get_provider_settings_secret`, add `"providerType": value.get("providerType") or "openai"` to the returned dict. In `get_provider_settings_public`, set `providerType=value.get("providerType") or "openai"` on the returned `ProviderSettingsPublic` (read the current body and add the field consistently).

- [ ] **Step 5: Factory** — in `providers/__init__.py`:

```python
from .anthropic import AnthropicProvider
from .base import Provider
from .openai_compatible import OpenAICompatibleProvider, ProviderCallError, ProviderConfig


def build_provider(config: ProviderConfig | None) -> Provider:
    if config is not None and config.provider_type == "anthropic":
        return AnthropicProvider(config)
    return OpenAICompatibleProvider(config)


__all__ = ["AnthropicProvider", "OpenAICompatibleProvider", "Provider", "ProviderCallError", "ProviderConfig", "build_provider"]
```

- [ ] **Step 6: Service wiring** — in `app.py`: `from yanshi_runtime.providers import build_provider, ProviderConfig` (keep existing imports). Replace the constructor (`self.provider = OpenAICompatibleProvider(ProviderConfig.from_secret_settings(...))`) with `self.provider = build_provider(ProviderConfig.from_secret_settings(self.storage.get_provider_settings_secret()))`. In `update_provider_settings`, pass `provider_type=request.providerType` to `set_provider_settings`, and replace the `self.provider.update_config(...)` line with a rebuild + reassign:

```python
    def update_provider_settings(self, request: ProviderSettingsUpdate) -> ProviderSettingsPublic:
        settings = self.storage.set_provider_settings(
            base_url=request.baseUrl,
            model=request.model,
            api_key=request.apiKey,
            provider_type=request.providerType,
        )
        # Rebuild the provider (the type may have changed — that needs a new instance, not update_config)
        # and hand the same instance to the graph so runs use it immediately.
        self.provider = build_provider(ProviderConfig.from_secret_settings(self.storage.get_provider_settings_secret()))
        self.graph.provider = self.provider
        self.storage.append_event(
            "runtime.status.changed",
            payload={"status": "provider.updated", "baseUrl": settings.baseUrl, "model": settings.model, "providerType": settings.providerType},
        )
        return settings
```

(Verify the exact existing body of `update_provider_settings` and keep its return/other lines intact; only swap the config-update line for the rebuild and add `provider_type`.)

- [ ] **Step 7: Run the two tests, then the full suite** — green.
- [ ] **Step 8: Commit**

```bash
git add runtime/python/yanshi_runtime/models.py runtime/python/yanshi_runtime/storage.py runtime/python/yanshi_runtime/providers/__init__.py runtime/python/yanshi_runtime/server/app.py runtime/python/tests/test_runtime.py
git commit -m "$(printf 'feat(runtime): providerType setting + factory + runtime provider hot-swap\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>')"
```

---

### Task 3: Frontend — provider-type selector

**Files:**
- Modify: `packages/shared/src/index.ts` (`ProviderSettingsPublic`/the update body type gain `providerType`)
- Modify: `apps/desktop/src/api/client.ts` (`updateProviderSettings` body includes `providerType`)
- Modify: `apps/desktop/src/stores/runtimeStore.ts` (`saveProviderSettings` signature carries `providerType`)
- Modify: `apps/desktop/src/features/ai-integrations.tsx` (`ProvidersSection` — a provider-type selector; Anthropic preset)
- Modify: `apps/desktop/src/i18n/en.ts` + `zh.ts`
- Test: `apps/desktop/src/features/ai-integrations.test.tsx`

**Interfaces:**
- Consumes: `PUT /settings/provider` now accepting `providerType` (Task 2).
- Produces: `runtimeApi.updateProviderSettings({ baseUrl, model, apiKey?, providerType? })`; store `saveProviderSettings` accepts `providerType`; the UI offers OpenAI-compatible | Anthropic, defaulting baseUrl when Anthropic is chosen.

- [ ] **Step 1: Types + client + store** — add `providerType?: "openai" | "anthropic"` to the shared `ProviderSettingsPublic` (and any update type). In `client.ts`, extend `updateProviderSettings` to include `providerType` in the JSON body. In `runtimeStore.ts`, extend `saveProviderSettings`'s settings arg type with `providerType?: "openai" | "anthropic"` and pass it through.

- [ ] **Step 2: Write the failing vitest** — `apps/desktop/src/features/ai-integrations.test.tsx`:

```tsx
// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("../i18n", () => ({ useT: () => ({ t: (k: string) => k }) }));
const save = vi.fn();
vi.mock("../stores/runtimeStore", () => ({
  useRuntimeStore: () => ({
    providerSettings: { baseUrl: "https://api.openai.com/v1", model: "", apiKeyConfigured: false, providerType: "openai" },
    providerHealth: null, saveProviderSettings: save, checkProviderHealth: vi.fn(), loading: false,
  }),
}));

import { ProvidersSection } from "./ai-integrations";

describe("ProvidersSection provider type", () => {
  it("offers an Anthropic option", () => {
    render(<ProvidersSection />);
    // The provider-type control includes Anthropic (by label or option value).
    expect(screen.getByText(/anthropic/i)).toBeInTheDocument();
  });
});
```

(Confirm `ProvidersSection`'s real store-field usage and adjust the mock so it renders; if it reads more fields, add them.)

- [ ] **Step 3: Run to verify it fails.**
- [ ] **Step 4: Implement the selector** in `ProvidersSection` — a provider-type control (segmented/select) with OpenAI-compatible and Anthropic; when Anthropic is selected, default `baseUrl` to `https://api.anthropic.com` and indicate the api key is required; include `providerType` in the `saveProviderSettings` call. Add a `PROVIDER_CATALOG` Anthropic entry if the section is catalog-driven. New i18n keys (e.g. `integrations.providers.type`, `integrations.providers.anthropic`, `integrations.providers.openai`) in BOTH `en.ts` and `zh.ts`.
- [ ] **Step 5: Run the test + full gate** — `npx vitest run src/features/ai-integrations.test.tsx` PASS; `npm run lint && npx vitest run` → tsc clean + all green (incl. i18n parity).
- [ ] **Step 6: Commit**

```bash
git add apps/desktop/src/api/client.ts apps/desktop/src/stores/runtimeStore.ts apps/desktop/src/features/ai-integrations.tsx apps/desktop/src/features/ai-integrations.test.tsx packages/shared/src/index.ts apps/desktop/src/i18n/en.ts apps/desktop/src/i18n/zh.ts
git commit -m "$(printf 'feat(desktop): provider-type selector (OpenAI-compatible | Anthropic)\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>')"
```

---

## Self-Review

**Spec coverage:** §3.1 Provider Protocol → Task 1 (base.py). §3.2 providerType in config/settings → Task 1 (ProviderConfig) + Task 2 (models/storage). §3.3 AnthropicProvider (chat/stream/list_models/healthcheck/configured/translate/endpoint-allowed) → Task 1. §3.4 factory + hot-swap → Task 2. §4 frontend selector → Task 3. §5 security (key in SecretStore, masked public, net_guard) → Task 1 (`_ensure_endpoint_allowed`, no key in public) + Task 2 (existing secret-ref persistence unchanged). §6 tests (loopback fake server, translation, stream, models, health, configured, factory, UI) → all tasks. §8 honesty (no faked models; configured requires key; no tool-use) → Task 1. ✅

**Placeholder scan:** Complete code in every code step. Three steps ask the implementer to *confirm a real shape before finalizing* (the exact `get_provider_settings_public` body in Task 2 Step 4; the exact `update_provider_settings` body in Task 2 Step 6; `ProvidersSection`'s store-field usage in Task 3 Step 2) — verify-against-real-code, not missing content.

**Type consistency:** `ProviderConfig.provider_type` (Task 1) is read by `build_provider` (Task 2) and `from_secret_settings`. `providerType` is consistent across models → storage → API → TS → client → store → UI. The `Provider` protocol's method names match both providers' methods (`chat_completion`/`stream_chat_completion(messages, model=None)`, `list_models`, `healthcheck`, `configured`, `public_base_url`, `model`, `update_config`). `build_provider` return type is `Provider`.

**Scope:** Single cohesive plan (one provider + abstraction + selection UI). No native tool-use / caching / Gemini referenced by any task (deferred per spec).
