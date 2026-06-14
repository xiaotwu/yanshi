import { CircleUser, Keyboard, Settings, Sparkles, UserCircle2 } from "lucide-react";
import { useRef, useState } from "react";

import type { SettingsSection } from "../features/settings";
import { ProfileAvatar } from "../features/settings";
import { useT } from "../i18n";
import { useDismiss, useFloatingPanel } from "../lib/floating";
import { useRuntimeStore } from "../stores/runtimeStore";

export function AccountMenu({ onOpenSettings }: { onOpenSettings: (section: SettingsSection) => void }) {
  const { t } = useT();
  const profile = useRuntimeStore((state) => state.appSettings?.profile);
  const [open, setOpen] = useState(false);
  const blockRef = useRef<HTMLButtonElement>(null);
  // Viewport-safe placement (opens upward from the sidebar footer when there's no room below).
  const { panelRef, panelStyle } = useFloatingPanel(open, () => blockRef.current?.getBoundingClientRect() ?? null, []);
  useDismiss(open, [panelRef, blockRef], () => setOpen(false));

  const go = (section: SettingsSection) => {
    onOpenSettings(section);
    setOpen(false);
  };

  return (
    <div className="account-wrap">
      {open && (
        <div className="account-menu context-menu" ref={panelRef} style={panelStyle} role="menu">
          <button className="menu-row" onClick={() => go("profile")}>
            <UserCircle2 size={16} /> {t("account.profile")}
          </button>
          <button className="menu-row" onClick={() => go("appearance")}>
            <Sparkles size={16} /> {t("settings.section.appearance")}
          </button>
          <button className="menu-row" onClick={() => go("shortcuts")}>
            <Keyboard size={16} /> {t("settings.section.shortcuts")}
          </button>
          <div className="menu-divider" />
          <button className="menu-row" onClick={() => go("general")}>
            <Settings size={16} /> {t("account.settings")}
          </button>
        </div>
      )}
      <button ref={blockRef} className="account-block" onClick={() => setOpen((value) => !value)} title={t("account.title")}>
        <ProfileAvatar size={26} />
        <span className="account-name">
          {profile?.displayName.trim() || t("brand")}
          {profile?.workspaceLabel.trim() ? <small className="muted ellipsis">{profile.workspaceLabel}</small> : null}
        </span>
        <CircleUser size={16} className="account-caret" />
      </button>
    </div>
  );
}
