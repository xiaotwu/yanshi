# Known Limitations

Yanshi is a **v0.1 Local Final Candidate**: feature-complete and real end-to-end for local use,
with automated checks passing. This page is the public status map: available now, setup required,
foundation implemented, planned, or blocked by external requirements.

## Setup required or blocked by external requirements

| Item | Status |
|---|---|
| Public release (codesign + notarization + Gatekeeper) | <Badge type="danger" text="Blocked by Apple Developer ID" /> |
| Browser tool (Chromium provisioning) | <Badge type="warning" text="Setup required" /> |
| Computer Use click/type/shortcut/screenshot | <Badge type="warning" text="Blocked by macOS permission" /> |
| Real model chats | <Badge type="warning" text="Setup required" /> provider API key |

## Foundations (real, but scoped)

| Item | Status |
|---|---|
| ACP external agents — launch + initialize handshake | <Badge type="info" text="Foundation implemented" /> prompt routing planned |
| MCP servers — configuration persistence | <Badge type="info" text="Foundation implemented" /> runtime client planned |
| Worker visuals — authored 2D SVG standees | <Badge type="tip" text="Available now" /> animation/3D planned |

## Planned

- **ACP** prompt routing, tool/permission events, sessions, and HTTP-endpoint transports.
- **MCP** runtime client with real tool discovery.
- **Multi-provider** registry: per-run provider/model selection, model discovery, native
  Anthropic/Gemini adapters, and per-action provider routing.
- **Chat continuation** (follow-up turns on an existing run).
- **Atelier** sprite/Lottie animation, modelled 3D characters, walk cycles + pathfinding, and
  Workshop appearance/motion packs.
- A first-class **skill format** (instructions + tool allowlists).

## What is solid today

The desktop app, bundled runtime, chat-first workflow, projects/library, OpenAI-compatible
providers, the Atelier with real-state workers, the error-toast system, and the security/secret
model are all real and verified. Nothing in the UI claims more than it delivers — see the
[No-Mock Policy](/reference/no-mock).
