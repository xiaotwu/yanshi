"""SSRF guards for outbound URLs the runtime fetches on a user's/agent's behalf.

Two callers use this: the model provider (``/models``, ``/chat/completions``) and the browser
tool (Playwright navigation). Both resolve a user/agent-supplied URL, so both can be pointed at
internal services. We resolve the host up front and reject dangerous targets.

Note on the provider: local-model support (Ollama / LM Studio / vLLM on 127.0.0.1 or the LAN) is a
first-class feature, so the provider path intentionally allows loopback/private addresses
(``block_private=False``) — it only blocks cloud metadata endpoints and other unroutable/abuse
ranges. The browser tool has no such requirement and blocks private space by default.

Residual risk: resolution here and the eventual connect are separate, so a DNS-rebinding attacker
could pass this check and then connect to a private address (TOCTOU). Pinning the resolved IP into
the connection is left as a follow-up; this check still raises the bar substantially.
"""

from __future__ import annotations

import ipaddress
import socket
from urllib.parse import urlparse

# Cloud instance-metadata endpoints — never a legitimate target, highest-value SSRF prize.
_METADATA_HOSTS = {"metadata.google.internal", "metadata.goog"}
_METADATA_IPS = {"169.254.169.254", "fd00:ec2::254"}


class BlockedHostError(ValueError):
    """Raised when a URL resolves to a host that outbound requests must not reach."""


def _addr_is_blocked(addr: ipaddress._BaseAddress, *, block_private: bool) -> bool:
    if str(addr) in _METADATA_IPS:
        return True
    # Always unroutable / abuse-prone, regardless of caller.
    if addr.is_unspecified or addr.is_multicast or addr.is_reserved:
        return True
    if block_private and (addr.is_private or addr.is_loopback or addr.is_link_local):
        return True
    # Link-local (169.254/16, fe80::/10) covers the metadata IP and is never a real provider host.
    if addr.is_link_local:
        return True
    return False


def validate_outbound_url(url: str, *, block_private: bool) -> None:
    """Reject non-http(s) schemes and hosts that resolve to dangerous addresses.

    ``block_private`` additionally blocks RFC1918/loopback (used by the browser tool); the provider
    leaves it False so local model servers remain reachable.
    """
    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https"):
        raise BlockedHostError("Only http(s) URLs are allowed.")
    host = parsed.hostname
    if not host:
        raise BlockedHostError("URL is missing a host.")
    if host.lower() in _METADATA_HOSTS:
        raise BlockedHostError(f"Refusing to reach metadata host {host!r}.")
    try:
        infos = socket.getaddrinfo(host, parsed.port or (443 if parsed.scheme == "https" else 80), proto=socket.IPPROTO_TCP)
    except socket.gaierror:
        # Unresolvable: there's nothing internal to reach (the connect will simply fail), so let it
        # through rather than blocking — also avoids false positives in offline/sandboxed runs.
        return
    for info in infos:
        ip_text = info[4][0]
        try:
            addr = ipaddress.ip_address(ip_text)
        except ValueError:
            raise BlockedHostError(f"Host {host!r} resolved to an unparseable address.")
        if _addr_is_blocked(addr, block_private=block_private):
            raise BlockedHostError(f"Refusing to reach blocked address {ip_text} for host {host!r}.")
