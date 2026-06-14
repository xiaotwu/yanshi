import { X } from "lucide-react";

import { openDesktopRuntimeLogs } from "../api/desktop";
import type { SettingsSection } from "../features/settings";
import { useT } from "../i18n";
import { resolveError, useErrorToasts } from "../lib/errors";

/**
 * App-wide error toasts (bottom-right): error code + short localized reason, ~8s auto-dismiss,
 * manual dismiss, clean stacking, optional action (Open Settings / Open logs). Accessible:
 * assertive live region, role="alert" per toast, labeled dismiss, Escape dismisses the focused
 * toast, and the code chip means color is never the only indicator.
 */
export function ErrorToasts({ onOpenSettings }: { onOpenSettings: (section: SettingsSection) => void }) {
  const { t } = useT();
  const toasts = useErrorToasts((state) => state.toasts);
  const dismiss = useErrorToasts((state) => state.dismiss);

  if (toasts.length === 0) return null;

  return (
    <div className="error-toasts" aria-live="assertive" aria-label={t("error.label")}>
      {toasts.map((toast) => {
        const definition = resolveError(toast.code);
        return (
          <div
            key={toast.id}
            className="error-toast"
            role="alert"
            tabIndex={0}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.stopPropagation();
                dismiss(toast.id);
              }
            }}
          >
            <div className="error-toast-body">
              <span className="error-toast-code">{definition.code}</span>
              <strong>{t(definition.titleKey)}</strong>
              <p>{t(definition.reasonKey)}</p>
              {definition.action === "settings" && (
                <button
                  className="error-toast-action"
                  onClick={() => {
                    onOpenSettings((definition.settingsSection ?? "general") as SettingsSection);
                    dismiss(toast.id);
                  }}
                >
                  {t("error.openSettings")}
                </button>
              )}
              {definition.action === "logs" && (
                <button
                  className="error-toast-action"
                  onClick={() => {
                    void openDesktopRuntimeLogs();
                    dismiss(toast.id);
                  }}
                >
                  {t("error.openLogs")}
                </button>
              )}
            </div>
            <button className="error-toast-dismiss" onClick={() => dismiss(toast.id)} aria-label={t("error.dismiss")} title={t("error.dismiss")}>
              <X size={14} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
