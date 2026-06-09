import { Loader2 } from "lucide-react";
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

export function Onboarding({ onStart }: { onStart: () => void }) {
  const { saveAppSettings, createRun } = useRuntimeStore();
  const [busy, setBusy] = useState(false);

  const dismiss = () => void saveAppSettings({ onboarded: true });
  const tryDemo = async () => {
    setBusy(true);
    await saveAppSettings({ onboarded: true });
    await createRun("List workspace files", "default", null);
    setBusy(false);
    onStart();
  };

  return (
    <div className="modal-overlay">
      <div className="onboarding-card">
        <img src={iconUrl} alt="" />
        <h2>Welcome to Yanshi</h2>
        <p>Give a task in plain words. Virtual workers plan, act, and show their progress.</p>
        <div className="onboarding-actions">
          <button className="primary" onClick={() => void tryDemo()} disabled={busy}>
            {busy ? <Loader2 className="spin" size={16} /> : "Try a demo"}
          </button>
          <button onClick={dismiss} disabled={busy}>
            Not now
          </button>
        </div>
      </div>
    </div>
  );
}
