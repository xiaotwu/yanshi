import { CircleUser, HelpCircle, Settings, Sparkles, UserCircle2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import iconUrl from "../../../../icon.png";
import type { SettingsSection } from "../features/settings";

export function AccountMenu({ onOpenSettings }: { onOpenSettings: (section: SettingsSection) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    };
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, [open]);

  const go = (section: SettingsSection) => {
    onOpenSettings(section);
    setOpen(false);
  };

  return (
    <div className="account-wrap" ref={ref}>
      {open && (
        <div className="account-menu">
          <button className="menu-row" onClick={() => go("profile")}>
            <UserCircle2 size={16} /> Profile
          </button>
          <button className="menu-row" onClick={() => go("personalization")}>
            <Sparkles size={16} /> Personalization
          </button>
          <button className="menu-row" onClick={() => go("general")}>
            <Settings size={16} /> Settings
          </button>
          <div className="menu-divider" />
          <button className="menu-row" onClick={() => go("help")}>
            <HelpCircle size={16} /> Help
          </button>
        </div>
      )}
      <button className="account-block" onClick={() => setOpen((value) => !value)} title="Account">
        <img src={iconUrl} alt="" className="account-avatar" />
        <span className="account-name">Yanshi</span>
        <CircleUser size={16} className="account-caret" />
      </button>
    </div>
  );
}
