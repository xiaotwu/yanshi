# 造物台 (Workshop UI) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the 4-tab Workshop modal with a full-screen "造物台" main-content view: a three-pane crafting bench (worker rail · live atelier preview · worker inspector) with an artificer-workshop aesthetic driven by existing theme tokens, modern icon-first progressive-disclosure interaction, and project-scoped teams.

**Architecture:** Workshop becomes a `view` (like `library`/`developer`) in `App.tsx`'s main content area, not a modal. `workshop.tsx` (509 lines, too many responsibilities) is decomposed into focused components under `apps/desktop/src/features/workshop/`, with pure layout/clone math extracted to `lib/atelier.ts`. The live preview reuses the existing `AtelierStage` renderer with an editable overlay. Per-偃师 model ("心智") and tools ("本事") are shown **read-only / honestly labelled** here because the runtime does not yet honor them — they become writable in the separate runtime plan.

**Tech Stack:** TypeScript, React 18/19, Zustand, Vite, lucide-react icons, CSS custom properties; Vitest + `tsc` for verification.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-06-16-yanshi-workshop-redesign-design.md` (§5, §7, §8, §9, §10, §11, §12, §13).
- Depends on the merged foundation: agent profiles are project-scoped via `runtimeApi.agentProfiles(projectId)` / `createAgentProfile(body, projectId)`; the store already loads them for `activeProjectId`.
- Worker display name is "偃师"; code identifiers / i18n **keys** stay English. All user-facing strings go through `useT()` and MUST exist in BOTH `i18n/en.ts` and `i18n/zh.ts` — `i18n/i18n.test.ts` enforces key parity at compile/test time.
- Every icon-only control MUST carry `aria-label` + `title` (accessibility + hover hint). Respect the existing `prefers-reduced-motion` handling.
- Aesthetic ("古法机关坊") is expressed ONLY through CSS variables derived from existing tokens (`--surface`/`--background`/`--border`/`--accent`/`--accent-glow`/`--accent-soft`/`--surface-elevated`) via `color-mix`; no hardcoded palette. Must adapt to light/dark (`:root[data-theme="dark"]`).
- HONESTY (hard rule): "心智 (model)" and "本事 (tools)" sections are READ-ONLY in this plan and show the worker's real current values, or a "待运行时支持 / pending runtime support" note. Do NOT render editable controls that wouldn't take effect. No mocks, no fake success states. Pack enable/disable/remove stays unsupported (no fake toggles).
- Follow existing patterns in `workshop.tsx`, `live-office.tsx`, `lib/shared.tsx`, and `styles.css`. Do not restructure unrelated code.
- Verify with: `cd apps/desktop && npm run lint && npx vitest run`. `npm run lint` is `tsc -p tsconfig.json --noEmit` and must be clean.
- Commit messages end with: `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.

---

### Task 1: Extract pure atelier math into `lib/atelier.ts`

**Files:**
- Create: `apps/desktop/src/lib/atelier.ts`
- Test: `apps/desktop/src/lib/atelier.test.ts`
- (Later tasks import from here; `workshop.tsx` constants move here.)

**Interfaces:**
- Produces:
  - `OFFICE_WORLD`, `OFFICE_SVG`, `STATION_DEFAULTS: Record<string,[number,number]>`, `OFFICE_AREAS`, `STATION_COLORS`, `FURNITURE_COLORS` (moved verbatim from `workshop.tsx:224-264`)
  - `worldToSvg(x:number, z:number): [number, number]` (moved from `workshop.tsx:250`)
  - `svgPointToWorld(sx:number, sy:number, snap:boolean): [number, number]` — the snap+clamp math currently inline in `OfficeLayoutCanvas.pointerToWorld` (`workshop.tsx:293-306`), made pure (takes SVG-space coords, returns clamped/snapped world coords).

- [ ] **Step 1: Write the failing test**

