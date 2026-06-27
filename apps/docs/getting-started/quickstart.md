# Quickstart

## 1. Install Dependencies

```bash
pnpm install
```

## 2. Run The App

```bash
pnpm runtime:dev
pnpm desktop:dev
```

## 3. Configure A Provider

Open Settings and configure an OpenAI-compatible provider with a base URL, model, and API key.
Yanshi stores the key outside the main SQLite database and does not return it through settings
APIs.

## 4. Start A Chat

Create a new chat, describe the task, and approve risky actions when prompted.

## 5. Build A Local Package

```bash
pnpm desktop:release
```

See [Build and Release](/build-and-release) for verification and public release requirements.
