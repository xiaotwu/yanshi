---
name: yanshi-runtime-langgraph-builder
description: Use this skill for Python Yanshi Runtime, LangGraph orchestration, graph state, checkpointing, REST/WebSocket server, and event streaming.
---

# Yanshi Runtime LangGraph Builder

Yanshi Runtime uses:

- LangGraph orchestration
- Action / Observation model
- Tool providers
- Sandbox
- Approvals
- Event streaming
- SQLite checkpointing

Core graph:
User Task → Manager Node → Agent Router → Agent Nodes → Tool Executor → Reviewer / Permission → Observation → Artifact → Finalizer

Use mixed graph:
- fixed core graph
- dynamic agent/tool/subgraph activation

Expose:
- REST API
- WebSocket events
- health status
- run creation
- run pause/resume/cancel
- approval resume
- developer trace
