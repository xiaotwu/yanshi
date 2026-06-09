import { useEffect, useState } from "react";

import { openDesktopRuntimeLogs } from "../api/desktop";
import { permissionLabel } from "../lib/shared";
import type { PermissionMode } from "../lib/shared";
import { useRuntimeStore } from "../stores/runtimeStore";

export type SettingsSection = "general" | "models" | "permissions" | "live-office" | "workshop" | "notifications" | "about" | "runtime" | "sandbox" | "database";

export function SettingsView() {
  const store = useRuntimeStore();
  const { appSettings } = store;
  const developer = appSettings?.developerMode ?? false;
  const [section, setSection] = useState<SettingsSection>("general");

  const normalSections: Array<{ id: SettingsSection; label: string }> = [
    { id: "general", label: "General" },
    { id: "models", label: "Models" },
    { id: "permissions", label: "Permissions" },
    { id: "live-office", label: "Live Office" },
    { id: "workshop", label: "Workshop" },
    { id: "notifications", label: "Notifications" },
    { id: "about", label: "About" },
  ];
  const devSections: Array<{ id: SettingsSection; label: string }> = [
    { id: "runtime", label: "Runtime" },
    { id: "sandbox", label: "Sandbox" },
    { id: "database", label: "Database" },
  ];
  const sections = developer ? [...normalSections, ...devSections] : normalSections;
  const active = sections.some((item) => item.id === section) ? section : "general";

  return (
    <section className="settings-layout">
      <nav className="settings-nav">
        {normalSections.map((item) => (
          <button key={item.id} className={active === item.id ? "active" : ""} onClick={() => setSection(item.id)}>
            {item.label}
          </button>
        ))}
        {developer && <div className="settings-nav-label">Developer</div>}
        {developer &&
          devSections.map((item) => (
            <button key={item.id} className={active === item.id ? "active" : ""} onClick={() => setSection(item.id)}>
              {item.label}
            </button>
          ))}
      </nav>
      <div className="settings-content">
        <SettingsSectionView section={active} />
      </div>
    </section>
  );
}

