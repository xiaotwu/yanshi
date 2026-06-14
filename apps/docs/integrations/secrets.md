# Provider Secrets

Yanshi treats model API keys as write-only secrets.

## How keys are stored

- The provider config stores an **`apiKeyRef`** — a reference, not the key.
- The raw key lives in an **off-database secret store** (a `0600` file by default, with opt-in
  macOS Keychain).
- The key is **never** returned by any API, **never** written to SQLite, and **never** logged or
  emitted in events.

Release checks cover this path: settings, the SQLite database, event streams, and runtime logs
are checked to contain no raw key material.

## In the UI

When you save a provider key, the field shows a "configured" placeholder afterward — the key is
not read back into the form. To change it, type a new one and save again.

## MCP / agent env

Treat MCP and external-agent `env` values like any process environment. Provider keys belong in
the LLM Providers section (the secret store), not in MCP env config.

See the [Security Model](/reference/security) for the full picture, including the Computer bridge
token.
