import { RotateCcw, X } from "lucide-react";
import { useEffect, useState } from "react";

import appIconUrl from "../../../../icon.png";
import { openDesktopRuntimeLogs } from "../api/desktop";
import { releaseWebglContext } from "../components/error-boundary";
import { Modal } from "../components/modal";
import { Switch } from "../components/switch";
import { useT } from "../i18n";
import type { TKey } from "../i18n/en";
import { ACCENTS, getAccent, setAccent } from "../lib/accent";
import { permissionLabel } from "../lib/shared";
import type { PermissionMode } from "../lib/shared";
import { useRuntimeStore } from "../stores/runtimeStore";
import { ExternalAgentsSection, McpServersSection, ProvidersSection, SkillsSection } from "./ai-integrations";
import { GpuSettingRow, ShortcutsSettings } from "./shortcuts-settings";

/** Accent color swatch picker (client-side preference applied via a root data-accent attribute). */
function AccentRow() {
  const { t } = useT();
  const [accent, setAccentState] = useState(getAccent());
  return (
    <div className="setting-row">
      <span>{t("settings.appearance.accent")}</span>
      <div className="accent-swatches">
        {ACCENTS.map((preset) => (
          <button
            key={preset.id}
            className={accent === preset.id ? "accent-swatch active" : "accent-swatch"}
            style={{ background: preset.color }}
            onClick={() => { setAccent(preset.id); setAccentState(preset.id); }}
            aria-label={t(preset.labelKey)}
            aria-pressed={accent === preset.id}
            title={t(preset.labelKey)}
          />
        ))}
      </div>
    </div>
  );
}

export type SettingsSection =
  | "profile"
  | "appearance"
  | "general"
  | "atelier"
  | "agents"
  | "mcp"
  | "skills"
  | "providers"
  | "permissions"
  | "shortcuts"
  | "notifications"
  | "performance"
  | "runtime"
  | "sandbox"
  | "database";

/** Real WebGL probe for Developer Mode — availability + unmasked renderer when the browser exposes it.
 *  The probe context is released immediately (WKWebView caps live contexts; leaks break the Atelier). */
function webglInfo(): { available: boolean; renderer: string } {
  try {
    const canvas = document.createElement("canvas");
    const gl = (canvas.getContext("webgl2") ?? canvas.getContext("webgl")) as WebGLRenderingContext | null;
    if (!gl) return { available: false, renderer: "—" };
    const debug = gl.getExtension("WEBGL_debug_renderer_info");
    const renderer = debug ? String(gl.getParameter(debug.UNMASKED_RENDERER_WEBGL)) : "(masked by browser)";
    releaseWebglContext(gl);
    return { available: true, renderer };
  } catch {
    return { available: false, renderer: "—" };
  }
}

/** Settings as a centered floating window (like Search), with grouped left nav. */
export function SettingsModal({ initialSection = "general", onClose }: { initialSection?: SettingsSection; onClose: () => void }) {
  const { t } = useT();
  const { appSettings } = useRuntimeStore();
  const developer = appSettings?.developerMode ?? false;
  const [section, setSection] = useState<SettingsSection>(initialSection);

  useEffect(() => setSection(initialSection), [initialSection]);

  // Claude-style IA: Personal / Workspace / AI / Tools / System (+ Developer). No About.
  const groups: Array<{ labelKey: TKey; items: Array<{ id: SettingsSection; key: TKey }> }> = [
    {
      labelKey: "settings.group.personal",
      items: [
        { id: "profile", key: "settings.section.profile" },
        { id: "appearance", key: "settings.section.appearance" },
      ],
    },
    {
      labelKey: "settings.group.workspace",
      items: [
        { id: "general", key: "settings.section.general" },
        { id: "atelier", key: "settings.section.atelier" },
      ],
    },
    {
      labelKey: "settings.group.ai",
      items: [
        { id: "providers", key: "integrations.providers.title" },
        { id: "agents", key: "integrations.agents.title" },
        { id: "mcp", key: "integrations.mcp.title" },
        { id: "skills", key: "integrations.skills.title" },
      ],
    },
    {
      labelKey: "settings.group.tools",
      items: [{ id: "permissions", key: "settings.section.permissions" }],
    },
    {
      labelKey: "settings.group.system",
      items: [
        { id: "shortcuts", key: "settings.section.shortcuts" },
        { id: "notifications", key: "settings.section.notifications" },
        { id: "performance", key: "settings.section.performance" },
      ],
    },
  ];
  if (developer) {
    groups.push({
      labelKey: "settings.group.developer",
      items: [
        { id: "runtime", key: "settings.section.runtime" },
        { id: "sandbox", key: "settings.section.sandbox" },
        { id: "database", key: "settings.section.database" },
      ],
    });
  }

  const allIds = groups.flatMap((g) => g.items.map((i) => i.id));
  const active = allIds.includes(section) ? section : "general";

  return (
    <Modal onClose={onClose} size="xl" className="settings-modal" labelledBy="settings-title">
      <button className="icon-button ghost settings-close" onClick={onClose} aria-label={t("common.close")} title={t("common.close")}>
        <X size={16} />
      </button>
      <section className="settings-layout">
        <div className="settings-nav-col">
          {/* The title stays fixed; only the nav list below it scrolls. */}
          <h2 id="settings-title" className="settings-title">{t("account.settings")}</h2>
          <nav className="settings-nav" aria-label={t("account.settings")}>
            {groups.map((group) => (
              <div key={group.labelKey}>
                <div className="settings-nav-label">{t(group.labelKey)}</div>
                {group.items.map((item) => (
                  <button key={item.id} className={active === item.id ? "active" : ""} onClick={() => setSection(item.id)}>
                    {t(item.key)}
                  </button>
                ))}
              </div>
            ))}
          </nav>
        </div>
        <div className="settings-content" key={active}>
          <SettingsSectionView section={active} />
        </div>
      </section>
    </Modal>
  );
}

