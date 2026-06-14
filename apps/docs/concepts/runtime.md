# Yanshi Runtime

The **Yanshi Runtime** is the Python engine behind the app. In the packaged build it runs as a
**bundled sidecar** the desktop shell starts and supervises.

## Architecture

- **LangGraph orchestration** — a multi-agent graph plans, executes, and synthesizes.
- **Action / Observation model** — every step is an explicit action that produces an observation;
  nothing is implied. This is what the Atelier and transcript render.
- **Tools** — File, Browser (Playwright), Computer (screenshot + a token-authenticated localhost
  bridge for click/type/shortcut/open-app), and Terminal/Docker sandbox.
- **SQLite persistence** — projects, runs, actions, observations, approvals, artifacts, workshop
  packs, automations, agent profiles, and office state all persist and survive restart.
- **REST + WebSocket** — the UI hydrates over REST and streams live events over a WebSocket, with
  an HTTP-polling fallback.

## Agents

The core team: **Manager** (plans and synthesizes), **Browser**, **Computer**, **File**, and
**Reviewer**. Developer Mode can enable a **Terminal/Code** agent. Each agent carries an advisory
persona injected into its execution context (prompt-injection-separated).

## Approvals

Risky actions interrupt for approval. The run pauses, an approval appears in the UI, and you
approve or deny before it proceeds — a real interrupt/resume, not a simulation.

## Lifecycle and reliability

The desktop shell owns the sidecar: it adopts a healthy runtime or fails loudly on a port
conflict, and it terminates the sidecar by process group on every quit path — no orphaned
runtime on `:8765`. See [macOS App](/desktop/macos).

## Reasoning levels

Reasoning level (Low / Medium / High / Extra) persists and can be overridden per run; it affects
the Manager's planning depth.
