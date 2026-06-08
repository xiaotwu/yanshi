---
name: yanshi-live-office-3d-builder
description: Use this skill for React Three Fiber, 2.5D/3D Live Office, Agent actors, animation state, Office View, pop-out windows, and event-to-animation mapping.
---

# Yanshi Live Office 3D Builder

Use:
- React Three Fiber
- three.js
- @react-three/drei
- Zustand-derived LiveOfficeState

Do not make 3D required for core operation.

Forms:
- Mini Live Office
- Full Office View
- Pop-out Office Window
- Always-on-top Office Window

3D reads LiveOfficeState, not raw runtime events.

Event flow:
Yanshi Runtime events → frontend reducer → LiveOfficeState → LiveOffice3D

Default office:
- modern office
- light Yanshi workshop elements
- Q-style mechanical workers
- 5 core Agent actors
