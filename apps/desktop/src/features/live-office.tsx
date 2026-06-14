// "Yanshi Atelier" — the animated mechanical-worker world. (Internally still the live-office module
// for import stability; all user-facing copy says Yanshi Atelier / 偃师工坊.)
import { AlertTriangle, X } from "lucide-react";
import { lazy, Suspense, useState } from "react";

import { puppetDataUrl, puppetExpression } from "@yanshi/live-office/worker-art";

import { reportError } from "../lib/errors";

import { ErrorBoundary, webglAvailable } from "../components/error-boundary";
import { Modal } from "../components/modal";
import { useT } from "../i18n";
import { useRuntimeStore } from "../stores/runtimeStore";

export const LiveOfficeScene = lazy(() => import("@yanshi/live-office").then((module) => ({ default: module.LiveOfficeScene })));

/** Simplified, 3D-free Atelier: the real worker list (status/queue) without the canvas.
 *  Workers render as small chibi face chips (CSS only) so the 2D layer shares the design
 *  language of the 3D scene without pulling in three.js. */
function AtelierSimplified() {
  const { liveAgents } = useRuntimeStore();
  const { t } = useT();
  const stateKey: Record<string, Parameters<typeof t>[0]> = {
    idle: "atelier.state.idle",
    working: "atelier.state.working",
    waiting_approval: "atelier.state.waitingApproval",
    blocked: "atelier.state.blocked",
    failed: "atelier.state.failed",
    done: "atelier.state.done",
  };
  return (
    <div className="atelier-simplified">
      <div className="agent-rows">
        {liveAgents.map((agent) => (
          <div key={agent.id} className="agent-row">
            {/* The same puppet art as the 3D scene — one identity in every view. */}
            <img
              className="worker-puppet-chip"
              src={puppetDataUrl(agent.station, puppetExpression(agent.status, agent.lifeAction))}
              alt=""
              aria-hidden
            />
            <span className="agent-name">{agent.name}</span>
            <span className="agent-state muted">{agent.currentTask ?? (stateKey[agent.status] ? t(stateKey[agent.status]) : agent.status)}</span>
            {agent.queueCount > 0 && <b>{agent.queueCount}</b>}
          </div>
        ))}
      </div>
    </div>
  );
}

function AtelierFallback({ onRetry, onSimplified }: { onRetry?: () => void; onSimplified: () => void }) {
  const { t } = useT();
  return (
    <div className="atelier-fallback">
      <AlertTriangle size={22} />
      <p>{t("atelier.renderFailed")}</p>
      <div className="atelier-fallback-actions">
        {onRetry && <button onClick={onRetry}>{t("atelier.retry")}</button>}
        <button onClick={onSimplified}>{t("atelier.simplified")}</button>
      </div>
    </div>
  );
}

/**
 * The 3D stage, crash-proofed: a render/WebGL failure can never blank the app — the boundary
 * contains it and shows a fallback (retry / simplified view). When WebGL is unavailable the
 * fallback shows immediately instead of letting the canvas throw.
 */
function AtelierStage({ compact }: { compact: boolean }) {
  const { liveAgents, officeState, appSettings } = useRuntimeStore();
  const { t } = useT();
  const [simplified, setSimplified] = useState(false);

  // Localized worker state text for the in-scene hover cards (the scene package only ships
  // English defaults). Keys mirror runtime statuses and decorative life actions.
  const workerLabels: Record<string, string> = {
    "state.idle": t("atelier.state.idle"),
    "state.working": t("atelier.state.working"),
    "state.waiting_approval": t("atelier.state.waitingApproval"),
    "state.blocked": t("atelier.state.blocked"),
    "state.failed": t("atelier.state.failed"),
    "state.done": t("atelier.state.done"),
    "life.coffee_break": t("atelier.life.coffee"),
    "life.stretching": t("atelier.life.stretching"),
    "life.nap": t("atelier.life.nap"),
    "life.walking_around": t("atelier.life.walking"),
    "life.playing_phone": t("atelier.life.phone"),
    "life.chatting_with_neighbor": t("atelier.life.chatting"),
    queue: t("atelier.queue"),
  };

  if (simplified) return <AtelierSimplified />;
  if (!webglAvailable()) return <AtelierFallback onSimplified={() => setSimplified(true)} />;

  return (
    <ErrorBoundary onError={(error) => reportError("YANSHI_ATELIER_001", error)} fallback={(retry) => <AtelierFallback onRetry={retry} onSimplified={() => setSimplified(true)} />}>
      <Suspense fallback={<div className="scene-loading">{t("atelier.loading")}</div>}>
        <LiveOfficeScene
          agents={liveAgents}
          compact={compact}
          cameraMode={officeState?.cameraMode ?? "rear"}
          stationLayout={officeState?.stationLayout ?? {}}
          furniture={officeState?.furniture ?? []}
          dark={document.documentElement.dataset.theme === "dark"}
          lowPower={appSettings ? !appSettings.gpuAcceleration : false}
          labels={workerLabels}
          debugLabels={appSettings?.developerMode ?? false}
        />
      </Suspense>
    </ErrorBoundary>
  );
}

/** Developer-only diagnostics under the stage (active/approval counts + worker queue chips).
 *  Normal mode keeps the Atelier clean — the same data lives in the Progress panel. */
function AtelierDevMeta() {
  const { liveAgents, approvals } = useRuntimeStore();
  const { t } = useT();
  const active = liveAgents.filter((agent) => agent.status === "working").length;
  return (
    <>
      <div className="office-meta">
        <span>{t("atelier.active", { count: active })}</span>
        <span>{t("atelier.approvals", { count: approvals.length })}</span>
      </div>
      <div className="agent-queue-list">
        {liveAgents.map((agent) => (
          <div key={agent.id} className="agent-queue-pill" title={`${agent.name}: ${agent.status}`}>
            <span>{agent.name}</span>
            {agent.queueCount > 0 && <b>{agent.queueCount}</b>}
          </div>
        ))}
      </div>
    </>
  );
}

/** Floating, detached Atelier window (centered modal), opened from the titlebar. */
export function AtelierModal({ onClose }: { onClose: () => void }) {
  const { t } = useT();
  const developer = useRuntimeStore((state) => state.appSettings?.developerMode ?? false);
  return (
    <Modal onClose={onClose} size="xl" className="atelier-modal" labelledBy="atelier-title">
      <div className="office-toolbar">
        <strong id="atelier-title">{t("atelier.title")}</strong>
        <div>
          <button className="icon-button ghost" aria-label={t("common.close")} title={t("atelier.close")} onClick={onClose}>
            <X size={16} />
          </button>
        </div>
      </div>
      <div className="atelier-modal-stage">
        <AtelierStage compact={false} />
      </div>
      {developer && <AtelierDevMeta />}
    </Modal>
  );
}

/** Standalone pop-out window content (loaded with ?liveOffice=1). */
export function AtelierWindow() {
  return (
    <div className="atelier-window">
      <AtelierStage compact={false} />
    </div>
  );
}
