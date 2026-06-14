import { RotateCcw, Search, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Switch } from "../components/switch";
import { useT } from "../i18n";
import { reportError } from "../lib/errors";
import type { TKey } from "../i18n/en";
import {
  SHORTCUT_COMMANDS,
  eventToBinding,
  findConflicts,
  formatBinding,
  resolveBindings,
  setShortcutCaptureActive,
  validateBinding,
} from "../lib/shortcuts";
import type { ShortcutCategory } from "../lib/shortcuts";
import { useRuntimeStore } from "../stores/runtimeStore";

const CATEGORY_ORDER: ShortcutCategory[] = ["general", "navigation", "composer", "projects", "atelier", "tools", "developer"];
const CATEGORY_KEY: Record<ShortcutCategory, TKey> = {
  general: "shortcuts.category.general",
  navigation: "shortcuts.category.navigation",
  composer: "shortcuts.category.composer",
  projects: "shortcuts.category.projects",
  atelier: "shortcuts.category.atelier",
  developer: "shortcuts.category.developer",
  tools: "shortcuts.category.tools",
};

/**
 * Keyboard Shortcuts settings: list/edit/clear/reset, search, category grouping. Conflict
 * detection is reliable for in-app commands; conflicts with macOS or other apps cannot be
 * detected reliably and the page says so honestly. The ⌘Y global show/hide shortcut is
 * registered by the OS through Tauri and shown read-only here.
 */
