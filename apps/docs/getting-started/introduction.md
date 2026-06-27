# Introduction

**Yanshi** is a macOS-first AI agent workspace. It combines a desktop chat interface, project
organization, real tool execution, approvals, persistent files, and animated workers in the
Yanshi Atelier.

The app is local-first: the Tauri desktop shell launches a bundled Python runtime sidecar, and the
frontend connects to it through local REST and WebSocket APIs.

## What It Does

- Creates standalone or project-scoped chats.
- Runs work through the Yanshi Runtime.
- Uses real tools when they are configured and permitted.
- Pauses for approval before risky actions.
- Persists chats, projects, settings, files, and runtime events.
- Shows worker state in the Yanshi Atelier without pretending progress happened.

## What To Read Next

- [Installation](/getting-started/installation)
- [Quickstart](/getting-started/quickstart)
- [Usage](/usage)
- [Important Notes](/important-notes)
