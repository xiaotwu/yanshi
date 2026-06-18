import { Bot, Compass, Files, Globe, Monitor, Plus, ShieldCheck, SquareTerminal } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { AgentProfileSummary, LiveAgentState } from "@yanshi/shared";

import { useT } from "../../i18n";

/** Role → lucide icon map. Keyed by `profile.station` — same keys as STATION_COLORS / STATION_OPTIONS. */
export const ROLE_ICONS: Record<string, LucideIcon> = {
  manager: Compass,
  browser: Globe,
  computer: Monitor,
  file: Files,
  reviewer: ShieldCheck,
  terminal: SquareTerminal,
};

/** A live agent is busy if it is actively working or waiting (not terminal, not idle). */
function isAgentBusy(status: LiveAgentState["status"]): boolean {
  return status === "working" || status === "waiting_approval" || status === "blocked";
}

export interface WorkerRailProps {
  profiles: AgentProfileSummary[];
  liveAgents: LiveAgentState[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onForge: () => void;
}

export function WorkerRail({ profiles, liveAgents, selectedId, onSelect, onForge }: WorkerRailProps) {
  const { t } = useT();

  return (
    <nav className="worker-rail" aria-label={t("nav.workshop")}>
      {profiles.map((profile) => {
        const Icon = ROLE_ICONS[profile.station] ?? Bot;
        const isSelected = profile.id === selectedId;
        const liveAgent = liveAgents.find((a) => a.id === profile.id);
        const busy = liveAgent ? isAgentBusy(liveAgent.status) : false;

        return (
          <button
            key={profile.id}
            className={`worker-avatar${isSelected ? " active" : ""}`}
            aria-label={profile.name}
            title={profile.name}
            aria-pressed={isSelected}
            onClick={() => onSelect(profile.id)}
            style={{ "--avatar-accent": profile.accent } as React.CSSProperties}
          >
            <Icon size={20} />
            {busy && <span className="worker-status-dot" aria-hidden />}
          </button>
        );
      })}

      <button
        className="worker-forge"
        aria-label={t("workshop.forgeWorker")}
        title={t("workshop.forgeWorker")}
        onClick={onForge}
      >
        <Plus size={18} />
      </button>
    </nav>
  );
}