export function ShortcutsSettings() {
  const { t } = useT();
  const { appSettings, saveAppSettings, desktopStatus } = useRuntimeStore();
  const [capturing, setCapturing] = useState<string | null>(null);
  const [pending, setPending] = useState<{ commandId: string; binding: string; conflictsWith: string[] } | null>(null);
  const [filter, setFilter] = useState("");

  const overrides = useMemo(() => appSettings?.shortcuts ?? {}, [appSettings?.shortcuts]);
  const bindings = useMemo(() => resolveBindings(overrides), [overrides]);
  const conflicts = useMemo(() => findConflicts(overrides), [overrides]);

  // Capture the next chord while editing a row. While capturing, app-level shortcut dispatch is
  // suspended (setShortcutCaptureActive) and the captured event is fully swallowed
  // (stopImmediatePropagation), so e.g. capturing Cmd+K can never open Search. A conflicting
  // chord is NOT saved — it becomes a pending state that needs explicit Replace/Cancel.
  useEffect(() => {
    if (!capturing) return;
    setShortcutCaptureActive(true);
    const onKey = (event: KeyboardEvent) => {
      event.preventDefault();
      event.stopImmediatePropagation();
      if (event.key === "Escape") {
        setCapturing(null);
        return;
      }
      const binding = eventToBinding(event);
      if (!binding) return;
      const commandId = capturing;
      setCapturing(null);
      const validation = validateBinding(commandId, binding, overrides);
      if (!validation.ok) {
        reportError("YANSHI_SHORTCUT_001", { commandId, binding, conflictsWith: validation.conflictsWith });
        setPending({ commandId, binding, conflictsWith: validation.conflictsWith });
        return;
      }
      setPending(null);
      void saveAppSettings({ shortcuts: { ...overrides, [commandId]: binding } });
    };
    window.addEventListener("keydown", onKey, { capture: true });
    return () => {
      setShortcutCaptureActive(false);
      window.removeEventListener("keydown", onKey, { capture: true });
    };
  }, [capturing, overrides, saveAppSettings]);

  // Explicit conflict resolution: Replace assigns the chord here and unbinds it from the
  // conflicting commands; Cancel keeps everything as it was. Nothing persists before this choice.
  const resolvePending = (replace: boolean) => {
    if (!pending) return;
    if (replace) {
      const next = { ...overrides, [pending.commandId]: pending.binding };
      for (const other of pending.conflictsWith) next[other] = "";
      void saveAppSettings({ shortcuts: next });
    }
    setPending(null);
  };

  const clear = (commandId: string) => void saveAppSettings({ shortcuts: { ...overrides, [commandId]: "" } });
  const resetAll = () => void saveAppSettings({ shortcuts: {} });

  const labelFor = (commandId: string) => t(`shortcuts.command.${commandId}` as TKey);
  const query = filter.trim().toLowerCase();
  const hasOverrides = Object.keys(overrides).length > 0;

  return (
    <div className="settings-panel wide">
      <h3>{t("shortcuts.title")}</h3>
      <div className="shortcuts-toolbar">
        <div className="library-filter">
          <Search size={14} />
          <input value={filter} onChange={(event) => setFilter(event.target.value)} placeholder={t("shortcuts.filter")} />
        </div>
        <button className="icon-action" onClick={resetAll} disabled={!hasOverrides} title={t("shortcuts.resetAll")} aria-label={t("shortcuts.resetAll")}>
          <RotateCcw size={15} />
        </button>
      </div>
      <p className="muted small">{t("shortcuts.osWarning")}</p>
      {desktopStatus?.missingRequirements.some((item) => item.toLowerCase().includes("shortcut")) && (
        <span className="status-badge not_configured">{t("shortcuts.globalFailed")}</span>
      )}

      {CATEGORY_ORDER.map((category) => {
        const commands = SHORTCUT_COMMANDS.filter(
          (command) => command.category === category && (!query || labelFor(command.id).toLowerCase().includes(query)),
        );
        if (commands.length === 0) return null;
        return (
          <div key={category} className="shortcut-group">
            <div className="settings-nav-label">{t(CATEGORY_KEY[category])}</div>
            {commands.map((command) => {
              const binding = bindings.get(command.id) ?? "";
              const conflict = conflicts.get(command.id);
              const rowPending = pending?.commandId === command.id ? pending : null;
              const overridden = overrides[command.id] !== undefined && overrides[command.id] !== (command.defaultBinding ?? "");
              return (
                <div key={command.id} className={`shortcut-row${conflict || rowPending ? " conflict" : ""}`}>
                  <span className="shortcut-label">{labelFor(command.id)}</span>
                  {rowPending ? (
                    <>
                      <small className="shortcut-conflict">
                        {t("shortcuts.conflictNotSaved", {
                          binding: formatBinding(rowPending.binding),
                          name: rowPending.conflictsWith.map((id) => labelFor(id)).join(", "),
                        })}
                      </small>
                      <button className="shortcut-binding" onClick={() => resolvePending(true)}>
                        {t("shortcuts.replace")}
                      </button>
                      <button className="shortcut-binding" onClick={() => resolvePending(false)}>
                        {t("project.cancel")}
                      </button>
                    </>
                  ) : (
                    conflict && (
                      <small className="shortcut-conflict">
                        {t("shortcuts.conflictWith", { name: conflict.map((id) => labelFor(id)).join(", ") })}
                      </small>
                    )
                  )}
                  <button
                    className={`shortcut-binding${capturing === command.id ? " capturing" : ""}`}
                    onClick={() => {
                      setPending(null);
                      setCapturing(capturing === command.id ? null : command.id);
                    }}
                    title={t("shortcuts.edit")}
                  >
                    {capturing === command.id ? t("shortcuts.pressKeys") : binding ? formatBinding(binding) : t("shortcuts.unbound")}
                  </button>
                  {binding && (
                    <button className="icon-button ghost" title={t("shortcuts.clear")} onClick={() => clear(command.id)}>
                      <X size={13} />
                    </button>
                  )}
                  {overridden && (
                    <button
                      className="icon-button ghost"
                      title={t("shortcuts.reset")}
                      onClick={() => {
                        const next = { ...overrides };
                        delete next[command.id];
                        void saveAppSettings({ shortcuts: next });
                      }}
                    >
                      <RotateCcw size={13} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        );
      })}

      <div className="shortcut-group">
        <div className="settings-nav-label">{t("shortcuts.category.system")}</div>
        <div className="shortcut-row">
          <span className="shortcut-label">{t("shortcuts.command.show-hide")}</span>
          <span className="shortcut-binding readonly">{formatBinding((appSettings?.openYanshiShortcut ?? "Cmd+Y").replace("Cmd", "Meta"))}</span>
          <small className="muted">{t("shortcuts.systemManaged")}</small>
        </div>
      </div>
    </div>
  );
}

/** GPU acceleration toggle (Appearance). Honest copy: this gates the app's visual effect tier and
 *  Atelier render quality — it does not control the OS GPU. */
export function GpuSettingRow() {
  const { t } = useT();
  const { appSettings, saveAppSettings } = useRuntimeStore();
  if (!appSettings) return null;
  return (
    <label className="setting-row">
      <span>
        {t("settings.appearance.gpu")}
        <small>{t("settings.appearance.gpuHint")}</small>
      </span>
      <Switch checked={appSettings.gpuAcceleration} onChange={(value) => void saveAppSettings({ gpuAcceleration: value })} ariaLabel={t("settings.appearance.gpu")} />
    </label>
  );
}