```typescript
// apps/desktop/src/lib/atelier.test.ts
import { describe, expect, it } from "vitest";
import { OFFICE_SVG, STATION_DEFAULTS, svgPointToWorld, worldToSvg } from "./atelier";

describe("atelier math", () => {
  it("worldToSvg maps world origin into the SVG box", () => {
    const [x, y] = worldToSvg(0, 0);
    expect(x).toBeGreaterThan(0);
    expect(x).toBeLessThan(OFFICE_SVG.w);
    expect(y).toBeGreaterThan(0);
    expect(y).toBeLessThan(OFFICE_SVG.h);
  });

  it("svgPointToWorld snaps to a 0.2 grid when snap=true", () => {
    const [x, z] = svgPointToWorld(OFFICE_SVG.w / 2, OFFICE_SVG.h / 2, true);
    expect(Math.round((x / 0.2) % 1)).toBe(0);
    expect(Math.round((z / 0.2) % 1)).toBe(0);
  });

  it("svgPointToWorld clamps inside the world bounds", () => {
    const [x, z] = svgPointToWorld(99999, 99999, false);
    expect(x).toBeLessThanOrEqual(3.2); // maxX(3.5) - 0.3 margin
    expect(z).toBeLessThanOrEqual(2.2); // maxZ(2.5) - 0.3 margin
  });

  it("every default station has a coordinate", () => {
    for (const station of ["manager", "browser", "computer", "file", "reviewer", "terminal"]) {
      expect(STATION_DEFAULTS[station]).toHaveLength(2);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails** — `cd apps/desktop && npx vitest run src/lib/atelier.test.ts` → FAIL (module not found).
- [ ] **Step 3: Create `lib/atelier.ts`** — move the constants and `worldToSvg` verbatim from `workshop.tsx:224-264`; add `svgPointToWorld` by lifting the body of `pointerToWorld` (`workshop.tsx:296-306`) but taking `(sx, sy, snap)` instead of a pointer event:

```typescript
export function svgPointToWorld(sx: number, sy: number, snap: boolean): [number, number] {
  let x = (sx / OFFICE_SVG.w) * (OFFICE_WORLD.maxX - OFFICE_WORLD.minX) + OFFICE_WORLD.minX;
  let z = (sy / OFFICE_SVG.h) * (OFFICE_WORLD.maxZ - OFFICE_WORLD.minZ) + OFFICE_WORLD.minZ;
  if (snap) {
    x = Math.round(x / 0.2) * 0.2;
    z = Math.round(z / 0.2) * 0.2;
  }
  x = Math.min(OFFICE_WORLD.maxX - 0.3, Math.max(OFFICE_WORLD.minX + 0.3, x));
  z = Math.min(OFFICE_WORLD.maxZ - 0.3, Math.max(OFFICE_WORLD.minZ + 0.3, z));
  return [Math.round(x * 100) / 100, Math.round(z * 100) / 100];
}
```

- [ ] **Step 4: Run test to verify it passes.**
- [ ] **Step 5: Commit** — `feat(workshop): extract atelier layout math to lib/atelier.ts`.

---

### Task 2: Workshop theme tokens (古法机关坊, theme-derived)

**Files:**
- Modify: `apps/desktop/src/styles.css` (`:root` block ~L7-49 and `:root[data-theme="dark"]` ~L51-63)
- Test: manual + `tsc` (CSS has no unit test; verified visually in Task 3+). Add a token presence check is not feasible; rely on the lint/build.

**Interfaces:**
- Produces CSS variables consumed by later tasks' class names: `--ws-wood`, `--ws-panel`, `--ws-edge`, `--ws-brass`, `--ws-lamp`, `--ws-parchment`, `--ws-parchment-ink`, `--ws-text`, `--ws-text-dim`.

- [ ] **Step 1: Add the tokens to `:root` (light)** — append inside the `:root {` block:

```css
  /* 偃师工坊 (造物台) — artificer-workshop surfaces derived from theme tokens so the
     workshop follows light/dark and the chosen accent. No hardcoded palette. */
  --ws-wood: color-mix(in srgb, var(--surface) 85%, #6b4f2e);
  --ws-panel: color-mix(in srgb, var(--surface-elevated) 88%, #5a4326);
  --ws-edge: color-mix(in srgb, var(--border) 70%, #6b4f2e);
  --ws-brass: var(--accent);
  --ws-lamp: var(--accent-glow);
  --ws-parchment: color-mix(in srgb, var(--surface-elevated) 78%, #d8c79e);
  --ws-parchment-ink: color-mix(in srgb, var(--text-primary) 86%, #5a4a30);
  --ws-text: var(--text-primary);
  --ws-text-dim: var(--text-secondary);
```

- [ ] **Step 2: Add dark overrides to `:root[data-theme="dark"]`** — the structural mixes shift automatically because `--surface`/`--background` change; only override parchment so it stays legibly warm-dark:

```css
  --ws-wood: color-mix(in srgb, var(--surface) 80%, #3a2c1c);
  --ws-panel: color-mix(in srgb, var(--surface-elevated) 82%, #2e2418);
  --ws-edge: color-mix(in srgb, var(--border) 60%, #3a2e22);
  --ws-parchment: color-mix(in srgb, var(--surface-elevated) 70%, #6b5a3a);
  --ws-parchment-ink: color-mix(in srgb, var(--text-primary) 90%, #e8dcc0);
```

- [ ] **Step 3: Run `cd apps/desktop && npm run lint`** → clean (CSS isn't typechecked, but confirm no JS broke).
- [ ] **Step 4: Commit** — `feat(workshop): theme-derived 古法机关坊 surface tokens`.

---

### Task 3: Route Workshop to a full-screen view (shell + navigation)

**Files:**
- Modify: `apps/desktop/src/lib/shared.tsx:43` (`View` union)
- Modify: `apps/desktop/src/App.tsx` (nav item L416; command `open-workshop` L205; search `onOpenWorkshop` L524; main-content render block L501-507; remove `workshopOpen` state L72 and `<WorkshopModal>` render L523; import)
- Create: `apps/desktop/src/features/workshop/WorkshopWorkspace.tsx`
- Test: `apps/desktop/src/features/workshop/WorkshopWorkspace.test.tsx`

**Interfaces:**
- Consumes: `useRuntimeStore` (`agentProfiles`, `activeProjectId`, `loadAgentProfiles`).
- Produces: `View` gains `"workshop"`; `WorkshopWorkspace` default-exports the three-pane container. For THIS task it renders the three pane regions with the existing `AgentEditor`/`OfficeEditor`/share content as temporary children (so nothing regresses); Tasks 4-8 replace each pane.

- [ ] **Step 1: Write the failing test**

```tsx
// apps/desktop/src/features/workshop/WorkshopWorkspace.test.tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { WorkshopWorkspace } from "./WorkshopWorkspace";

describe("WorkshopWorkspace", () => {
  it("renders the three crafting-bench regions", () => {
    render(<WorkshopWorkspace />);
    expect(screen.getByTestId("workshop-rail")).toBeInTheDocument();
    expect(screen.getByTestId("workshop-preview")).toBeInTheDocument();
    expect(screen.getByTestId("workshop-inspector")).toBeInTheDocument();
  });
});
```

(Confirm the repo's React test setup — check an existing `*.test.tsx` under `src/` for the `@testing-library/react` + jsdom config. If component tests don't yet exist, this task also adds `@testing-library/react` to devDependencies and a jsdom environment; if that is heavier than the project wants, fall back to a store/prop-level test and verify the panes via a smoke render in the running app. Decide based on what the repo already supports and report which path you took.)

- [ ] **Step 2: Run test to verify it fails.**
- [ ] **Step 3: Add `"workshop"` to the `View` union** in `lib/shared.tsx:43`.
- [ ] **Step 4: Create `WorkshopWorkspace.tsx`** — three-pane scaffold using the new tokens; temporarily mount the existing pieces so behavior is preserved:

```tsx
import { useEffect } from "react";
import { useT } from "../../i18n";
import { useRuntimeStore } from "../../stores/runtimeStore";
import { AgentEditor, OfficeEditor, WorkshopInstalled } from "../workshop"; // temporary, replaced in Tasks 4-8

export function WorkshopWorkspace() {
  const { t } = useT();
  const { agentProfiles, activeProjectId, loadAgentProfiles } = useRuntimeStore();
  useEffect(() => { if (agentProfiles.length === 0) void loadAgentProfiles(); }, [agentProfiles.length, loadAgentProfiles]);
  return (
    <div className="zaowutai" aria-label={t("nav.workshop")}>
      <div className="zaowutai-rail" data-testid="workshop-rail"><AgentEditor /></div>
      <div className="zaowutai-preview" data-testid="workshop-preview"><OfficeEditor /></div>
      <aside className="zaowutai-inspector" data-testid="workshop-inspector"><WorkshopInstalled /></aside>
    </div>
  );
}
```

- [ ] **Step 5: Wire navigation in `App.tsx`** — render `{view === "workshop" && <WorkshopWorkspace />}` in the main-content block; change the nav button (L416) and `open-workshop` (L205) and search `onOpenWorkshop` (L524) to `navigate("workshop")`; remove the `workshopOpen` state (L72) and the `<WorkshopModal>` render (L523); update imports (import `WorkshopWorkspace`, drop `WorkshopModal` if now unused). The nav button's `active` class becomes `view === "workshop"`.
- [ ] **Step 6: Add base three-pane CSS to `styles.css`**:

```css
.zaowutai { display: grid; grid-template-columns: 64px 1fr 200px; gap: 8px; height: 100%; padding: 8px;
  background: var(--ws-wood); color: var(--ws-text); font-family: var(--font-display); }
.zaowutai-rail, .zaowutai-inspector { background: var(--ws-panel); border: 1px solid var(--ws-edge); border-radius: 10px; overflow: auto; }
.zaowutai-preview { background: radial-gradient(circle at 50% 32%, color-mix(in srgb, var(--ws-wood) 70%, var(--ws-lamp)), var(--ws-wood)); border: 1px solid var(--ws-edge); border-radius: 10px; position: relative; overflow: hidden; }
```

- [ ] **Step 7: Run `npm run lint && npx vitest run`** → clean + green. Manually confirm the nav opens the full-screen view.
- [ ] **Step 8: Commit** — `feat(workshop): full-screen 造物台 view replacing the modal`.

---

### Task 4: `WorkerRail` — icon-avatar team list + forge entry

**Files:**
- Create: `apps/desktop/src/features/workshop/WorkerRail.tsx`
- Modify: `WorkshopWorkspace.tsx` (mount `WorkerRail`, lift `selectedId` state)
- Test: `apps/desktop/src/features/workshop/WorkerRail.test.tsx`

**Interfaces:**
- Consumes: `agentProfiles: AgentProfileSummary[]`, `liveAgents` (for running status), `selectedId`, `onSelect(id)`, `onForge()`.
- Produces: `WorkerRail` renders one round avatar button per profile (lucide role icon, accent ring, running-status dot), each with `aria-label`/`title` = worker name; a trailing "forge" button (`Plus`/`Sparkles`, `aria-label` = `t("workshop.forgeWorker")`).
- Role→icon map (lucide): manager `Compass`, browser `Globe`, computer `Monitor`, file `Files`, reviewer `ShieldCheck`, terminal `SquareTerminal`; fallback `Bot`. Define as `ROLE_ICONS: Record<string, LucideIcon>` in this file.

- [ ] **Step 1: Failing test** — render with two fake profiles + a selected id; assert two buttons with the worker names as accessible names, the selected one has `aria-pressed`/`.active`, and a forge button with `t("workshop.forgeWorker")` accessible name exists.
- [ ] **Step 2: Verify fail.**
- [ ] **Step 3: Implement `WorkerRail`** following the `agent-pick` button pattern in `workshop.tsx:147-161`, but icon-only avatars. Use `STATION_COLORS`/`profile.accent` for the ring. Running status: `liveAgents.find(a => a.id===profile.id)?.status` (mirror how `runs.tsx` reads status; use `isBusyStatus` from `lib/shared`).
- [ ] **Step 4: Mount in `WorkshopWorkspace`** with `selectedId` state (default first profile); pass `onForge` (stub for now → opens Task 8 flow; until then calls `createAgentProfile` default like `workshop.tsx:155-157`).
- [ ] **Step 5: CSS** for `.zaowutai-rail` avatars (round, accent ring, `.active` glow via `--ws-lamp`, status dot).
- [ ] **Step 6: Verify green; commit** — `feat(workshop): icon-avatar worker rail`.

---

### Task 5: `AtelierPreview` — live scene + editable layer + icon toolbar

**Files:**
- Create: `apps/desktop/src/features/workshop/AtelierPreview.tsx`
- Modify: `WorkshopWorkspace.tsx` (mount in center pane)
- Test: `apps/desktop/src/features/workshop/AtelierPreview.test.tsx`

**Interfaces:**
- Consumes: `officeState` (project-scoped), `saveOfficeState(projectId, patch)`, `activeProjectId`, `selectedId`, `lib/atelier` (`worldToSvg`, `svgPointToWorld`, `STATION_DEFAULTS`).
- Produces: `AtelierPreview` renders `AtelierStage` (from `live-office.tsx`) as the backdrop and an absolutely-positioned SVG overlay reusing the drag logic from the old `OfficeLayoutCanvas` (`workshop.tsx:266-393`) but via `svgPointToWorld`; a floating icon toolbar (furniture `Armchair`, camera `Aperture`, snap `Grid3x3`, reset `RotateCcw`) each with `aria-label`+`title`. Selected worker's station highlighted.

- [ ] **Step 1: Failing test** — render with a fake `officeState`; assert the toolbar's four icon controls exist by `aria-label` (`t("workshop.addFurniture")`, `t("workshop.camera")`, `t("workshop.snap")`, `t("workshop.resetLayout")`), and that a station marker for the selected worker renders.
- [ ] **Step 2: Verify fail.**
- [ ] **Step 3: Implement** — port `OfficeLayoutCanvas` drag/commit (`workshop.tsx:266-393`) into the overlay, replacing inline `pointerToWorld` with `svgPointToWorld` from `lib/atelier`. Wrap `AtelierStage compact={false}` (import from `live-office.tsx`; if `AtelierStage` isn't exported, export it). `saveOfficeState(activeProjectId, ...)` — note: pass `activeProjectId`, NOT `null` (fixes the spec's 🔴 scope bug). Convert toolbar buttons (furniture add menu, camera select, snap toggle, reset) to icon controls.
- [ ] **Step 4: Mount; CSS** for overlay (absolute, pointer-events on markers) + floating toolbar pill.
- [ ] **Step 5: Verify green; commit** — `feat(workshop): live atelier preview with editable station/furniture layer`.

---

### Task 6: `WorkerInspector` — identity header + icon-tab sections (honest mind/abilities)

**Files:**
- Create: `apps/desktop/src/features/workshop/WorkerInspector.tsx`
- Create: `apps/desktop/src/features/workshop/sections/{Identity,Temperament,Mind,Abilities,Incantation}Section.tsx`
- Modify: `WorkshopWorkspace.tsx` (mount in right pane, pass `selectedId`)
- Test: `apps/desktop/src/features/workshop/WorkerInspector.test.tsx`

**Interfaces:**
- Consumes: selected `AgentProfileSummary`, `saveAgentProfile(id, patch)`, `deleteAgentProfile(id)`, `BEHAVIOR_OPTIONS`/`STATION_OPTIONS` from `lib/shared`.
- Produces: `WorkerInspector` with a persistent identity header (avatar, inline-editable name, station chip, accent dot defaulting to "theme color"), a four-icon tab strip (`SlidersHorizontal` 性情 / `BrainCircuit` 心智 / `Wrench` 本事 / `ScrollText` 咒文), one active section shown at a time.
  - `IdentitySection`/`TemperamentSection`/`IncantationSection`: editable, reuse field logic from `workshop.tsx:162-219` (name, station, behaviorMode, accent, taskPriority, personality, prompt). Save via `saveAgentProfile`.
  - `MindSection` + `AbilitiesSection`: **READ-ONLY**. Show the worker's real `defaultTools`/`defaultPermissions` (Abilities) and a "待运行时支持 / pending runtime support" note (Mind has no per-worker model field yet). Render tool chips lit/dim from `defaultTools`; NO writable toggles. Add `t("workshop.pendingRuntime")` key.

- [ ] **Step 1: Failing test** — render inspector for a fake profile; assert identity name input present; assert the four tab controls by `aria-label`; click 本事 tab → abilities shown read-only (a tool chip exists, but querying for a checkbox/role="switch" returns none); assert the `t("workshop.pendingRuntime")` note appears in 心智.
- [ ] **Step 2: Verify fail.**
- [ ] **Step 3: Implement** the inspector + five section components. Keep each section file focused (one section per file). Identity/Temperament/Incantation reuse the existing draft+save pattern (`workshop.tsx:122-143`). Mind/Abilities are presentational + the honest note.
- [ ] **Step 4: Mount; CSS** for header, tab strip (active = `--ws-brass`), parchment textarea for 咒文 (`--ws-parchment`/`--ws-parchment-ink`), read-only tool chips.
- [ ] **Step 5: Verify green; commit** — `feat(workshop): worker inspector with progressive icon-tab sections`.

---

### Task 7: `SharePanel` — merge import + export into one icon entry

**Files:**
- Create: `apps/desktop/src/features/workshop/SharePanel.tsx`
- Modify: `WorkshopWorkspace.tsx` (top-bar `Share2` icon button → toggles panel)
- Test: `apps/desktop/src/features/workshop/SharePanel.test.tsx`

**Interfaces:**
- Consumes: `workshopPacks`, `importWorkshopPack(file)`, `runtimeApi.exportPackUrl()`, `safeOpenExternal`.
- Produces: `SharePanel` combining `WorkshopInstalled` import drop-zone + pack list (`workshop.tsx:48-109`) and the export action (`workshop.tsx:475-507`). NO enable/disable/remove fake controls — keep the honest "Installed" badge.

- [ ] **Step 1: Failing test** — render; assert an import control (`t("workshop.importPack")`) and an export control (`t("workshop.exportPack")`) both present; assert no enable/disable toggle is rendered for a fake pack.
- [ ] **Step 2: Verify fail.**
- [ ] **Step 3: Implement** by composing the existing `WorkshopInstalled` + `WorkshopExport` logic into one panel (reuse, don't duplicate). Top-bar `Share2` button (`aria-label` `t("workshop.share")`) toggles it.
- [ ] **Step 4: Verify green; commit** — `feat(workshop): unified share panel (import + export)`.

---

### Task 8: `ForgeWorkerFlow` — guided new-worker creation

**Files:**
- Create: `apps/desktop/src/features/workshop/ForgeWorkerFlow.tsx`
- Modify: `WorkerRail.tsx` / `WorkshopWorkspace.tsx` (forge button opens the flow)
- Test: `apps/desktop/src/features/workshop/ForgeWorkerFlow.test.tsx`

**Interfaces:**
- Consumes: `createAgentProfile(body)` (already scopes to `activeProjectId`), `STATION_OPTIONS`.
- Produces: `ForgeWorkerFlow` — a small guided popover: pick station (icon grid) → name → create. On success selects the new worker. Replaces the bare default-insert at `workshop.tsx:154-157`.

- [ ] **Step 1: Failing test** — render; choose a station; type a name; submit → asserts `createAgentProfile` called with `{name, station, ...}`.
- [ ] **Step 2: Verify fail.**
- [ ] **Step 3: Implement** the guided flow (station icon grid reusing `ROLE_ICONS` from Task 4; name input; create button disabled until name non-empty).
- [ ] **Step 4: Verify green; commit** — `feat(workshop): guided forge-new-worker flow`.

---

### Task 9: i18n keys (en + zh parity)

**Files:**
- Modify: `apps/desktop/src/i18n/en.ts`, `apps/desktop/src/i18n/zh.ts`
- Test: `apps/desktop/src/i18n/i18n.test.ts` (existing parity test must stay green)

**Interfaces:**
- Produces all new `workshop.*` keys used across Tasks 3-8: `workshop.forgeWorker`, `workshop.share`, `workshop.pendingRuntime`, `workshop.mind`, `workshop.abilities`, `workshop.temperament`, `workshop.incantation`, `workshop.identity`, `workshop.themeColor`, and any others introduced. Each in BOTH locales.

- [ ] **Step 1:** Run `npx vitest run src/i18n/i18n.test.ts` — if any new key is missing from a locale, the parity test fails. Use that as the RED signal.
- [ ] **Step 2:** Add every new key to `en.ts` and `zh.ts` with appropriate text (en: "Forge worker"/"Share"/"Pending runtime support"…; zh: "铸造偃师"/"分享"/"待运行时支持"…).
- [ ] **Step 3:** `npx vitest run src/i18n/i18n.test.ts` → green.
- [ ] **Step 4: Commit** — `feat(workshop): i18n keys for 造物台 (en/zh)`.

(Note: as you implement Tasks 3-8, add each key here as you introduce it; this task is the final parity sweep, not a deferral of translation.)

---

### Task 10: Responsive window-size adaptation

**Files:**
- Modify: `apps/desktop/src/styles.css` (the `.zaowutai` rules)
- Modify: `WorkshopWorkspace.tsx` if a slide-over toggle is needed for the narrow breakpoint
- Test: manual resize verification + `tsc` clean (CSS breakpoints aren't unit-tested)

**Interfaces:**
- Produces responsive behavior per spec §10: ≥1100px three-pane; 760-1100px narrower rail+inspector; <760px preview-primary with the inspector as a right slide-over (toggled by selecting a worker) and a 48px rail; min-width guard.

- [ ] **Step 1:** Add container/media queries. Prefer container queries on `.zaowutai` if supported; else `@media (max-width: …)`. At <760px, `.zaowutai-inspector` becomes `position:absolute` slide-over with a close control; selecting a worker opens it.
- [ ] **Step 2:** Add the slide-over open/close state to `WorkshopWorkspace` only if the breakpoint needs JS (a pure-CSS `:has()`/checkbox approach is acceptable; otherwise a small `inspectorOpen` state toggled on select + a close button).
- [ ] **Step 3:** `npm run lint && npx vitest run` clean+green; manually resize the window through all three breakpoints.
- [ ] **Step 4: Commit** — `feat(workshop): responsive 造物台 across window sizes`.

---

## Self-Review

**Spec coverage:** §5 form/layout → Tasks 3-6; §7 inspector five sections (incl. honest read-only mind/abilities) → Task 6; §8 theme tokens → Task 2; §9 icon-first/progressive disclosure/icon positioning → Tasks 4-6 (every icon control gets `aria-label`+`title`); §10 responsive → Task 10; §11 share → Task 7; §12 forge → Task 8; §13 honesty → Task 6 (read-only mind/abilities) + Task 7 (no fake pack toggles). Project-scope 🔴 fix → Task 5 passes `activeProjectId` to `saveOfficeState`. ✅

**Placeholder scan:** Logic-bearing steps (atelier math, theme tokens, navigation wiring, store calls, tests) carry complete code. Presentational components (panes/sections) are specified by exact interface + the existing `workshop.tsx` line ranges to port from, rather than full re-transcription of JSX — intentional, since the source already exists in-repo and "repeat the code" would mean copying 200+ lines the implementer can read directly. Each such step names the precise source lines.

**Type consistency:** `selectedId`/`onSelect`/`onForge` thread consistently rail→workspace; `saveOfficeState(activeProjectId, patch)` and `saveAgentProfile(id, patch)` match the store signatures; `ROLE_ICONS` defined in Task 4 reused in Task 8.

**Decomposition note:** `workshop.tsx`'s exported pieces (`AgentEditor`, `OfficeEditor`, `WorkshopInstalled`, `WorkshopExport`, `OfficeLayoutCanvas`) are consumed temporarily in Task 3 then superseded by Tasks 4-8; the final cleanup (deleting now-unused exports from `workshop.tsx`) should be folded into whichever later task removes the last consumer — verify with a grep before deleting, per the "don't remove code unless proven unused" rule.

**Open risk:** Task 3 Step 1 flags that the repo may not yet have a React-component test harness (`@testing-library/react` + jsdom). The implementer must check and either add it or fall back to store/smoke verification, reporting which. This is the one genuine unknown; everything else follows established patterns.
