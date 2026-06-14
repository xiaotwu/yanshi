# LLM Providers

Open **Settings → LLM Providers** to connect a model backend.

## OpenAI-compatible — Available now <Badge type="tip" text="Available now" />

The OpenAI-compatible protocol has real runtime support. Open a provider card and set:

- **Base URL** — e.g. `https://api.openai.com/v1`, or any OpenAI-compatible endpoint.
- **Model** — the model name to use.
- **API key** — stored securely; never shown again.

Then use **Test** (a real healthcheck against the endpoint) and **Save**. Save and "Set as
preferred" are separate actions — the **Preferred for** chips (New chats / Coding / Everyday)
record a preference; today every chat uses the saved provider configuration and per-action
routing arrives with multi-provider support.

The catalog also lists OpenRouter, DeepSeek, Mistral, Ollama, LM Studio, and vLLM/SGLang as
**custom-endpoint** entries — they work by pointing the OpenAI-compatible client at their base URL.

## Native adapters — Planned <Badge type="warning" text="Planned" />

Native **Anthropic** and **Gemini** protocols are honestly marked *Not implemented yet* and cannot
be configured as native providers. (Where a provider exposes an OpenAI-compatible endpoint, use
the custom-endpoint path above.)

## Status summary

| Provider path | Public status |
|---|---|
| OpenAI-compatible API | <Badge type="tip" text="Available now" /> |
| Custom OpenAI-compatible endpoints | <Badge type="warning" text="Setup required" /> base URL, model, API key |
| Native Anthropic protocol | <Badge type="warning" text="Planned" /> |
| Native Gemini protocol | <Badge type="warning" text="Planned" /> |

## Errors

- No provider configured → `YANSHI_PROVIDER_001` (opens Settings).
- Test failed → `YANSHI_PROVIDER_002`.
- Save failed → `YANSHI_PROVIDER_003`.

The config modal shows a concise status badge plus a muted detail line; there is no large red
error paragraph in normal mode. See the [Error Catalog](/reference/error-catalog).

## Key safety

The API key is write-only from the UI's perspective — see [Provider Secrets](/integrations/secrets).
