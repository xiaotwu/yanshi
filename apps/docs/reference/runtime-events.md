# Runtime Events

Yanshi's UI is driven by a real-time **event stream** from the runtime. Events are the source of
truth for the transcript, the Progress panel, and the Atelier.

## Transport

- The UI hydrates over **REST**, then subscribes to a **WebSocket** event stream.
- If the WebSocket drops, the client falls back to **HTTP polling** (`GET /events?after=`) with
  backoff, and keeps retrying.
- Status lifecycle: `connecting` → `connected` → `reconnecting` / `polling` → `unavailable`. The
  `unavailable` transition raises `YANSHI_RUNTIME_002` once and clears on recovery.

## Event model

Every step is an explicit **action** that yields an **observation** — the
[action/observation model](/concepts/runtime). Representative event types include run lifecycle
(`run.started`, `run.completed`, `run.failed`), agent task updates, tool actions and observations,
`approval.requested`, and artifact/file outputs.

## Where events surface

- **Conversation view** — Yanshi message blocks built from real observations, plan and approval
  cards, output file cards.
- **Progress panel** — status, plan, agent queue, and generated Files.
- **Atelier** — worker poses reflect live status (precedence: task state > approval >
  blocked/failed > celebrating > life > idle).
- **Developer Mode** — the raw event feed and runtime stream status.

Honest tool blockers (missing Chromium, macOS permissions, Docker) ride on observation events and
surface as coded toasts.
