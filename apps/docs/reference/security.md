# Security Model

Yanshi runs locally and is conservative about secrets, network surface, and untrusted input.

## Provider secrets

API keys are stored as an `apiKeyRef` in an off-database secret store (file `0600`, opt-in macOS
Keychain). The raw key is never returned by any API, written to SQLite, logged, or emitted in
events. See [Provider Secrets](/integrations/secrets).

## Computer bridge

Computer Use runs through a localhost bridge bound to a random port with a bearer token:

- The token is **never logged**.
- Requests without a valid token are rejected with `401`.
- This is covered by the packaged-app release checks.

## Agent personas & prompt injection

Agent personas are injected into execution contexts as **advisory** guidance, delimited so that
untrusted content cannot impersonate system instructions (prompt-injection separation).

## Workshop packs

Imported packs are validated; unsafe packs are rejected (`YANSHI_WORKSHOP_002`). Pack import is
the main untrusted-input path and is guarded accordingly.

## Sandboxed tools

The File tool is traversal-safe within the project workspace; Terminal/Docker runs in a sandbox
with configurable image/memory/CPU/PID limits.

## Local network surface

The runtime binds to localhost (`127.0.0.1`). The desktop shell supervises the sidecar and
terminates it on quit, so nothing is left listening.
