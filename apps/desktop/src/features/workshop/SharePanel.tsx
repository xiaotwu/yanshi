import { WorkshopExport, WorkshopInstalled } from "../workshop";

/**
 * SharePanel — combines the import drop-zone/pack list (WorkshopInstalled)
 * and the export action (WorkshopExport) into a single togglable panel.
 * No enable/disable/remove controls — pack installs are one-shot at import time.
 */
export function SharePanel() {
  return (
    <div className="ws-share-panel" role="region">
      <WorkshopInstalled />
      <WorkshopExport />
    </div>
  );
}
