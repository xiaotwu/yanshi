from .anthropic import AnthropicProvider
from .base import Provider
from .openai_compatible import OpenAICompatibleProvider, ProviderCallError, ProviderConfig


def build_provider(config: ProviderConfig | None) -> Provider:
    if config is not None and config.provider_type == "anthropic":
        return AnthropicProvider(config)
    return OpenAICompatibleProvider(config)


__all__ = ["AnthropicProvider", "OpenAICompatibleProvider", "Provider", "ProviderCallError", "ProviderConfig", "build_provider"]
