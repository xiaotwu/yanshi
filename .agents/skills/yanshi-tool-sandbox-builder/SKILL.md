---
name: yanshi-tool-sandbox-builder
description: Use this skill for Browser, Computer, File, Terminal, Code, Search, Document tools, sandboxing, Docker, workspace folders, and resource locks.
---

# Yanshi Tool Sandbox Builder

All tools execute through Yanshi Runtime.

Tool providers:
- Browser
- Computer
- File
- Terminal
- Code
- Search
- Document

Sandbox:
- Project workspace folder
- Optional Docker sandbox
- Resource locks for parallel runs
- Allowed paths
- Permission boundaries

No frontend direct execution.

Computer Use goes:
Python Runtime → Tauri/Rust permission bridge → macOS action → Observation

High-risk tool calls must pass through Permission Gate.
