import { useState } from "react";

import iconUrl from "../../../../icon.png";
import { hideMainWindow, quitApp } from "../api/desktop";
import { useT } from "../i18n";
import { useRuntimeStore } from "../stores/runtimeStore";

/** Quit confirmation — shown on every red-close-button press (the app never silently hides).
 *  Quit cancels active chats, then fully terminates the app + bundled sidecar (no orphan,
 *  no menu-bar-only leftover); "Hide to menu bar" is the explicit background option. */
export function CloseRunsModal({ count, onClose }: { count: number; onClose: () => void }) {
  const { t } = useT();
  const { cancelAllRuns } = useRuntimeStore();
  const [busy, setBusy] = useState(false);

  const quit = async () => {
    setBusy(true);
    if (count > 0) await cancelAllRuns();
    await quitApp();
  };

  return (
    <div className="modal-overlay">
      <div className="onboarding-card" role="alertdialog" aria-labelledby="quit-title">
        <h2 id="quit-title">{t("close.title")}</h2>
        <p>{t("close.message")}</p>
        {count > 0 && <p className="quit-warning">{t("close.activeWarning")}</p>}
        <div className="onboarding-actions" style={{ flexWrap: "wrap", justifyContent: "center" }}>
          <button onClick={onClose} disabled={busy}>
            {t("close.cancel")}
          </button>
          <button onClick={() => { void hideMainWindow(); onClose(); }} disabled={busy}>
            {t("close.hide")}
          </button>
          <button className="primary quit-button" onClick={() => void quit()} disabled={busy}>
            {t("close.quit")}
          </button>
        </div>
      </div>
    </div>
  );
}

// Presentational only. App owns the (non-blocking) demo + dismiss logic so a slow/unreachable
// runtime can never freeze this modal.
export function Onboarding({ onTryDemo, onDismiss }: { onTryDemo: () => void; onDismiss: () => void }) {
  const { t } = useT();
  return (
    <div className="modal-overlay" onMouseDown={onDismiss}>
      <div className="onboarding-card" onMouseDown={(event) => event.stopPropagation()}>
        <img src={iconUrl} alt="" />
        <h2>{t("onboarding.welcome")}</h2>
        <p>{t("onboarding.intro")}</p>
        <div className="onboarding-actions">
          <button className="primary" onClick={onTryDemo}>
            {t("onboarding.tryDemo")}
          </button>
          <button onClick={onDismiss}>{t("onboarding.notNow")}</button>
        </div>
      </div>
    </div>
  );
}