const AVATAR_EMOJI = ["🤖", "🦊", "🐼", "🦉", "🐳", "🌿", "⚡", "🎨"];
const AVATAR_BACKGROUNDS = ["#1f6f4a", "#2f5d8a", "#7a4a8f", "#a85f2a", "#8a2f3e", "#3d3d46"];

/** Shared avatar rendering — used here and in the account block. Emoji on a colored disc, or the
 *  default Yanshi mark. Image upload is intentionally not offered yet (no unvalidated paths). */
export function ProfileAvatar({ size = 28 }: { size?: number }) {
  const profile = useRuntimeStore((state) => state.appSettings?.profile);
  if (profile?.avatarType === "emoji" && profile.avatarValue) {
    return (
      <span
        className="profile-avatar"
        style={{ width: size, height: size, fontSize: size * 0.55, background: profile.avatarBackground ?? AVATAR_BACKGROUNDS[0] }}
        aria-hidden
      >
        {profile.avatarValue}
      </span>
    );
  }
  return <img src={appIconUrl} alt="" className="account-avatar" style={{ width: size, height: size }} />;
}

function ProfileSettings() {
  const { t } = useT();
  const { appSettings, saveAppSettings } = useRuntimeStore();
  if (!appSettings) return null;
  const profile = appSettings.profile;
  // Read the latest profile at call time (not render time) so back-to-back edits never clobber
  // each other; the store also merges optimistically.
  const saveProfile = (patch: Partial<typeof profile>) => {
    const latest = useRuntimeStore.getState().appSettings?.profile ?? profile;
    void saveAppSettings({ profile: { ...latest, ...patch } });
  };

  return (
    <div className="settings-panel">
      <h3>{t("settings.section.profile")}</h3>
      <p className="muted">{t("settings.profile.identityHint")}</p>

      <div className="profile-editor">
        <div className="profile-preview">
          <ProfileAvatar size={56} />
          <strong>{profile.displayName.trim() || t("brand")}</strong>
          {profile.workspaceLabel.trim() && <small className="muted">{profile.workspaceLabel}</small>}
        </div>

        <label className="setting-row">
          <span>{t("settings.profile.displayName")}</span>
          <input
            defaultValue={profile.displayName}
            placeholder={t("settings.profile.displayNamePlaceholder")}
            maxLength={40}
            onBlur={(event) => {
              const value = event.currentTarget.value.trim();
              if (value !== profile.displayName) saveProfile({ displayName: value });
            }}
          />
        </label>
        <label className="setting-row">
          <span>{t("settings.profile.workspaceLabel")}</span>
          <input
            defaultValue={profile.workspaceLabel}
            maxLength={40}
            onBlur={(event) => {
              const value = event.currentTarget.value.trim();
              if (value !== profile.workspaceLabel) saveProfile({ workspaceLabel: value });
            }}
          />
        </label>

        <div className="setting-row column">
          <span>{t("settings.profile.avatar")}</span>
          <div className="avatar-options">
            <button
              className={`avatar-option${profile.avatarType === "preset" ? " selected" : ""}`}
              onClick={() => saveProfile({ avatarType: "preset", avatarValue: "" })}
              title={t("settings.profile.avatarDefault")}
              aria-label={t("settings.profile.avatarDefault")}
            >
              <img src={appIconUrl} alt="" className="account-avatar" style={{ width: 26, height: 26 }} />
            </button>
            {AVATAR_EMOJI.map((emoji) => (
              <button
                key={emoji}
                className={`avatar-option${profile.avatarType === "emoji" && profile.avatarValue === emoji ? " selected" : ""}`}
                style={{ background: profile.avatarBackground ?? AVATAR_BACKGROUNDS[0] }}
                onClick={() => saveProfile({ avatarType: "emoji", avatarValue: emoji, avatarBackground: profile.avatarBackground ?? AVATAR_BACKGROUNDS[0] })}
                aria-label={emoji}
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>

        {profile.avatarType === "emoji" && (
          <div className="setting-row column">
            <span>{t("settings.profile.background")}</span>
            <div className="avatar-options">
              {AVATAR_BACKGROUNDS.map((color) => (
                <button
                  key={color}
                  className={`avatar-option swatch${(profile.avatarBackground ?? AVATAR_BACKGROUNDS[0]) === color ? " selected" : ""}`}
                  style={{ background: color }}
                  onClick={() => saveProfile({ avatarBackground: color })}
                  aria-label={color}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function SettingsSectionView({ section }: { section: SettingsSection }) {
  const { t } = useT();
  const {
    status,
    desktopStatus,
    eventStreamStatus,
    restartRuntime,
    refreshMacosPermissions,
    saveAppSettings,
    loading,
    appSettings,
    macosPermissions,
  } = useRuntimeStore();

  if (!appSettings) return <p className="muted">{t("common.loading")}</p>;

  const toggle = (key: keyof typeof appSettings, label: string, hint?: string) => (
    <label className="setting-row">
      <span>
        {label}
        {hint && <small>{hint}</small>}
      </span>
      <Switch checked={Boolean(appSettings[key])} onChange={(value) => void saveAppSettings({ [key]: value })} ariaLabel={label} />
    </label>
  );

  switch (section) {
    case "general":
      return (
        <div className="settings-panel">
          <h3>{t("settings.section.general")}</h3>
          <label className="setting-row">
            <span>{t("settings.general.defaultPermission")}</span>
            <select
              value={appSettings.permissionModeDefault}
              onChange={(event) => void saveAppSettings({ permissionModeDefault: event.target.value as PermissionMode })}
            >
              <option value="default">{t("permission.default")}</option>
              <option value="auto_review">{t("permission.auto_review")}</option>
              <option value="full_access">{t("permission.full_access")}</option>
            </select>
          </label>
          {toggle("developerMode", t("settings.general.developerMode"), t("settings.general.developerModeHint"))}
        </div>
      );
    case "appearance":
      return (
        <div className="settings-panel">
          <h3>{t("settings.section.appearance")}</h3>
          <label className="setting-row">
            <span>{t("settings.appearance.theme")}</span>
            <select value={appSettings.theme} onChange={(event) => void saveAppSettings({ theme: event.target.value as "light" | "dark" | "system" })}>
              <option value="system">{t("settings.appearance.themeSystem")}</option>
              <option value="light">{t("settings.appearance.themeLight")}</option>
              <option value="dark">{t("settings.appearance.themeDark")}</option>
            </select>
          </label>
          <label className="setting-row">
            <span>{t("settings.appearance.language")}</span>
            <select value={appSettings.language} onChange={(event) => void saveAppSettings({ language: event.target.value as "system" | "en-US" | "zh-CN" })}>
              <option value="system">{t("settings.appearance.languageSystem")}</option>
              <option value="en-US">English</option>
              <option value="zh-CN">简体中文</option>
            </select>
          </label>
          <AccentRow />
        </div>
      );
    case "shortcuts":
      return <ShortcutsSettings />;
    // (AccentRow defined below)
    case "profile":
      return <ProfileSettings />;
    case "atelier":
      return (
        <div className="settings-panel">
          <h3>{t("settings.section.atelier")}</h3>
          {toggle("liveOfficeAutoOpen", t("settings.personalization.atelierAutoOpen"))}
          {toggle("liveOfficeDefaultOpen", t("settings.personalization.atelierDefaultOpen"))}
        </div>
      );
    case "notifications":
      return (
        <div className="settings-panel">
          <h3>{t("settings.section.notifications")}</h3>
          {toggle("notificationsEnabled", t("settings.personalization.notifications"))}
        </div>
      );
    case "performance":
      return (
        <div className="settings-panel">
          <h3>{t("settings.section.performance")}</h3>
          <GpuSettingRow />
        </div>
      );
    case "agents":
      return <ExternalAgentsSection />;
    case "mcp":
      return <McpServersSection />;
    case "skills":
      return <SkillsSection />;
    case "providers":
      return <ProvidersSection />;
    case "permissions":
      return (
        <div className="settings-panel">
          <h3>{t("settings.section.permissions")}</h3>
          <p className="muted">{t("settings.permissions.intro")}</p>
          {toggle("browserToolEnabled", t("settings.permissions.browser"))}
          {toggle("computerToolEnabled", t("settings.permissions.computer"))}
          {toggle("terminalToolEnabled", t("settings.permissions.terminal"))}
          {macosPermissions ? (
            <>
              <div className="setting-row">
                <span>{t("settings.permissions.accessibility")}</span>
                <span className={`status-badge ${macosPermissions.accessibility === "granted" ? "configured" : "not_configured"}`}>
                  {permissionLabel(macosPermissions.accessibility)}
                </span>
              </div>
              <div className="setting-row">
                <span>{t("settings.permissions.screen")}</span>
                <span className={`status-badge ${macosPermissions.screenRecording === "granted" ? "configured" : "not_configured"}`}>
                  {permissionLabel(macosPermissions.screenRecording)}
                </span>
              </div>
            </>
          ) : (
            // Honest state: never silently hide system permission status. Without the desktop
            // bridge (web/dev, or a failed bridge call) there is nothing real to show — say so.
            <div className="setting-row">
              <span>
                {t("settings.permissions.system")}
                <small>{t("settings.permissions.bridgeUnavailableHint")}</small>
              </span>
              <span className="status-badge not_configured">{t("settings.permissions.bridgeUnavailable")}</span>
            </div>
          )}
          <div className="settings-actions">
            <button
              className="icon-action"
              onClick={() => void refreshMacosPermissions()}
              disabled={loading}
              title={t("common.refresh")}
              aria-label={t("common.refresh")}
            >
              <RotateCcw size={15} />
            </button>
          </div>
        </div>
      );
    case "runtime": {
      const gl = webglInfo();
      return (
        <div className="settings-panel">
          <h3>{t("settings.section.runtime")}</h3>
          <p className="muted">{desktopStatus?.detail ?? status?.details ?? t("common.loading")}</p>
          <dl className="runtime-details">
            <dt>{t("settings.runtime.mode")}</dt>
            <dd>{desktopStatus?.launchMode ?? "—"}</dd>
            <dt>{t("settings.runtime.url")}</dt>
            <dd>{desktopStatus?.runtimeUrl ?? "—"}</dd>
            <dt>{t("settings.runtime.log")}</dt>
            <dd>{desktopStatus?.logPath ?? t("common.notAvailable")}</dd>
            <dt>{t("settings.runtime.missing")}</dt>
            <dd>{desktopStatus?.missingRequirements.length ? desktopStatus.missingRequirements.join(", ") : t("common.none")}</dd>
            <dt>{t("settings.runtime.eventStream")}</dt>
            <dd>{t(`stream.${eventStreamStatus}` as TKey)}</dd>
            <dt>WebGL</dt>
            <dd>{gl.available ? `${t("settings.runtime.webglAvailable")} · ${gl.renderer}` : t("common.notAvailable")}</dd>
          </dl>
          <div className="settings-actions">
            <button onClick={() => void restartRuntime()} disabled={loading}>
              {t("settings.runtime.restart")}
            </button>
            <button onClick={() => void openDesktopRuntimeLogs()} disabled={!desktopStatus?.logPath}>
              {t("settings.runtime.logs")}
            </button>
          </div>
        </div>
      );
    }
    case "sandbox":
      return (
        <div className="settings-panel">
          <h3>{t("settings.section.sandbox")}</h3>
          <div className="settings-form split">
            <label>
              {t("settings.sandbox.image")}
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
              {t("settings.sandbox.memory")}
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
              {t("settings.sandbox.cpus")}
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
              {t("settings.sandbox.pids")}
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
          <h3>{t("settings.section.database")}</h3>
          <dl className="runtime-details">
            <dt>{t("settings.database.health")}</dt>
            <dd>{status?.status ?? "—"}</dd>
            <dt>{t("settings.database.runtimeUrl")}</dt>
            <dd>{desktopStatus?.runtimeUrl ?? "—"}</dd>
          </dl>
        </div>
      );
    default:
      return null;
  }
}
