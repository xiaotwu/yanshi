# Yanshi — Final Product Gaps

_Tracks the distance from the current build to the full final-product vision. Updated 2026-06-10._

## ✅ Closed by the UX Architecture Refinement pass (2026-06-10)

- ChatGPT-style Projects (focused page + project composer + "…" modals; light selector).
- Library replaces the technical top-level Runs nav (run records/task details preserved).
- AI Integrations settings: honest ACP/MCP config persistence, Skills aggregation, Zed-style
  provider rows. Centered modal system, viewport-safe popovers, toggle switches, right-click
  context menus, editable shortcuts + in-app conflict detection, GPU effect-tier setting, motion
  polish, i18n for all new surfaces. (Details: docs/UI_INTERACTION_MODEL.md, docs/AI_INTEGRATIONS.md.)

## ✅ Complete (real, no mocks)

- **i18n** — typed translation layer (`src/i18n`), en-US + zh-CN, system-language detection, persisted
  `language` setting (backend `AppSettings.language` + Settings → Appearance selector). zh parity is
  enforced at compile time (`Record<TKey,string>`). Major surfaces translated: titlebar, sidebar,
  composer + `+` menu, search modal, account menu, settings (all sections), Yanshi Atelier, Progress
  panel, onboarding, close prompt, provider catalog, permission/effort labels.
- **Live Office → Yanshi Atelier (偃师工坊)** — user-facing rename across sidebar/titlebar/settings/
  i18n; internal module kept as `live-office` for import stability.
- **Atelier detached** — opens as a floating modal from the titlebar (Sparkles button) with pop-out;
  no longer forced into the right panel.
- **Right Progress panel** — replaces the old right Live Office embed: tabs Progress / Files /
  Artifacts / Approvals / Agents, on real run data (status, plan, agent queue, approvals approve/deny,
  artifact reveal). Concise in normal mode; artifact summaries only in Developer Mode. No flash on
  launch (auto-open gated to fresh `run.started`).
- **Provider multi-adapter settings** — Providers section with the real OpenAI-compatible config
  (base URL / model / key / save / test) plus an honest adapter catalog: OpenAI + OpenAI-Compatible
  = Available; OpenRouter / Ollama / LM Studio / vLLM·SGLang = "Custom endpoint required" (real
  base-URL hints, reachable via the OpenAI-compatible client); Anthropic / Gemini = "Not implemented
  yet"; Custom = "Custom endpoint required". Capability + local/cloud badges. API key stays in the
  secret store (never in SQLite/responses).
- **Asset-ready worker architecture** — `packages/live-office/src/characters.ts`: `characterRegistry`,
  `roleAccessoryMap`, `animationMap`, `lifeAnimationMap`, `resolveCharacter`, `registerCharacterAsset`,
  `usesFallbackProceduralWorker`. GLB paths are null today → procedural Q-style fallback is used;
  future GLB/appearance packs plug in without scene changes.
- **Non-blocking onboarding demo** — opens Atelier + Progress immediately, runs a real file-scan in
  the background; never freezes.

## 🟡 Partial (real, but not the full final vision)

- **i18n coverage** — all normal-mode UI is en-US + zh-CN complete (2026-06-10 polish pass:
  task detail/transcript, Automations, Workshop Agent Editor, Artifacts/Approvals). Remaining
  English by design (documented): Developer raw traces, runtime-produced run content
  (plans/summaries/errors), and agent product names (Manager/Browser/File/…).
- **Providers** — single active provider persisted (OpenAI-compatible). The catalog is honest but
  add/edit/delete of multiple saved providers, per-run `providerId`, and model discovery are not yet
  wired into the runtime.
- **Yanshi Atelier visuals** — procedural Q-style workers with role accents, status glow, life
  animations, behavior modes. Modelled GLB characters + the full task-animation set are future
  (architecture is ready).
- **Projects as agent offices** — project workspace shows runs/files/artifacts/automations/atelier
  state, but the "office" framing (team + atelier + workspace identity) could be stronger.
- **Workshop** — install/enable/disable + Agent/Office editors + export/import are real; an online
  Discover marketplace is intentionally absent (local packs only, honest).

## 🔧 Needs redesign / deeper work (future passes)

- **ACP beyond the foundation** — a real minimal ACP client landed 2026-06-11 (stdio launch +
  initialize handshake + live capability discovery + honest lifecycle); still missing:
  `session/new` + prompt exchange, tool/permission event routing, endpoint (HTTP) transports.
- **MCP runtime client** (server configs persist; no tool discovery yet — honest status).
- Per-action provider routing (preferredActions stores the preference; runtime uses the single
  saved provider config for all chats today).
- First-class skill format (instructions + tool allowlists) via Workshop packs.
- Multi-provider runtime selection (providerId/model per run) end to end.
- Native Anthropic / Gemini adapters (currently "Not implemented yet").
- Animated worker assets (sprite-sheet/Lottie per state, or modelled 3D) + Workshop appearance/
  motion packs. The **Yanshi Puppets v2 identity shipped 2026-06-11**: authored generated-SVG
  chibi art (six roles × six expressions) rendered as standee sprites in the Atelier and reused
  in the 2D fallback (docs/YANSHI_ATELIER_WORKER_DESIGN.md). The `workerCharacterRegistry`
  (`assetType: "svg"`) is ready for richer formats and claims nothing that does not exist.
  Also future: walk cycles + pathfinding, richer life states, per-role working pantomimes.
- Onboarding multi-step flow (language → theme → provider → permissions → demo).

## 🚀 Release-only

- Codesign (Developer ID) + notarization + staple + Gatekeeper verification.
- Interactive packaged pass (Accessibility/Screen-Recording for Computer Use; tray/notifications/
  shortcuts), `playwright install chromium` for real Browser navigation.