export function SettingsSectionView({ section }: { section: SettingsSection }) {
  const {
    status,
    desktopStatus,
    providerSettings,
    providerHealth,
    restartRuntime,
    refreshMacosPermissions,
    saveProviderSettings,
    checkProviderHealth,
    saveAppSettings,
    loading,
    appSettings,
    macosPermissions,
    workshopPacks,
  } = useRuntimeStore();
  const [baseUrl, setBaseUrl] = useState(providerSettings?.baseUrl ?? "https://api.openai.com/v1");
  const [model, setModel] = useState(providerSettings?.model ?? "gpt-4o-mini");
  const [apiKey, setApiKey] = useState("");

  useEffect(() => {
    if (providerSettings) {
      setBaseUrl(providerSettings.baseUrl);
      setModel(providerSettings.model ?? "gpt-4o-mini");
    }
  }, [providerSettings]);

  if (!appSettings) return <p className="muted">Loading settings…</p>;

  const toggle = (key: keyof typeof appSettings, label: string, hint?: string) => (
    <label className="setting-row">
      <span>
        {label}
        {hint && <small>{hint}</small>}
      </span>
      <input type="checkbox" checked={Boolean(appSettings[key])} onChange={(event) => void saveAppSettings({ [key]: event.target.checked })} />
    </label>
  );

  switch (section) {
    case "general":
      return (
        <div className="settings-panel">
          <h3>General</h3>
          <label className="setting-row">
            <span>Theme</span>
            <select value={appSettings.theme} onChange={(event) => void saveAppSettings({ theme: event.target.value as "light" | "dark" | "system" })}>
              <option value="system">System</option>
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </select>
          </label>
          <label className="setting-row">
            <span>Default permission</span>
            <select
              value={appSettings.permissionModeDefault}
              onChange={(event) => void saveAppSettings({ permissionModeDefault: event.target.value as PermissionMode })}
            >
              <option value="default">Default</option>
              <option value="auto_review">Auto-review</option>
              <option value="full_access">Full access</option>
            </select>
          </label>
          {toggle("developerMode", "Developer Mode", "Show runtime internals and raw events.")}
        </div>
      );
    case "models":
      return (
        <div className="settings-panel">
          <h3>Models</h3>
          <p className="muted">{status?.missingRequirements.includes("model_provider") ? "Provider not configured." : "Provider configured."}</p>
          <div className="settings-form">
            <label>
              Base URL
              <input value={baseUrl} onChange={(event) => setBaseUrl(event.target.value)} spellCheck={false} />
            </label>
            <label>
              Model
              <input value={model} onChange={(event) => setModel(event.target.value)} spellCheck={false} />
            </label>
            <label>
              API key
              <input
                value={apiKey}
                onChange={(event) => setApiKey(event.target.value)}
                placeholder={providerSettings?.apiKeyConfigured ? "Configured" : "Not configured"}
                type="password"
              />
            </label>
          </div>
          <div className="settings-actions">
            <button
              disabled={loading || !baseUrl.trim() || !model.trim()}
              onClick={() => {
                void saveProviderSettings({ baseUrl: baseUrl.trim(), model: model.trim(), ...(apiKey.trim() ? { apiKey: apiKey.trim() } : {}) });
                setApiKey("");
              }}
            >
              Save
            </button>
            <button disabled={loading} onClick={() => void checkProviderHealth()}>
              Check
            </button>
          </div>
          {providerHealth && <p className={providerHealth.ok ? "status-text ok" : "status-text"}>{providerHealth.detail}</p>}
        </div>
      );
    case "permissions":
      return (
        <div className="settings-panel">
          <h3>Permissions</h3>
          <p className="muted">Allow Yanshi to use these tools during approved tasks.</p>
          {toggle("browserToolEnabled", "Browser")}
          {toggle("computerToolEnabled", "Computer")}
          {toggle("terminalToolEnabled", "Terminal")}
          {macosPermissions && (
            <dl className="runtime-details">
              <dt>Accessibility</dt>
              <dd>{permissionLabel(macosPermissions.accessibility)}</dd>
              <dt>Screen</dt>
              <dd>{permissionLabel(macosPermissions.screenRecording)}</dd>
            </dl>
          )}
          <div className="settings-actions">
            <button onClick={() => void refreshMacosPermissions()} disabled={loading}>
              Refresh
            </button>
          </div>
        </div>
      );
    case "live-office":
      return (
        <div className="settings-panel">
          <h3>Live Office</h3>
          {toggle("liveOfficeAutoOpen", "Auto-open on task start")}
          {toggle("liveOfficeDefaultOpen", "Open by default")}
        </div>
      );
    case "workshop":
      return (
        <div className="settings-panel">
          <h3>Workshop</h3>
          <p className="muted">{workshopPacks.length} pack{workshopPacks.length === 1 ? "" : "s"} installed.</p>
        </div>
      );
    case "notifications":
      return (
        <div className="settings-panel">
          <h3>Notifications</h3>
          {toggle("notificationsEnabled", "Desktop notifications")}
        </div>
      );
    case "about":
      return (
        <div className="settings-panel">
          <h3>About</h3>
          <dl className="runtime-details">
            <dt>Yanshi</dt>
            <dd>0.1.0</dd>
            <dt>Runtime</dt>
            <dd>{desktopStatus?.launchMode ?? "—"}</dd>
            <dt>Status</dt>
            <dd>{status?.details ?? desktopStatus?.detail ?? "—"}</dd>
          </dl>
        </div>
      );
    case "runtime":
      return (
        <div className="settings-panel">
          <h3>Runtime</h3>
          <p className="muted">{desktopStatus?.detail ?? status?.details ?? "Checking runtime…"}</p>
          <dl className="runtime-details">
            <dt>Mode</dt>
            <dd>{desktopStatus?.launchMode ?? "—"}</dd>
            <dt>URL</dt>
            <dd>{desktopStatus?.runtimeUrl ?? "—"}</dd>
            <dt>Log</dt>
            <dd>{desktopStatus?.logPath ?? "Not available"}</dd>
            <dt>Missing</dt>
            <dd>{desktopStatus?.missingRequirements.length ? desktopStatus.missingRequirements.join(", ") : "None"}</dd>
          </dl>
          <div className="settings-actions">
            <button onClick={() => void restartRuntime()} disabled={loading}>
              Restart
            </button>
            <button onClick={() => void openDesktopRuntimeLogs()} disabled={!desktopStatus?.logPath}>
              Logs
            </button>
          </div>
        </div>
      );
    case "sandbox":
      return (
        <div className="settings-panel">
          <h3>Sandbox</h3>
          <div className="settings-form split">
            <label>
              Image
              <input
                defaultValue={appSettings.dockerImage}
                spellCheck={false}
                onBlur={(event) => {
                  const value = event.currentTarget.value.trim();
                  if (value && value !== appSettings.dockerImage) void saveAppSettings({ dockerImage: value });
                }}
              />
            </label>
            <label>
              Memory
              <input
                defaultValue={appSettings.dockerMemory}
                spellCheck={false}
                onBlur={(event) => {
                  const value = event.currentTarget.value.trim();
                  if (value && value !== appSettings.dockerMemory) void saveAppSettings({ dockerMemory: value });
                }}
              />
            </label>
            <label>
              CPUs
              <input
                defaultValue={appSettings.dockerCpus}
                spellCheck={false}
                onBlur={(event) => {
                  const value = event.currentTarget.value.trim();
                  if (value && value !== appSettings.dockerCpus) void saveAppSettings({ dockerCpus: value });
                }}
              />
            </label>
            <label>
              PID limit
              <input
                defaultValue={String(appSettings.dockerPidsLimit)}
                inputMode="numeric"
                onBlur={(event) => {
                  const value = Number(event.currentTarget.value);
                  if (Number.isInteger(value) && value > 0 && value !== appSettings.dockerPidsLimit) void saveAppSettings({ dockerPidsLimit: value });
                }}
              />
            </label>
          </div>
        </div>
      );
    case "database":
      return (
        <div className="settings-panel">
          <h3>Database</h3>
          <dl className="runtime-details">
            <dt>Health</dt>
            <dd>{status?.status ?? "—"}</dd>
            <dt>Runtime URL</dt>
            <dd>{desktopStatus?.runtimeUrl ?? "—"}</dd>
          </dl>
        </div>
      );
    default:
      return null;
  }
}

