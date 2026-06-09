import { useState } from "react";

import iconUrl from "../../../../icon.png";
import { hideMainWindow, quitApp } from "../api/desktop";
import { useRuntimeStore } from "../stores/runtimeStore";

export function CloseRunsModal({ count, onClose }: { count: number; onClose: () => void }) {
  const { pauseAllRuns } = useRuntimeStore();
  const [busy, setBusy] = useState(false);

  const pauseAndQuit = async () => {
    setBusy(true);
    await pauseAllRuns();
    await quitApp();
  };

  return (
    <div className="modal-overlay">
      <div className="onboarding-card">
        <h2>Quit Yanshi?</h2>
        <p>
          {count} task{count === 1 ? " is" : "s are"} still running.
        </p>
        <div className="onboarding-actions" style={{ flexWrap: "wrap", justifyContent: "center" }}>
          <button className="primary" onClick={() => void pauseAndQuit()} disabled={busy}>
            Pause and quit
          </button>
          <button onClick={() => { void hideMainWindow(); onClose(); }} disabled={busy}>
            Keep running
          </button>
          <button onClick={onClose} disabled={busy}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// Presentational only. App owns the (non-blocking) demo + dismiss logic so a slow/unreachable
// runtime can never freeze this modal.
export function Onboarding({ onTryDemo, onDismiss }: { onTryDemo: () => void; onDismiss: () => void }) {
  return (
    <div className="modal-overlay" onMouseDown={onDismiss}>
      <div className="onboarding-card" onMouseDown={(event) => event.stopPropagation()}>
        <img src={iconUrl} alt="" />
        <h2>Welcome to Yanshi</h2>
        <p>Give a task in plain words. Virtual workers plan, act, and show their progress.</p>
        <div className="onboarding-actions">
          <button className="primary" onClick={onTryDemo}>
            Try a demo
          </button>
          <button onClick={onDismiss}>Not now</button>
        </div>
      </div>
    </div>
  );
}
