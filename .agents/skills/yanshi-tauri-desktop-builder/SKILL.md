---
name: yanshi-tauri-desktop-builder
description: Use this skill for Tauri, macOS app shell, sidecar startup, menubar, notifications, shortcuts, windows, and native permissions.
---

# Yanshi Tauri Desktop Builder

Build Yanshi as a macOS-first Tauri app.

Tauri responsibilities:
- launch and stop Python Yanshi Runtime sidecar
- manage windows
- menubar
- notifications
- global shortcuts
- macOS permission bridge
- Computer Use bridge
- paths and user data directories

The desktop app must start cleanly and show the main UI immediately.

Runtime failure should show repair actions:
- Restart Runtime
- Open Logs
- Check Python Environment
- Reinstall Runtime Components

If active runs exist on close:
- Pause and quit
- Keep running in background
- Cancel
